CREATE TABLE "rejection_email" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"stage_event_id" uuid NOT NULL,
	"sender" text NOT NULL,
	"recipient" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"provider_message_id" text,
	"reason" text,
	"created_by" text NOT NULL,
	"dispatched_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rejection_email_stage_unique" UNIQUE("stage_event_id"),
	CONSTRAINT "rejection_email_status_check" CHECK ("rejection_email"."status" in ('queued', 'sending', 'accepted', 'failed', 'unknown', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "rejection_email" ADD CONSTRAINT "rejection_email_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rejection_email" ADD CONSTRAINT "rejection_email_stage_event_id_application_stage_history_id_fk" FOREIGN KEY ("stage_event_id") REFERENCES "public"."application_stage_history"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rejection_email" ADD CONSTRAINT "rejection_email_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rejection_email" ADD CONSTRAINT "rejection_email_dispatched_by_user_id_fk" FOREIGN KEY ("dispatched_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rejection_email" ADD CONSTRAINT "rejection_email_application_fk" FOREIGN KEY ("workspace_id","application_id") REFERENCES "public"."application"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rejection_email_application_history_idx" ON "rejection_email" USING btree ("workspace_id","application_id","created_at");