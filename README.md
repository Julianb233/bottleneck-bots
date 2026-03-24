# Bottleneck Bot - Browser Automation SaaS Platform

**AI-Powered GoHighLevel Automation Platform** - Automate workflows, funnels, campaigns, and client management using intelligent browser agents powered by Browserbase and Stagehand.

---

## Monorepo Structure

This repo is a pnpm monorepo using Turborepo:

```
Bottleneck-Bots/
  client/                  # Vite/React frontend (existing)
  server/                  # Express/tRPC server (existing)
  shared/                  # Shared types (existing)
  packages/
    api/                   # Fastify API server (VM/computer management, workspaces, auth)
    shared/                # Shared types/utilities for packages
    cli/                   # CLI tool
  sdk/
    python/                # Python SDK
    typescript/            # TypeScript SDK
  docker/                  # Docker infrastructure (desktop-base, security, templates)
  docker-compose.yml       # Full stack local development
```

### packages/api Routes

- `auth` - Authentication (login, register, sessions)
- `workspaces` - Multi-tenant workspace management
- `computers` - VM/computer provisioning and management
- `actions` - Computer action execution
- `admin` - Admin panel APIs
- `invites` - Team invites
- `members` - Workspace members
- `provider-keys` - Provider API key management
- `templates` - Workspace templates
- `v1/chat-completions` - OpenAI-compatible chat completions
- `v1/models` - Available models list
- `docs` - API documentation
- `health` - Health checks

### Development

```bash
# Install all workspace dependencies
pnpm install

# Run all packages in dev mode
pnpm dev

# Build all packages
pnpm build

# Run tests
pnpm test
```

---

## 📋 Overview

Bottleneck Bot is a white-label SaaS platform that enables agencies to automate GoHighLevel operations through AI-powered browser automation. The system uses natural language commands to execute complex multi-step workflows, eliminating the need for manual GHL configuration.

**Key Features:**
- **AI Agent Orchestration** - Natural language task execution with Google Gemini
- **Browser Automation** - Browserbase + Stagehand for reliable, scalable automation
- **Client Context Management** - Notion, Google Drive, and PDF integration for brand voice and assets
- **Multi-Tenant Architecture** - White-label SaaS with JWT authentication and token tracking
- **Payment-to-Onboarding** - Automated Stripe → client setup → browser session provisioning
- **48 GHL Functions** - Pre-trained automation sequences for workflows, funnels, campaigns, and more

---

## 🏗️ Architecture

### Technology Stack

**Frontend:**
- React 19 + Tailwind CSS 4
- tRPC for type-safe API communication
- shadcn/ui component library
- Wouter for routing

**Backend:**
- Node.js + Express 4
- tRPC 11 for end-to-end type safety
- Drizzle ORM + Supabase PostgreSQL
- S3-compatible storage for assets

**Automation:**
- Browserbase for cloud browser infrastructure
- Stagehand for AI-powered browser automation
- Google Gemini API for agent intelligence
- 1Password Connect for credential management

**Deployment:**
- GitHub for version control
- Vercel for hosting and CI/CD
- n8n for workflow orchestration

---

## 📁 Project Structure

```
bottleneck-bot/
├── client/                    # Frontend React application
│   ├── src/
│   │   ├── components/        # UI components
│   │   ├── pages/             # Page components
│   │   ├── services/          # API services
│   │   ├── contexts/          # React contexts
│   │   └── types.ts           # TypeScript types
│   └── public/                # Static assets
│
├── server/                    # Backend Node.js application
│   ├── _core/                 # Framework code (OAuth, LLM, etc.)
│   ├── routers.ts             # tRPC API routes
│   └── db.ts                  # Database queries
│
├── drizzle/                   # Database schema and migrations
│   └── schema.ts              # Database tables
│
├── n8n-workflows/             # Production-ready n8n workflows
│   ├── 1-browser-automation-trigger.json
│   ├── 2-email-2fa-extractor.json
│   ├── 3-client-onboarding.json
│   ├── 4-usage-tracking.json
│   └── 5-payment-to-onboarding.json
│
├── docs/                      # Comprehensive documentation
│   ├── Architecture-Report.md
│   ├── Authentication-Architecture.md
│   ├── Browserbase-Integration-Guide.md
│   ├── Task-Priority-List.md
│   ├── AI-Agent-Training-Methodology.md
│   └── GHL-Complete-Functions-Reference.md
│
└── README.md                  # This file
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 22+
- pnpm package manager
- PostgreSQL database (Supabase recommended)
- GitHub account
- Vercel account

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Julianb233/bottleneck-bot.git
   cd bottleneck-bot
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```

4. **Configure database:**
   ```bash
   pnpm db:push
   ```

5. **Start development server:**
   ```bash
   pnpm dev
   ```

6. **Access the application:**
   - Frontend: http://localhost:3000
   - API: http://localhost:3000/api/trpc

---

## 🔧 Configuration

### Required Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Authentication
JWT_SECRET=your-jwt-secret
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://auth.manus.im

# Google Gemini API
GEMINI_API_KEY=your-gemini-api-key

