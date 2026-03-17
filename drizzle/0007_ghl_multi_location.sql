-- GHL Multi-Location Management
-- Linear: AI-2881

CREATE TABLE IF NOT EXISTS "ghl_locations" (
  "id" serial PRIMARY KEY NOT NULL,
  "userId" integer NOT NULL REFERENCES "users"("id"),
  "locationId" varchar(128) NOT NULL,
  "companyId" varchar(128),
  "name" text,
  "address" text,
  "city" varchar(100),
  "state" varchar(100),
  "country" varchar(100),
  "phone" varchar(30),
  "email" varchar(320),
  "timezone" varchar(64),
  "website" text,
  "logoUrl" text,
  "config" jsonb,
  "isActive" boolean DEFAULT true NOT NULL,
  "lastSyncedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ghl_locations_user_location_idx" ON "ghl_locations" ("userId", "locationId");
CREATE INDEX IF NOT EXISTS "ghl_locations_user_idx" ON "ghl_locations" ("userId");

CREATE TABLE IF NOT EXISTS "ghl_active_location" (
  "id" serial PRIMARY KEY NOT NULL,
  "userId" integer NOT NULL REFERENCES "users"("id") UNIQUE,
  "locationId" varchar(128) NOT NULL,
  "selectedAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ghl_active_location_user_idx" ON "ghl_active_location" ("userId");
