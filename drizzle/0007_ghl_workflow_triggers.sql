-- GHL Workflow Triggers Migration
-- Bidirectional workflow triggers between GHL and Bottleneck Bots platform
-- Linear: AI-2880

CREATE TABLE IF NOT EXISTS "ghl_workflow_triggers" (
  "id" serial PRIMARY KEY NOT NULL,
  "userId" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "description" text,
  "direction" varchar(30) NOT NULL,
  "ghlLocationId" varchar(255) NOT NULL,
  "ghlWorkflowId" varchar(255),
  "ghlEventType" varchar(100),
  "platformWorkflowId" integer REFERENCES "automation_workflows"("id") ON DELETE SET NULL,
  "fieldMapping" jsonb,
  "filterConditions" jsonb,
  "isActive" boolean DEFAULT true NOT NULL,
  "triggerCount" integer DEFAULT 0 NOT NULL,
  "lastTriggeredAt" timestamp,
  "lastError" text,
  "errorCount" integer DEFAULT 0 NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ghl_triggers_user_id_idx" ON "ghl_workflow_triggers" ("userId");
CREATE INDEX IF NOT EXISTS "ghl_triggers_direction_idx" ON "ghl_workflow_triggers" ("direction");
CREATE INDEX IF NOT EXISTS "ghl_triggers_location_idx" ON "ghl_workflow_triggers" ("ghlLocationId");
CREATE INDEX IF NOT EXISTS "ghl_triggers_event_type_idx" ON "ghl_workflow_triggers" ("ghlEventType");
CREATE INDEX IF NOT EXISTS "ghl_triggers_is_active_idx" ON "ghl_workflow_triggers" ("isActive");
CREATE INDEX IF NOT EXISTS "ghl_triggers_user_location_idx" ON "ghl_workflow_triggers" ("userId", "ghlLocationId");
CREATE INDEX IF NOT EXISTS "ghl_triggers_event_lookup_idx" ON "ghl_workflow_triggers" ("ghlLocationId", "ghlEventType", "isActive");

CREATE TABLE IF NOT EXISTS "ghl_webhook_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "ghlLocationId" varchar(255) NOT NULL,
  "eventType" varchar(100) NOT NULL,
  "eventId" varchar(255),
  "payload" jsonb NOT NULL,
  "headers" jsonb,
  "status" varchar(30) DEFAULT 'received' NOT NULL,
  "processingError" text,
  "triggerId" integer REFERENCES "ghl_workflow_triggers"("id") ON DELETE SET NULL,
  "executionId" integer,
  "receivedAt" timestamp DEFAULT now() NOT NULL,
  "processedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ghl_events_user_id_idx" ON "ghl_webhook_events" ("userId");
CREATE INDEX IF NOT EXISTS "ghl_events_location_idx" ON "ghl_webhook_events" ("ghlLocationId");
CREATE INDEX IF NOT EXISTS "ghl_events_event_type_idx" ON "ghl_webhook_events" ("eventType");
CREATE INDEX IF NOT EXISTS "ghl_events_status_idx" ON "ghl_webhook_events" ("status");
CREATE INDEX IF NOT EXISTS "ghl_events_received_at_idx" ON "ghl_webhook_events" ("receivedAt");
CREATE INDEX IF NOT EXISTS "ghl_events_trigger_idx" ON "ghl_webhook_events" ("triggerId");

CREATE TABLE IF NOT EXISTS "ghl_workflow_executions" (
  "id" serial PRIMARY KEY NOT NULL,
  "userId" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "triggerId" integer REFERENCES "ghl_workflow_triggers"("id") ON DELETE SET NULL,
  "ghlLocationId" varchar(255) NOT NULL,
  "ghlWorkflowId" varchar(255) NOT NULL,
  "ghlContactId" varchar(255),
  "inputData" jsonb,
  "status" varchar(30) DEFAULT 'pending' NOT NULL,
  "responseData" jsonb,
  "error" text,
  "sourceType" varchar(50) NOT NULL,
  "sourceId" varchar(255),
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "completedAt" timestamp
);

CREATE INDEX IF NOT EXISTS "ghl_executions_user_id_idx" ON "ghl_workflow_executions" ("userId");
CREATE INDEX IF NOT EXISTS "ghl_executions_trigger_idx" ON "ghl_workflow_executions" ("triggerId");
CREATE INDEX IF NOT EXISTS "ghl_executions_location_idx" ON "ghl_workflow_executions" ("ghlLocationId");
CREATE INDEX IF NOT EXISTS "ghl_executions_status_idx" ON "ghl_workflow_executions" ("status");
CREATE INDEX IF NOT EXISTS "ghl_executions_created_at_idx" ON "ghl_workflow_executions" ("createdAt");
