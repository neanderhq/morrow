CREATE TABLE "application_note" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"author_user_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_note_body_check" CHECK (length(trim("application_note"."body")) between 1 and 5000)
);
--> statement-breakpoint
CREATE TABLE "application_stage_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"from_stage" text,
	"to_stage" text NOT NULL,
	"actor_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_stage_history_from_stage_check" CHECK ("application_stage_history"."from_stage" is null or "application_stage_history"."from_stage" in ('applied', 'screening', 'interview', 'offer', 'hired', 'rejected')),
	CONSTRAINT "application_stage_history_to_stage_check" CHECK ("application_stage_history"."to_stage" in ('applied', 'screening', 'interview', 'offer', 'hired', 'rejected'))
);
--> statement-breakpoint
ALTER TABLE "application_note" ADD CONSTRAINT "application_note_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_note" ADD CONSTRAINT "application_note_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_note" ADD CONSTRAINT "application_note_application_workspace_fk" FOREIGN KEY ("workspace_id","application_id") REFERENCES "public"."application"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_stage_history" ADD CONSTRAINT "application_stage_history_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_stage_history" ADD CONSTRAINT "application_stage_history_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_stage_history" ADD CONSTRAINT "application_stage_history_application_workspace_fk" FOREIGN KEY ("workspace_id","application_id") REFERENCES "public"."application"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_note_workspace_application_idx" ON "application_note" USING btree ("workspace_id","application_id","created_at");--> statement-breakpoint
CREATE INDEX "application_stage_history_workspace_application_idx" ON "application_stage_history" USING btree ("workspace_id","application_id","created_at");--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_stage_check" CHECK ("application"."stage" in ('applied', 'screening', 'interview', 'offer', 'hired', 'rejected'));
--> statement-breakpoint
INSERT INTO "application_stage_history" ("workspace_id", "application_id", "from_stage", "to_stage", "actor_user_id", "created_at")
SELECT "workspace_id", "id", NULL, "stage", NULL, "created_at"
FROM "application";
--> statement-breakpoint
CREATE FUNCTION "prevent_application_stage_history_mutation"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND NOT EXISTS (
    SELECT 1 FROM "application" WHERE "workspace_id" = OLD."workspace_id" AND "id" = OLD."application_id"
  ) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Application stage history is immutable';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "application_stage_history_immutable"
BEFORE UPDATE OR DELETE ON "application_stage_history"
FOR EACH ROW EXECUTE FUNCTION "prevent_application_stage_history_mutation"();
