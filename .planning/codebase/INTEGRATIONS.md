# External Integrations

**Analysis Date:** 2026-01-16

## APIs & External Services

**Payment Processing:**
- Stripe - Credit packages and subscription billing
  - SDK/Client: stripe 20.0.0 (`package.json`)
  - Auth: STRIPE_SECRET_KEY env var
  - Webhooks: `server/api/webhooks/stripe.ts`
  - Events: checkout.session.completed, payment_intent.succeeded, subscription updates

**AI/LLM Providers:**
- Anthropic (Claude) - Primary AI provider
  - SDK/Client: @anthropic-ai/sdk 0.71.2 (`server/providers/anthropic.provider.ts`)
  - Auth: ANTHROPIC_API_KEY env var
  - Models: Claude Opus 4.5, Sonnet 4.5, Haiku (200K context)

- OpenAI - GPT models
  - SDK/Client: openai 4.104.0 (`server/providers/openai.provider.ts`)
  - Auth: OPENAI_API_KEY env var
  - Models: GPT-4o, GPT-4o-mini, o1-preview, o1-mini
  - Used in: `server/services/ads.service.ts`, `server/services/email.service.ts`

- Google Gemini - Alternative AI provider
  - SDK/Client: @google/genai 1.33.0
  - Auth: GEMINI_API_KEY env var
  - Preferred model: google/gemini-2.0-flash (with Stagehand)

**Browser Automation:**
- Browserbase - Cloud browser platform
  - SDK/Client: @browserbasehq/sdk 2.6.0 (`server/_core/browserbaseSDK.ts`)
  - Auth: BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID env vars
  - Region: BROWSERBASE_REGION (default: us-west-2)

- Stagehand - AI-powered browser automation
  - SDK/Client: @browserbasehq/stagehand 3.0.6 (`server/services/stagehand.service.ts`)
  - Features: Structured data extraction, AI actions

**Voice/Communication:**
- Vapi AI - Automated phone calls
  - Integration: `server/services/vapi.service.ts`
  - Features: Voice AI conversations, call recording, transcription

## Data Storage

**Databases:**
- PostgreSQL on Supabase - Primary data store
  - Connection: DATABASE_URL env var
  - Client: Drizzle ORM 0.44.7 (`server/db.ts`)
  - Migrations: `drizzle/migrations/`
  - Schemas: 18 specialized schema files in `drizzle/`
  - Pooling: Port 6543 for serverless

**Caching:**
- Redis via ioredis - Job queue and caching
  - Connection: REDIS_URL env var
  - Client: ioredis 5.8.2 (`server/services/redis.service.ts`)
  - Used by: BullMQ job queue, cache service

**File Storage:**
- AWS S3 - File storage
  - SDK/Client: @aws-sdk/client-s3 (`server/services/s3-storage.service.ts`)
  - Auth: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
  - Bucket: AWS_S3_BUCKET env var

- CloudFront CDN - Content delivery
  - Config: CLOUDFRONT_DISTRIBUTION_ID, CLOUDFRONT_DOMAIN
  - Signed URLs: CLOUDFRONT_KEY_PAIR_ID, CLOUDFRONT_PRIVATE_KEY

## Authentication & Identity

**Auth Provider:**
- Supabase Auth - Primary authentication
  - Client: @supabase/supabase-js 2.89.0 (`server/lib/supabase.ts`)
  - Auth: SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

- Custom Email/Password - Built-in auth
  - Implementation: `server/_core/email-auth.ts`, `server/auth/email-password.ts`
  - Password hashing: bcryptjs 3.0.3
  - Token management: jose 6.1.0 (JWT)

**OAuth Integrations:**
- Google OAuth - Sign-in and Calendar API
  - Credentials: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
  - Implementation: `server/_core/google-auth.ts`, `server/api/routes/oauth.ts`

- Gmail OAuth - Email integration
  - Credentials: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI
  - Implementation: `server/services/email.service.ts`

- Microsoft Outlook - Email integration
  - Credentials: OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET, OUTLOOK_REDIRECT_URI
  - Implementation: Microsoft Graph API

- Meta (Facebook/Instagram) - Social and ads
  - Credentials: FACEBOOK_CLIENT_ID/SECRET, INSTAGRAM_CLIENT_ID/SECRET
  - Implementation: `server/api/routes/oauth.ts`, `server/services/ads.service.ts`

- LinkedIn - Social integration
  - Credentials: LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET

## Monitoring & Observability

**Error Tracking:**
- Sentry - Server and client errors
  - Server DSN: SENTRY_DSN env var (`server/lib/sentry.ts`)
  - Client DSN: VITE_SENTRY_DSN env var
  - Source maps: SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT
  - Configuration: `sentry.server.config.ts`, `sentry.client.config.ts`

**Analytics:**
- Vercel Analytics - Performance monitoring
  - Package: @vercel/analytics 1.6.1
- Vercel Speed Insights - Web vitals
  - Package: @vercel/speed-insights 1.3.1

**Logs:**
- Pino - Structured logging
  - Package: pino 9.14.0 (`server/lib/logger.ts`)

## CI/CD & Deployment

**Hosting:**
- Vercel - Primary deployment
  - Config: `vercel.json`
  - Deployment: Automatic on main branch push
  - Environment vars: Vercel dashboard

- Docker - Container support
  - Config: `Dockerfile` (multi-stage build)
  - Kubernetes: Helm charts in `helm/`

## Email Services

**Transactional Email:**
- Resend (preferred)
  - Auth: RESEND_API_KEY env var

- SMTP Fallback
  - Config: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS

## Notifications

**Slack Webhooks:**
- Config: SLACK_WEBHOOK_URL, SLACK_DEFAULT_CHANNEL
- Used for: Error alerts, notifications

## CRM & Marketing

**GoHighLevel (GHL):**
- Auth: GHL_API_KEY, GHL_SECRET_KEY, GHL_LOCATION_ID
- Workflows: `server/workflows/ghl/`
- Features: Login automation, data extraction

## Webhooks & Callbacks

**Incoming:**
- Stripe - `/api/webhooks/stripe`
  - File: `server/api/webhooks/stripe.ts`
  - Verification: stripe.webhooks.constructEvent with signature
  - Events: payment_intent, checkout.session, subscription updates

**Outgoing:**
- Custom webhooks - User-configured
  - Implementation: `server/services/webhookReceiver.service.ts`

## Environment Configuration

**Development:**
- Required: DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY
- Optional: API keys for external services (Stripe test mode)
- Template: `.env.example`

**Production:**
- Secrets: Vercel environment variables
- Template: `.env.vercel.example`
- Database: Supabase production project

---

*Integration audit: 2026-01-16*
*Update when adding/removing external services*
