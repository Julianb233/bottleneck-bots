# Bottleneck-Bots Tech Stack

> **IMPORTANT**: All development MUST use these technologies. Do NOT suggest alternatives.

## Core Framework
- **Next.js 15+** - App Router (NOT Pages Router)
- **React 19** - Server Components by default
- **TypeScript 5+** - Strict mode enabled

## Styling
- **Tailwind CSS 4** - Utility-first CSS
- **Custom components** - Built on Tailwind (no shadcn)
- **Heroicons or inline SVGs** - Icons
- **clsx** - Conditional classes

## Database & Auth
- **Supabase** - Database + Auth (NOT Neon, NOT Clerk)
  - PostgreSQL database
  - Built-in authentication
  - Row Level Security (RLS)
- **@supabase/supabase-js** - Client SDK
- **@supabase/ssr** - SSR support

## Bot Integrations
- **Slack Webhooks** - Slack notifications
- **Discord Webhooks** - Discord notifications
- **Resend** - Email sending
- **HTTP/Fetch** - Generic API calls
- Custom connectors in /lib/execution/actions/

## Scheduler
- **Custom cron parser** - In /lib/scheduler.ts
- Server-side scheduling (no external cron service)

## State Management
- **React Context** - Auth state (AuthProvider)
- **useState/useReducer** - Local state
- DO NOT use: Redux, Zustand, Jotai

## Validation
- **Zod** - Schema validation
- DO NOT use: Yup, Joi

## File Structure
```
/app                 # Next.js App Router pages
  /(auth)           # Auth routes (login, signup)
  /auth             # Auth callbacks
  /dashboard        # Dashboard pages
  /api              # API routes
    /bots           # Bot CRUD
    /executions     # Execution history
/components          # React components
  /auth             # Auth components
  /workflow-builder # Visual workflow builder
  /execution-history # Execution UI
  /notifications-dropdown
/lib                 # Utilities and services
  /supabase.ts      # Supabase client
  /scheduler.ts     # Cron scheduling
  /execution/       # Bot execution engine
    /actions/       # Action implementations
  /db/              # Database queries
/hooks               # Custom React hooks
```

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
RESEND_API_KEY=re_...
```

## Commands
```bash
npm run dev          # Development server
npm run build        # Production build
npm test             # Run tests (Vitest)
```

## Bot Action Types
- `slack` - Send Slack message
- `discord` - Send Discord message
- `email` - Send email via Resend
- `http` - Make HTTP request
- `webhook` - Send webhook with signature
- `delay` - Wait for duration
- `filter` - Conditional execution
- `transform` - Data transformation

## DO NOT USE
- Prisma (use Supabase client)
- Clerk/Auth0 (use Supabase Auth)
- Neon (use Supabase)
- shadcn/ui (use custom Tailwind components)
- MongoDB (use PostgreSQL via Supabase)
- Express (use Next.js API routes)
- Redux/Zustand (use Context)
- External cron services (use built-in scheduler)
