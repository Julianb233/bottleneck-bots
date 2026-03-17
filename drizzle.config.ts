import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

export default defineConfig({
  schema: [
    "./drizzle/schema.ts",
    "./drizzle/schema-admin.ts",
    "./drizzle/schema-agent.ts",
    "./drizzle/schema-alerts.ts",
    "./drizzle/schema-auth.ts",
    "./drizzle/schema-costs.ts",
    "./drizzle/schema-email.ts",
    "./drizzle/schema-knowledge.ts",
    "./drizzle/schema-lead-enrichment.ts",
    "./drizzle/schema-memory.ts",
    "./drizzle/schema-meta-ads.ts",
    "./drizzle/schema-rag.ts",
    "./drizzle/schema-scheduled-tasks.ts",
    "./drizzle/schema-security.ts",
    "./drizzle/schema-seo.ts",
    "./drizzle/schema-sop.ts",
    "./drizzle/schema-subscriptions.ts",
    "./drizzle/schema-webhooks.ts",
    "./drizzle/schema-support.ts",
    "./drizzle/schema-task-templates.ts",
    "./drizzle/schema-ghl-locations.ts",
    "./drizzle/relations.ts",
    "./server/rag/schema.ts",
  ],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  },
});
