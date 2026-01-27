/**
 * Tenant Isolation Middleware
 * Extracts tenant context from authenticated requests and makes it available throughout request lifecycle
 *
 * This middleware should be used AFTER authentication middleware (authMiddleware)
 * It uses AsyncLocalStorage to maintain tenant context across async operations
 */

import type { Request, Response, NextFunction } from "express";
import { getTenantService, TenantIsolationService } from "../../../services/tenantIsolation.service";
import type { AuthenticatedRequest } from "./authMiddleware";
import { getDb } from "../../../db";
import { eq, and, sql } from "drizzle-orm";

/**
 * Validates that a user has access to a specific organization
 * Uses raw SQL query since organization_members table may not exist in all deployments
 * @param userId - The user's ID
 * @param orgId - The organization ID to check access for
 * @returns true if user has access, false otherwise
 */
async function validateUserOrgAccess(userId: number, orgId: string): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[TenantMiddleware] Database not available for org access validation");
      // In development without DB, allow access; in production this should fail closed
      return process.env.NODE_ENV === "development";
    }

    // Check if organization_members table exists and user has membership
    // This is a flexible query that works even if the table doesn't exist yet
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'organization_members'
      ) as table_exists
    `);

    const tableExists = (result.rows[0] as any)?.table_exists;

    if (!tableExists) {
      // Table doesn't exist - use user-based tenancy only
      // User can only access their own tenant
      return `org_${orgId}` === `tenant_${userId}` || orgId === String(userId);
    }

    // Query the organization_members table
    const membershipResult = await db.execute(sql`
      SELECT 1 FROM organization_members
      WHERE user_id = ${userId} AND organization_id = ${orgId}
      LIMIT 1
    `);

    return membershipResult.rows.length > 0;
  } catch (error) {
    console.error("Error validating org access:", error);
    // Fail closed - deny access on error
    return false;
  }
}

/**
 * Validates a subdomain exists and the user has access to it
 * @param subdomain - The subdomain to validate
 * @param userId - The user's ID
 * @returns The tenant ID if valid and accessible, null otherwise
 */
async function validateSubdomainAndGetTenantId(subdomain: string, userId: number): Promise<string | null> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[TenantMiddleware] Database not available for subdomain validation");
      // In development without DB, create tenant ID from subdomain
      return process.env.NODE_ENV === "development" ? `subdomain_${subdomain}` : null;
    }

    // Check if tenants table with subdomain column exists
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tenants' AND column_name = 'subdomain'
      ) as column_exists
    `);

    const columnExists = (result.rows[0] as any)?.column_exists;

    if (!columnExists) {
      // No subdomain-based tenant table - allow subdomain if in dev mode
      console.warn("[TenantMiddleware] No tenants.subdomain column found");
      return process.env.NODE_ENV === "development" ? `subdomain_${subdomain}` : null;
    }

    // Query for tenant by subdomain and verify user access
    const tenantResult = await db.execute(sql`
      SELECT t.id as tenant_id
      FROM tenants t
      LEFT JOIN organization_members om ON om.organization_id = t.id
      WHERE t.subdomain = ${subdomain}
        AND (om.user_id = ${userId} OR t.owner_id = ${userId})
      LIMIT 1
    `);

    if (tenantResult.rows.length === 0) {
      return null;
    }

    return `subdomain_${(tenantResult.rows[0] as any).tenant_id}`;
  } catch (error) {
    console.error("Error validating subdomain access:", error);
    // Fail closed - deny access on error
    return null;
  }
}

/**
 * Extended request with tenant context
 */
export interface TenantRequest extends AuthenticatedRequest {
  tenantContext?: {
    userId: number;
    tenantId: string;
    email?: string;
    role?: string;
  };
}

/**
 * Tenant Context Middleware
 *
 * Establishes tenant context from authenticated user for the duration of the request.
 * All downstream operations will have access to tenant context via AsyncLocalStorage.
 *
 * Usage:
 * ```typescript
 * router.use(requireApiKey);        // First: Authenticate
 * router.use(tenantContextMiddleware); // Second: Establish tenant context
 * router.get('/api/v1/data', handler); // Third: Use tenant-aware operations
 * ```
 */
export async function tenantContextMiddleware(
  req: TenantRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantService = getTenantService();

    // Check if user is authenticated
    if (!req.user) {
      // No authenticated user - skip tenant context
      // This allows optional auth endpoints to work
      next();
      return;
    }

    // Create tenant context from authenticated user
    const tenantContext = TenantIsolationService.createContext({
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      // You can customize tenant ID logic here:
      // - Same as userId (user-based tenancy)
      // - From user profile (organization-based tenancy)
      // - From subdomain (subdomain-based tenancy)
      tenantId: `tenant_${req.user.id}`, // Default: user-based
    });

    // Attach to request for convenience
    req.tenantContext = {
      userId: tenantContext.userId,
      tenantId: tenantContext.tenantId,
      email: tenantContext.email,
      role: tenantContext.role,
    };

    // Run the rest of the request within tenant context
    await tenantService.runInTenantContext(tenantContext, async () => {
      // Create a promise wrapper for Express next()
      await new Promise<void>((resolve, reject) => {
        // Store original res.end to ensure we resolve when response completes
        const originalEnd = res.end.bind(res);

        res.end = function (this: Response, chunk?: any, encoding?: BufferEncoding | (() => void), cb?: () => void): Response {
          resolve();
          return originalEnd(chunk, encoding as BufferEncoding, cb);
        } as typeof res.end;

        // Call next middleware
        next();

        // If response is already sent, resolve immediately
        if (res.headersSent) {
          resolve();
        }
      });
    });
  } catch (error) {
    console.error("Tenant context middleware error:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to establish tenant context",
      code: "TENANT_CONTEXT_ERROR",
    });
  }
}

