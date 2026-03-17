import { Router } from "express";
import { createHash, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import * as db from "../db";
import { sdk } from "./sdk";
import { getSessionCookieOptions } from "./cookies";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

const router = Router();

// bcrypt configuration - cost factor of 12 is secure and performant
const BCRYPT_ROUNDS = 12;

// Debug endpoint to test if routes are working
router.get("/debug", async (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    vercel: process.env.VERCEL === "1",
    databaseUrl: process.env.DATABASE_URL ? "set" : "not set",
  });
});

/**
 * Hash password using bcrypt with secure cost factor
 * Returns a bcrypt hash string (includes salt automatically)
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify password against stored hash
 * Supports both new bcrypt format and legacy SHA-256 format for migration
 */
async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  // Check if this is a bcrypt hash (starts with $2a$, $2b$, or $2y$)
  if (storedHash.startsWith('$2')) {
    return bcrypt.compare(password, storedHash);
  }

  // Legacy SHA-256 format: "hash:salt"
  const [hash, salt] = storedHash.split(':');
  if (!hash || !salt) return false;

  const computedHash = createHash('sha256')
    .update(password + salt)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  try {
    return timingSafeEqual(Buffer.from(hash), Buffer.from(computedHash));
  } catch {
    return false;
  }
}

/**
 * Check if a stored hash is using the legacy format and needs upgrade
 */
function isLegacyHash(storedHash: string): boolean {
  return !storedHash.startsWith('$2');
}

/**
 * Upgrade a user's password hash from legacy SHA-256 to bcrypt
 */
async function upgradePasswordHash(userId: number, newHash: string): Promise<void> {
  try {
    await db.updateUserPassword(userId, newHash);
    console.log(`[Auth] Upgraded password hash for user ${userId} to bcrypt`);
  } catch (error) {
    console.error(`[Auth] Failed to upgrade password hash for user ${userId}:`, error);
  }
}

// POST /api/auth/signup - Create new account with email/password
router.post("/signup", async (req, res) => {
  try {
    console.log("[Auth] Signup request received");
    console.log("[Auth] req.body:", JSON.stringify(req.body));
    console.log("[Auth] req.body type:", typeof req.body);

    const { email: rawEmail, password, name } = req.body || {};

    if (!rawEmail || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const email = rawEmail.toLowerCase().trim();

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    // Check if user already exists
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    // Hash password with bcrypt
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await db.createUserWithPassword({
      email,
      password: hashedPassword,
      name: name || email.split('@')[0],
    });

    if (!user) {
      return res.status(500).json({ error: "Failed to create account" });
    }

    // Create session token
    const sessionToken = await sdk.createSessionToken(
      `email_${user.id}`,
      { name: user.name || "User" }
    );

    // Set session cookie
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

    console.log("[Auth] Email signup successful for:", email);

    return res.json({
      success: true,
      isNewUser: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        onboardingCompleted: user.onboardingCompleted,
      },
    });
  } catch (error) {
    console.error("[Auth] Signup error:", error);
    console.error("[Auth] Signup error name:", error instanceof Error ? error.name : 'unknown');
    console.error("[Auth] Signup error message:", error instanceof Error ? error.message : String(error));
    return res.status(500).json({ error: "Failed to create account" });
  }
});

// Simple in-memory rate limiting for login attempts
const loginAttemptMap = new Map<string, { count: number; resetAt: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkLoginRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = loginAttemptMap.get(key);
  if (!entry || now > entry.resetAt) {
    loginAttemptMap.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    return false;
  }
  entry.count++;
  return true;
}

function resetLoginRateLimit(key: string): void {
  loginAttemptMap.delete(key);
}

// Periodically clean up stale rate limit entries (every 30 minutes)
setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];
  loginAttemptMap.forEach((entry, key) => {
    if (now > entry.resetAt) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => loginAttemptMap.delete(key));
}, 30 * 60 * 1000);

