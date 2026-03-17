CREATE TABLE "ghl_location_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"locationId" varchar(100) NOT NULL,
	"locationName" text,
	"companyId" varchar(100),
	"isActive" boolean DEFAULT false NOT NULL,
	"syncConfig" jsonb,
	"locationDetails" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_template_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"icon" varchar(50),
	"color" varchar(30),
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "task_template_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "task_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer,
	"categorySlug" varchar(50) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"icon" varchar(50),
	"color" varchar(30),
	"taskType" varchar(50) DEFAULT 'custom' NOT NULL,
	"priority" varchar(20) DEFAULT 'medium' NOT NULL,
	"urgency" varchar(20) DEFAULT 'normal' NOT NULL,
	"assignedToBot" boolean DEFAULT true NOT NULL,
	"requiresHumanReview" boolean DEFAULT false NOT NULL,
	"executionType" varchar(30) DEFAULT 'automatic' NOT NULL,
	"steps" jsonb DEFAULT '[]' NOT NULL,
	"executionConfig" jsonb,
	"defaultTags" jsonb DEFAULT '[]',
	"estimatedDuration" integer,
	"difficulty" varchar(20) DEFAULT 'beginner',
	"isSystem" boolean DEFAULT false NOT NULL,
	"isPublished" boolean DEFAULT true NOT NULL,
	"usageCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ghl_location_configs" ADD CONSTRAINT "ghl_location_configs_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_templates_category_idx" ON "task_templates" USING btree ("categorySlug");--> statement-breakpoint
CREATE INDEX "task_templates_user_idx" ON "task_templates" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "task_templates_system_idx" ON "task_templates" USING btree ("isSystem");