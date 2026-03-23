-- GHL Webhook Processing: contacts, opportunities, event dedup, dead letter queue
-- Linear: AI-5147

-- Synced contacts from GHL webhooks
CREATE TABLE IF NOT EXISTS "ghl_contacts" (
  "id" serial PRIMARY KEY NOT NULL,
  "userId" integer NOT NULL REFERENCES "users"("id"),
  "ghlContactId" varchar(128) NOT NULL,
  "locationId" varchar(128) NOT NULL,
  "firstName" text,
  "lastName" text,
  "email" varchar(320),
  "phone" varchar(30),
  "tags" jsonb,
  "source" varchar(128),
  "customFields" jsonb,
  "lastWebhookAt" timestamp NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ghl_contacts_ghl_id_idx" ON "ghl_contacts" ("ghlContactId", "locationId");
CREATE INDEX IF NOT EXISTS "ghl_contacts_user_idx" ON "ghl_contacts" ("userId");
CREATE INDEX IF NOT EXISTS "ghl_contacts_location_idx" ON "ghl_contacts" ("locationId");
CREATE INDEX IF NOT EXISTS "ghl_contacts_email_idx" ON "ghl_contacts" ("email");

-- Synced opportunities from GHL webhooks
CREATE TABLE IF NOT EXISTS "ghl_opportunities" (
  "id" serial PRIMARY KEY NOT NULL,
  "userId" integer NOT NULL REFERENCES "users"("id"),
  "ghlOpportunityId" varchar(128) NOT NULL,
  "locationId" varchar(128) NOT NULL,
  "name" text,
  "pipelineId" varchar(128),
  "pipelineStageId" varchar(128),
  "status" varchar(64),
  "monetaryValue" numeric(12, 2),
  "ghlContactId" varchar(128),
  "lastWebhookAt" timestamp NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ghl_opportunities_ghl_id_idx" ON "ghl_opportunities" ("ghlOpportunityId", "locationId");
CREATE INDEX IF NOT EXISTS "ghl_opportunities_user_idx" ON "ghl_opportunities" ("userId");
CREATE INDEX IF NOT EXISTS "ghl_opportunities_location_idx" ON "ghl_opportunities" ("locationId");
CREATE INDEX IF NOT EXISTS "ghl_opportunities_pipeline_idx" ON "ghl_opportunities" ("pipelineId");
CREATE INDEX IF NOT EXISTS "ghl_opportunities_status_idx" ON "ghl_opportunities" ("status");

-- Webhook event log for deduplication
CREATE TABLE IF NOT EXISTS "ghl_webhook_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "eventId" varchar(256) NOT NULL UNIQUE,
  "eventType" varchar(128) NOT NULL,
  "locationId" varchar(128),
  "processedAt" timestamp DEFAULT now() NOT NULL,
  "success" boolean NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ghl_webhook_events_event_id_idx" ON "ghl_webhook_events" ("eventId");
CREATE INDEX IF NOT EXISTS "ghl_webhook_events_type_idx" ON "ghl_webhook_events" ("eventType");
CREATE INDEX IF NOT EXISTS "ghl_webhook_events_processed_at_idx" ON "ghl_webhook_events" ("processedAt");

-- Dead letter queue for failed webhook events
CREATE TABLE IF NOT EXISTS "ghl_webhook_dead_letters" (
  "id" serial PRIMARY KEY NOT NULL,
  "eventId" varchar(256),
  "eventType" varchar(128) NOT NULL,
  "locationId" varchar(128),
  "payload" jsonb NOT NULL,
  "error" text NOT NULL,
  "retryCount" integer DEFAULT 0 NOT NULL,
  "maxRetries" integer DEFAULT 3 NOT NULL,
  "lastRetriedAt" timestamp,
  "resolved" boolean DEFAULT false NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ghl_webhook_dlq_resolved_idx" ON "ghl_webhook_dead_letters" ("resolved");
CREATE INDEX IF NOT EXISTS "ghl_webhook_dlq_type_idx" ON "ghl_webhook_dead_letters" ("eventType");
CREATE INDEX IF NOT EXISTS "ghl_webhook_dlq_created_at_idx" ON "ghl_webhook_dead_letters" ("createdAt");
