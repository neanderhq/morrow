CREATE TABLE "application_submission_limit" (
	"client_key_hash" text PRIMARY KEY NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"request_count" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job" ADD COLUMN "reopen_state" "job_state";--> statement-breakpoint
CREATE INDEX "application_submission_limit_window_idx" ON "application_submission_limit" USING btree ("window_started_at");