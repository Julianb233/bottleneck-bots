# Bottleneck Bots — Full UX Audit Report

**Date:** 2026-03-17
**Auditor:** Automated Stagehand browser testing
**Production URL:** https://bottleneckbots.com
**Linear:** AI-2890

---

## Executive Summary

Overall the site is **production-ready** with a polished, professional appearance. The landing page effectively communicates the value proposition for agency owners. However, several UX issues were identified that should be addressed to improve user experience and conversion.

**Score: 7.5/10** — Solid foundation with actionable improvements needed.

---

## Pages Tested

| Page | Route | Status | Notes |
|------|-------|--------|-------|
| Landing Page | `/` | PASS | Hero, Problem, Solution, Proof, Investment sections all render |
| Features Page | `/features` | PASS | Separate page with feature cards |
| Login | `/login` | PASS with issues | Missing "Forgot Password?" link |
| Signup | `/signup` | PASS | Clean toggle from login |
| Privacy Policy | `/privacy` | PASS | Well-structured, dated Dec 11 2025 |
| Terms of Service | `/terms` | PASS | Matches privacy page styling |
| Forgot Password | `/forgot-password` | PASS with issues | Inconsistent button color |
| 404 Page | `/some-nonexistent-page` | PASS with issues | Inconsistent button color |

---

## Critical Issues (Must Fix)

### 1. Missing "Forgot Password?" Link on Login Page
- **Severity:** HIGH
- **Location:** `client/src/components/LoginScreen.tsx`
- **Issue:** The login form has no link to the forgot password page. Users who forget their password have no discoverable way to reset it from the login screen.
- **Impact:** Users get stuck → abandon → lost conversions.
- **Fix:** Add a "Forgot Password?" link below the password field, linking to `/forgot-password`.

### 2. Initial Page Load Shows Spinner for ~4 seconds
- **Severity:** HIGH
- **Location:** App.tsx auth check + lazy loading
- **Issue:** The page shows a dark screen with a green spinner and "Loading..." text for 4+ seconds before the landing page renders. This is due to the auth check (`trpc.auth.me.useQuery`) blocking the initial render.
- **Impact:** Users may bounce thinking the site is broken. First impressions matter for conversion.
- **Fix:** Show the landing page immediately for unauthenticated visitors. Only show the spinner for authenticated routes.

---

## Medium Issues (Should Fix)

### 3. Inconsistent Button Colors Across Pages
- **Severity:** MEDIUM
- **Issue:** Brand color is emerald/green throughout the landing page and login, but:
  - Forgot Password page uses a **muted blue** "Send Reset Link" button
  - 404 page uses a **bright blue** "Go Home" button
- **Impact:** Breaks visual consistency and brand trust.
- **Fix:** Standardize all CTA buttons to use the emerald green brand color.

### 4. Footer Copyright Text Inconsistency
- **Severity:** LOW
- **Issue:** Landing page footer says "Built for agency owners who refuse to sacrifice their lives for their business." but the Features page footer just says "All rights reserved."
- **Fix:** Unify footer content across all pages.

### 5. Nav Links in Landing Page Don't Scroll Smoothly
- **Severity:** LOW
- **Issue:** The anchor nav links (Features, The Problem, The Solution, Proof, Investment) jump instantly to sections rather than smooth-scrolling. The page content between hero and footer is actually much longer than it appeared during initial scrolling — the sections exist but the jump behavior can be disorienting.
- **Fix:** Add `scroll-behavior: smooth` to the HTML element or use a smooth scroll library.

---

## Minor Issues (Nice to Have)

### 6. Help Widget Badge Shows "6"
- **Severity:** LOW
- **Issue:** The green help widget (bottom-right) shows a red badge with "6" on every page. It's unclear what this number represents. If it's unread messages, it may confuse first-time visitors.
- **Fix:** Configure the widget to hide the badge for unauthenticated users or set initial count to 0.

### 7. No Mobile Hamburger Menu Verification
- **Severity:** INFO
- **Issue:** The desktop nav has 7 items (Features, The Problem, The Solution, Proof, Investment, Log In, Start Free). Stagehand couldn't resize the viewport to verify mobile responsiveness. Manual testing needed on a real 375px device to confirm the nav collapses to a hamburger menu.
- **Recommendation:** Manually test on iPhone/Android or use Chrome DevTools.

### 8. Login Page Button Copy: "Access Terminal"
- **Severity:** INFO
- **Issue:** The login button says "Access Terminal" which has a developer/hacker aesthetic. This may feel intimidating or confusing for non-technical agency owners (the target audience).
- **Recommendation:** Consider changing to "Log In" or "Access Dashboard" for clarity.

---

## What's Working Well

- **Landing page copy** is excellent — emotionally resonant, speaks directly to agency owner pain points
- **Visual design** is polished with consistent green/emerald branding on the main pages
- **Section structure** (Problem → Solution → Proof → Investment) follows proven conversion patterns
- **Pricing cards** are clear with good tier differentiation
- **Testimonials** feel authentic with names, titles, and companies
- **Stats section** (487+ users, 18hrs saved, 94% stress reduction, 24/7) builds credibility
- **Privacy/Terms pages** are properly dated and well-structured
- **Login/Signup toggle** is smooth and intuitive
- **404 page** exists and has a clear CTA to return home
- **Cookie consent banner** is present and functional
- **Google OAuth** option available on login/signup

---

## Recommendations Priority

| Priority | Issue | Effort |
|----------|-------|--------|
| P0 | Add "Forgot Password?" link to login page | 15 min |
| P0 | Fix slow initial load (don't block on auth for public pages) | 1-2 hours |
| P1 | Standardize button colors to emerald green | 30 min |
| P2 | Unify footer content | 15 min |
| P2 | Add smooth scrolling for nav anchors | 15 min |
| P3 | Configure help widget badge | 15 min |
| P3 | Verify mobile responsiveness manually | 30 min |
| P3 | Consider changing "Access Terminal" button text | 5 min |

---

## Test Environment

- **Browser:** Chromium (Browserbase cloud)
- **Desktop viewport:** 1280x720
- **Mobile viewport:** Attempted 375x812 (Stagehand viewport resize not confirmed)
- **Pages tested:** 8 routes
- **Screenshots captured:** 21