/**
 * Strict Tenant Context Middleware
 *
 * Requires tenant context to be present (authenticated user required)
 * Returns 401 if user is not authenticated
 *
 * Use this for endpoints that absolutely require tenant context
 */
export async function requireTenantContext(
  req: TenantRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Authentication required for this endpoint",
      code: "AUTH_REQUIRED",
    });
    return;
  }

  // User exists, proceed with tenant context
  await tenantContextMiddleware(req, res, next);
}

/**
 * Organization-based Tenant Context Middleware
 *
 * For applications with organization/team-based multi-tenancy
 * Extracts tenant ID from organization ID instead of user ID
 *
 * Prerequisites:
 * - User must be authenticated
 * - Organization ID must be provided (via header, query, or JWT claim)
 */
export async function orgBasedTenantContext(
  req: TenantRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required",
        code: "AUTH_REQUIRED",
      });
      return;
    }

    // Extract organization ID from request
    // This could come from:
    // 1. Custom header: x-organization-id
    // 2. Query parameter: ?orgId=...
    // 3. JWT claim
    // 4. User profile lookup
    const orgId =
      req.headers["x-organization-id"] as string ||
      req.query.orgId as string ||
      undefined;

    if (!orgId) {
      res.status(400).json({
        error: "Bad Request",
        message: "Organization ID required (provide via x-organization-id header)",
        code: "ORG_ID_REQUIRED",
      });
      return;
    }

    // Validate user has access to this organization
    const hasAccess = await validateUserOrgAccess(req.user.id, orgId);
    if (!hasAccess) {
      res.status(403).json({
        error: "Forbidden",
        message: "You do not have access to this organization",
        code: "ORG_ACCESS_DENIED",
      });
      return;
    }

    const tenantService = getTenantService();

    const tenantContext = TenantIsolationService.createContext({
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      tenantId: `org_${orgId}`, // Organization-based tenant ID
    });

    req.tenantContext = {
      userId: tenantContext.userId,
      tenantId: tenantContext.tenantId,
      email: tenantContext.email,
      role: tenantContext.role,
    };

    await tenantService.runInTenantContext(tenantContext, async () => {
      await new Promise<void>((resolve) => {
        const originalEnd = res.end.bind(res);
        res.end = function (this: Response, chunk?: any, encoding?: BufferEncoding | (() => void), cb?: () => void): Response {
          resolve();
          return originalEnd(chunk, encoding as BufferEncoding, cb);
        } as typeof res.end;
        next();
        if (res.headersSent) {
          resolve();
        }
      });
    });
  } catch (error) {
    console.error("Organization tenant context error:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to establish organization context",
      code: "ORG_CONTEXT_ERROR",
    });
  }
}

/**
 * Subdomain-based Tenant Context Middleware
 *
 * For applications with subdomain-based multi-tenancy
 * Extracts tenant ID from subdomain (e.g., acme.app.com -> tenant: acme)
 */
export async function subdomainBasedTenantContext(
  req: TenantRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required",
        code: "AUTH_REQUIRED",
      });
      return;
    }

    // Extract subdomain from host header
    const host = req.headers.host || "";
    const subdomain = host.split(".")[0];

    // Validate subdomain (exclude common non-tenant subdomains)
    const excludedSubdomains = ["www", "api", "app", "admin", "localhost"];
    if (!subdomain || excludedSubdomains.includes(subdomain)) {
      res.status(400).json({
        error: "Bad Request",
        message: "Invalid or missing subdomain for tenant identification",
        code: "INVALID_SUBDOMAIN",
      });
      return;
    }

    // Validate subdomain exists and user has access
    const tenantId = await validateSubdomainAndGetTenantId(subdomain, req.user.id);
    if (!tenantId) {
      res.status(403).json({
        error: "Forbidden",
        message: "Invalid subdomain or you do not have access to this tenant",
        code: "SUBDOMAIN_ACCESS_DENIED",
      });
      return;
    }

    const tenantService = getTenantService();

    const tenantContext = TenantIsolationService.createContext({
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      tenantId: `subdomain_${subdomain}`,
    });

    req.tenantContext = {
      userId: tenantContext.userId,
      tenantId: tenantContext.tenantId,
      email: tenantContext.email,
      role: tenantContext.role,
    };

    await tenantService.runInTenantContext(tenantContext, async () => {
      await new Promise<void>((resolve) => {
        const originalEnd = res.end.bind(res);
        res.end = function (this: Response, chunk?: any, encoding?: BufferEncoding | (() => void), cb?: () => void): Response {
          resolve();
          return originalEnd(chunk, encoding as BufferEncoding, cb);
        } as typeof res.end;
        next();
        if (res.headersSent) {
          resolve();
        }
      });
    });
  } catch (error) {
    console.error("Subdomain tenant context error:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to establish subdomain context",
      code: "SUBDOMAIN_CONTEXT_ERROR",
    });
  }
}