# Browserbase
BROWSERBASE_API_KEY=your-browserbase-api-key
BROWSERBASE_PROJECT_ID=your-project-id

# GoHighLevel
GHL_SECRET_KEY=your-ghl-secret-key

# 1Password Connect
ONEPASSWORD_CONNECT_URL=http://localhost:8080
ONEPASSWORD_VAULT_ID=your-vault-id
ONEPASSWORD_TOKEN=your-connect-token

# Gmail API (for 2FA)
GMAIL_CLIENT_ID=your-gmail-client-id
GMAIL_CLIENT_SECRET=your-gmail-client-secret
GMAIL_REFRESH_TOKEN=your-refresh-token

# Stripe (for payments)
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-webhook-secret

# n8n
N8N_WEBHOOK_URL=https://your-n8n-instance.app.n8n.cloud
```

---

## 📚 Documentation

Comprehensive documentation is available in the `/docs` directory:

1. **[System Architecture](./docs/Architecture-Report.md)** - Complete system design and service integrations
2. **[Authentication Guide](./docs/Authentication-Architecture.md)** - 1Password, Gmail 2FA, and session management
3. **[Browserbase Integration](./docs/Browserbase-Integration-Guide.md)** - Cloud browser setup and configuration
4. **[Task Priority List](./docs/Task-Priority-List.md)** - 50+ automation tasks ranked by frequency
5. **[AI Agent Training](./docs/AI-Agent-Training-Methodology.md)** - Training methodology and knowledge storage
6. **[GHL Functions Reference](./docs/GHL-Complete-Functions-Reference.md)** - 48 documented GHL functions with automation sequences

---

## 🔄 n8n Workflows

Five production-ready n8n workflows are included in `/n8n-workflows/`:

1. **Browser Automation Trigger** - Webhook → Browserbase session → automation execution
2. **Email 2FA Extractor** - Gmail monitoring for verification codes
3. **Client Onboarding** - New client setup with credential storage
4. **Usage Tracking** - Hourly task monitoring and cost calculation
5. **Payment-to-Onboarding** - Stripe payment → automated client provisioning

### Importing Workflows

1. Open your n8n instance
2. Click "Import from File"
3. Select the workflow JSON file
4. Configure credentials (PostgreSQL, 1Password, Browserbase, Gmail)
5. Activate the workflow

---

## 💰 Pricing & Costs

### Monthly Operational Costs

| Tier | Users | Clients | Monthly Cost |
|------|-------|---------|--------------|
| Starter | 1-3 | 5-10 | $1,218 |
| Growth | 5-10 | 20-50 | $2,205 |
| Enterprise | 15+ | 100+ | $5,185 |

**Cost Breakdown:**
- Browserbase: $20-500/month (based on session volume)
- Supabase PostgreSQL: Free tier available, Pro $25/month
- Google Gemini API: $50-200/month
- 1Password: $20-60/month
- n8n: $20-80/month (self-hosted) or $50-250/month (cloud)

---

## 🚢 Deployment

### Vercel Deployment

1. **Push code to GitHub:**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Connect to Vercel:**
   - Visit [vercel.com](https://vercel.com)
   - Click "Import Project"
   - Select your GitHub repository
   - Configure environment variables
   - Deploy

3. **Configure domains:**
   - Add custom domain in Vercel dashboard
   - Update DNS records

### n8n Self-Hosted Deployment

1. **Deploy n8n on VPS:**
   ```bash
   docker run -d --name n8n \
     -p 5678:5678 \
     -v ~/.n8n:/home/node/.n8n \
     n8nio/n8n
   ```

2. **Import workflows:**
   - Access n8n at http://your-server:5678
   - Import workflow JSON files
   - Configure credentials

3. **Set up webhooks:**
   - Copy webhook URLs from n8n
   - Update environment variables in Vercel

---

## 🧪 Testing

Run unit tests:
```bash
pnpm test
```

Run specific test file:
```bash
pnpm test server/auth.logout.test.ts
```

---

## 📖 API Documentation

### tRPC Endpoints

**Authentication:**
- `auth.me` - Get current user
- `auth.logout` - Logout user

**System:**
- `system.notifyOwner` - Send notification to project owner

### Adding New Endpoints

1. Define procedure in `server/routers.ts`:
   ```typescript
   myFeature: router({
     list: protectedProcedure.query(({ ctx }) => {
       return db.getItems(ctx.user.id);
     }),
   }),
   ```

2. Use in frontend:
   ```typescript
   const { data } = trpc.myFeature.list.useQuery();
   ```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is proprietary software. All rights reserved.

---

## 🆘 Support

For technical support or questions:
- **Email:** support@bottleneckbots.com
- **Documentation:** https://docs.bottleneckbots.com
- **GitHub Issues:** https://github.com/Julianb233/bottleneck-bot/issues

---

## 🙏 Acknowledgments

- **Browserbase** - Cloud browser infrastructure
- **Stagehand** - AI-powered browser automation framework
- **Google Gemini** - AI agent intelligence
- **n8n** - Workflow automation platform
- **Manus** - Development and deployment platform

---

**Built with ❤️ by AI Acrobatics**
