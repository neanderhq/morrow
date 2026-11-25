CREATE TABLE "interview_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"interviewer_id" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"ratings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"recommendation" text DEFAULT '' NOT NULL,
	"submitted_at" timestamp with time zone,
	CONSTRAINT "interview_feedback_round_interviewer_unique" UNIQUE("workspace_id","round_id","interviewer_id")
);
--> statement-breakpoint
CREATE TABLE "interview_review_round" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"rubric_id" uuid NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interview_review_round_workspace_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "interview_review_round_application_unique" UNIQUE("workspace_id","application_id")
);
--> statement-breakpoint
CREATE TABLE "job_interview_rubric" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"criteria" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_interview_rubric_workspace_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "job_interview_rubric_job_version_unique" UNIQUE("workspace_id","job_id","version")
);
--> statement-breakpoint
ALTER TABLE "interview_feedback" ADD CONSTRAINT "interview_feedback_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_feedback" ADD CONSTRAINT "interview_feedback_round_fk" FOREIGN KEY ("workspace_id","round_id") REFERENCES "public"."interview_review_round"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_feedback" ADD CONSTRAINT "interview_feedback_interviewer_fk" FOREIGN KEY ("workspace_id","interviewer_id") REFERENCES "public"."workspace_member"("workspace_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_review_round" ADD CONSTRAINT "interview_review_round_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_review_round" ADD CONSTRAINT "interview_review_round_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_review_round" ADD CONSTRAINT "interview_review_round_application_fk" FOREIGN KEY ("workspace_id","application_id") REFERENCES "public"."application"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_review_round" ADD CONSTRAINT "interview_review_round_rubric_fk" FOREIGN KEY ("workspace_id","rubric_id") REFERENCES "public"."job_interview_rubric"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_interview_rubric" ADD CONSTRAINT "job_interview_rubric_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_interview_rubric" ADD CONSTRAINT "job_interview_rubric_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_interview_rubric" ADD CONSTRAINT "job_interview_rubric_job_fk" FOREIGN KEY ("workspace_id","job_id") REFERENCES "public"."job"("workspace_id","id") ON DELETE no action ON UPDATE no action;