// POST /api/auth/login - Login with email/password
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Rate limit by email (normalized)
    const normalizedEmail = email.toLowerCase().trim();
    const rateLimitKey = `login:${normalizedEmail}`;
    if (!checkLoginRateLimit(rateLimitKey)) {
      console.warn(`[Auth] Rate limited login for: ${normalizedEmail}`);
      return res.status(429).json({
        error: "Too many login attempts. Please try again later.",
      });
    }

    // Find user by email
    const user = await db.getUserByEmail(normalizedEmail);
    if (!user) {
      // Use generic message to prevent email enumeration
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Check if user has a password set (e.g., Google-only users)
    if (!user.password) {
      return res.status(401).json({
        error: "This account uses a different sign-in method. Try Google sign-in, or use 'Forgot Password' to set a password.",
      });
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Successful login - reset rate limit
    resetLoginRateLimit(rateLimitKey);

    // Upgrade legacy SHA-256 hash to bcrypt on successful login
    if (isLegacyHash(user.password)) {
      const newHash = await hashPassword(password);
      await upgradePasswordHash(user.id, newHash);
    }

    // Update last signed in
    await db.updateUserLastSignIn(user.id);

    // Create session token
    const sessionToken = await sdk.createSessionToken(
      `email_${user.id}`,
      { name: user.name || "User" }
    );

    // Set session cookie
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

    console.log("[Auth] Email login successful for:", normalizedEmail);

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        onboardingCompleted: user.onboardingCompleted,
      },
    });
  } catch (error) {
    console.error("[Auth] Login error:", error);
    return res.status(500).json({ error: "Login failed. Please try again." });
  }
});

// POST /api/auth/forgot-password - Request password reset
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Import password reset helpers
    const { createPasswordResetToken } = await import("../auth/email-password");

    try {
      const { token, expiresAt } = await createPasswordResetToken(email);

      // TODO: Send email with reset link
      // For now, we'll return the token in development mode
      // In production, this should only send an email
      const resetLink = `${process.env.APP_URL || 'http://localhost:5000'}/reset-password?token=${token}`;

      console.log(`[Auth] Password reset requested for: ${email}`);
      console.log(`[Auth] Reset link: ${resetLink}`);
      console.log(`[Auth] Token expires at: ${expiresAt}`);

      // Always return success to prevent email enumeration
      return res.json({
        success: true,
        message: "If an account exists with this email, you will receive password reset instructions.",
        // In development, include the link for testing
        ...(process.env.NODE_ENV === 'development' && { resetLink, expiresAt }),
      });
    } catch (error) {
      // Don't reveal if email doesn't exist
      console.log(`[Auth] Password reset attempt for non-existent email: ${email}`);
      return res.json({
        success: true,
        message: "If an account exists with this email, you will receive password reset instructions.",
      });
    }
  } catch (error) {
    console.error("[Auth] Forgot password error:", error);
    return res.status(500).json({ error: "Failed to process password reset request" });
  }
});

// POST /api/auth/reset-password - Reset password with token
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: "Token and new password are required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    // Import password reset helpers
    const { resetPassword } = await import("../auth/email-password");

    try {
      await resetPassword(token, password);

      console.log("[Auth] Password reset successful");

      return res.json({
        success: true,
        message: "Password has been reset successfully. You can now login with your new password.",
      });
    } catch (error) {
      console.error("[Auth] Password reset failed:", error);
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid or expired reset token",
      });
    }
  } catch (error) {
    console.error("[Auth] Reset password error:", error);
    return res.status(500).json({ error: "Failed to reset password" });
  }
});

// GET /api/auth/verify-reset-token - Verify reset token is valid
router.get("/verify-reset-token", async (req, res) => {
  try {
    const token = req.query.token as string;

    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    const database = await db.getDb();
    if (!database) {
      return res.status(500).json({ error: "Database not available" });
    }

    const { passwordResetTokens } = await import("../../drizzle/schema-auth");
    const { gt, and, isNull } = await import("drizzle-orm");
    const bcrypt = await import("bcryptjs");

    // Get all unexpired, unused tokens
    const tokens = await database
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          gt(passwordResetTokens.expiresAt, new Date()),
          isNull(passwordResetTokens.usedAt)
        )
      )
      .limit(100);

    // Check if any token matches
    let validToken = null;
    for (const dbToken of tokens) {
      const isMatch = await bcrypt.compare(token, dbToken.token);
      if (isMatch) {
        validToken = dbToken;
        break;
      }
    }

    if (!validToken) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    return res.json({
      valid: true,
      expiresAt: validToken.expiresAt,
    });
  } catch (error) {
    console.error("[Auth] Verify reset token error:", error);
    return res.status(500).json({ error: "Failed to verify token" });
  }
});

// POST /api/auth/logout - Clear session cookie
router.post("/logout", async (req, res) => {
  try {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    console.log("[Auth] Logout successful");
    return res.json({ success: true });
  } catch (error) {
    console.error("[Auth] Logout error:", error);
    return res.status(500).json({ error: "Logout failed" });
  }
});

export const emailAuthRouter = router;
