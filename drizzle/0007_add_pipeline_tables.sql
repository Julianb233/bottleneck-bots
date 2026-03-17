-- Multi-Step Workflow Pipelines
-- Supports chained workflow execution with data passing between steps

CREATE TABLE IF NOT EXISTS "workflow_pipelines" (
  "id" serial PRIMARY KEY NOT NULL,
  "userId" integer NOT NULL REFERENCES "users"("id"),
  "name" text NOT NULL,
  "description" text,
  "steps" jsonb NOT NULL,
  "trigger" varchar(20) DEFAULT 'manual' NOT NULL,
  "isActive" boolean DEFAULT true NOT NULL,
  "executionCount" integer DEFAULT 0 NOT NULL,
  "lastExecutedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "workflow_pipelines_user_id_idx" ON "workflow_pipelines" ("userId");
CREATE INDEX IF NOT EXISTS "workflow_pipelines_is_active_idx" ON "workflow_pipelines" ("isActive");

CREATE TABLE IF NOT EXISTS "pipeline_executions" (
  "id" serial PRIMARY KEY NOT NULL,
  "pipelineId" integer NOT NULL REFERENCES "workflow_pipelines"("id"),
  "userId" integer NOT NULL REFERENCES "users"("id"),
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "input" jsonb,
  "output" jsonb,
  "error" text,
  "currentStepIndex" integer DEFAULT 0 NOT NULL,
  "totalSteps" integer NOT NULL,
  "stepResults" jsonb,
  "startedAt" timestamp,
  "completedAt" timestamp,
  "duration" integer,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "pipeline_executions_pipeline_id_idx" ON "pipeline_executions" ("pipelineId");
CREATE INDEX IF NOT EXISTS "pipeline_executions_user_id_idx" ON "pipeline_executions" ("userId");
CREATE INDEX IF NOT EXISTS "pipeline_executions_status_idx" ON "pipeline_executions" ("status");
