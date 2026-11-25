ALTER TABLE "interview" ADD COLUMN "ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "interview" ADD COLUMN "time_zone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "interview" ADD COLUMN "location" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "interview" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;