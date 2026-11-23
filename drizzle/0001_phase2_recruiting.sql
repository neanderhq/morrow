CREATE TYPE "public"."employment_type" AS ENUM('full_time', 'part_time', 'contract');--> statement-breakpoint
CREATE TABLE "job_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"assigned_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_assignment_workspace_job_user_unique" UNIQUE("workspace_id","job_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "applicant_name" text;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "applicant_email" text;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "portfolio_url" text;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "cover_note" text;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "resume_data" "bytea";--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "resume_name" text;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "resume_type" text;--> statement-breakpoint
ALTER TABLE "job" ADD COLUMN "location" text DEFAULT 'Not specified' NOT NULL;--> statement-breakpoint
ALTER TABLE "job" ADD COLUMN "employment_type" "employment_type" DEFAULT 'full_time' NOT NULL;--> statement-breakpoint
ALTER TABLE "job" ADD COLUMN "remote" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "job" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "job" ADD COLUMN "hiring_manager_id" text;--> statement-breakpoint
ALTER TABLE "job_assignment" ADD CONSTRAINT "job_assignment_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_assignment" ADD CONSTRAINT "job_assignment_assigned_by_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_assignment" ADD CONSTRAINT "job_assignment_job_workspace_fk" FOREIGN KEY ("workspace_id","job_id") REFERENCES "public"."job"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_assignment" ADD CONSTRAINT "job_assignment_member_workspace_fk" FOREIGN KEY ("workspace_id","user_id") REFERENCES "public"."workspace_member"("workspace_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_assignment_workspace_user_idx" ON "job_assignment" USING btree ("workspace_id","user_id");--> statement-breakpoint
ALTER TABLE "job" ADD CONSTRAINT "job_hiring_manager_id_user_id_fk" FOREIGN KEY ("hiring_manager_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job" ADD CONSTRAINT "job_hiring_manager_workspace_fk" FOREIGN KEY ("workspace_id","hiring_manager_id") REFERENCES "public"."workspace_member"("workspace_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_workspace_job_email_unique" UNIQUE("workspace_id","job_id","applicant_email");