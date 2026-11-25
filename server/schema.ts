import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export * from "./auth-schema";

export const staffRole = pgEnum("staff_role", ["admin", "recruiter", "hiring_manager", "interviewer"]);
export const jobState = pgEnum("job_state", ["draft", "published", "closed"]);
export const employmentType = pgEnum("employment_type", ["full_time", "part_time", "contract"]);
const binary = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

export const workspaces = pgTable("workspace", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  singletonKey: text("singleton_key").default("primary").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const memberships = pgTable("workspace_member", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  role: staffRole("role").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("workspace_member_user_unique").on(table.userId),
  unique("workspace_member_workspace_user_unique").on(table.workspaceId, table.userId),
  unique("workspace_member_workspace_id_unique").on(table.workspaceId, table.id),
  index("workspace_member_workspace_active_idx").on(table.workspaceId, table.active),
]);

export const invitations = pgTable("staff_invitation", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: staffRole("role").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  encryptedToken: text("encrypted_token"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdBy: text("created_by").notNull().references(() => user.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("staff_invitation_workspace_email_idx").on(table.workspaceId, table.email)]);

export const passwordResetLinks = pgTable("password_reset_link", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  encryptedUrl: text("encrypted_url").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const jobs = pgTable("job", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  department: text("department"),
  location: text("location").default("Not specified").notNull(),
  employmentType: employmentType("employment_type").default("full_time").notNull(),
  remote: boolean("remote").default(false).notNull(),
  description: text("description").default("").notNull(),
  hiringManagerId: text("hiring_manager_id").references(() => user.id),
  state: jobState("state").default("draft").notNull(),
  reopenState: jobState("reopen_state"),
  createdBy: text("created_by").notNull().references(() => user.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("job_workspace_id_unique").on(table.workspaceId, table.id),
  foreignKey({ name: "job_hiring_manager_workspace_fk", columns: [table.workspaceId, table.hiringManagerId], foreignColumns: [memberships.workspaceId, memberships.userId] }),
  index("job_workspace_state_idx").on(table.workspaceId, table.state),
]);

export const jobAssignments = pgTable("job_assignment", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").notNull(),
  userId: text("user_id").notNull(),
  assignedBy: text("assigned_by").notNull().references(() => user.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("job_assignment_workspace_job_user_unique").on(table.workspaceId, table.jobId, table.userId),
  foreignKey({ name: "job_assignment_job_workspace_fk", columns: [table.workspaceId, table.jobId], foreignColumns: [jobs.workspaceId, jobs.id] }),
  foreignKey({ name: "job_assignment_member_workspace_fk", columns: [table.workspaceId, table.userId], foreignColumns: [memberships.workspaceId, memberships.userId] }),
  index("job_assignment_workspace_user_idx").on(table.workspaceId, table.userId),
]);

export const candidates = pgTable("candidate", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email"),
  resumePath: text("resume_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [unique("candidate_workspace_id_unique").on(table.workspaceId, table.id), index("candidate_workspace_email_idx").on(table.workspaceId, table.email)]);

export const applicationSubmissionLimits = pgTable("application_submission_limit", {
  clientKeyHash: text("client_key_hash").primaryKey(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
  requestCount: integer("request_count").notNull(),
}, (table) => [index("application_submission_limit_window_idx").on(table.windowStartedAt)]);

export const applications = pgTable("application", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").notNull(),
  candidateId: uuid("candidate_id").notNull(),
  applicantName: text("applicant_name"),
  applicantEmail: text("applicant_email"),
  phone: text("phone"),
  portfolioUrl: text("portfolio_url"),
  coverNote: text("cover_note"),
  resumeData: binary("resume_data"),
  resumeName: text("resume_name"),
  resumeType: text("resume_type"),
  stage: text("stage").default("applied").notNull(),
  ownerId: text("owner_id").references(() => user.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("application_workspace_id_unique").on(table.workspaceId, table.id),
  unique("application_workspace_job_email_unique").on(table.workspaceId, table.jobId, table.applicantEmail),
  foreignKey({ name: "application_job_workspace_fk", columns: [table.workspaceId, table.jobId], foreignColumns: [jobs.workspaceId, jobs.id] }),
  foreignKey({ name: "application_candidate_workspace_fk", columns: [table.workspaceId, table.candidateId], foreignColumns: [candidates.workspaceId, candidates.id] }),
  check("application_stage_check", sql`${table.stage} in ('applied', 'screening', 'interview', 'offer', 'hired', 'rejected')`),
  index("application_workspace_stage_idx").on(table.workspaceId, table.stage),
]);

export const applicationStageHistory = pgTable("application_stage_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  applicationId: uuid("application_id").notNull(),
  fromStage: text("from_stage"),
  toStage: text("to_stage").notNull(),
  actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ name: "application_stage_history_application_workspace_fk", columns: [table.workspaceId, table.applicationId], foreignColumns: [applications.workspaceId, applications.id] }).onDelete("cascade"),
  check("application_stage_history_from_stage_check", sql`${table.fromStage} is null or ${table.fromStage} in ('applied', 'screening', 'interview', 'offer', 'hired', 'rejected')`),
  check("application_stage_history_to_stage_check", sql`${table.toStage} in ('applied', 'screening', 'interview', 'offer', 'hired', 'rejected')`),
  index("application_stage_history_workspace_application_idx").on(table.workspaceId, table.applicationId, table.createdAt),
]);

export const rejectionEmails = pgTable("rejection_email", {
  id: uuid("id").primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  applicationId: uuid("application_id").notNull(),
  stageEventId: uuid("stage_event_id").notNull().references(() => applicationStageHistory.id, { onDelete: "cascade" }),
  sender: text("sender").notNull(),
  recipient: text("recipient").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status").default("queued").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  providerMessageId: text("provider_message_id"),
  reason: text("reason"),
  createdBy: text("created_by").notNull().references(() => user.id),
  dispatchedBy: text("dispatched_by").references(() => user.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("rejection_email_stage_unique").on(table.stageEventId),
  foreignKey({ name: "rejection_email_application_fk", columns: [table.workspaceId, table.applicationId], foreignColumns: [applications.workspaceId, applications.id] }),
  index("rejection_email_application_history_idx").on(table.workspaceId, table.applicationId, table.createdAt),
  check("rejection_email_status_check", sql`${table.status} in ('queued', 'sending', 'accepted', 'failed', 'unknown', 'cancelled')`),
]);

export const applicationNotes = pgTable("application_note", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  applicationId: uuid("application_id").notNull(),
  authorUserId: text("author_user_id").notNull().references(() => user.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ name: "application_note_application_workspace_fk", columns: [table.workspaceId, table.applicationId], foreignColumns: [applications.workspaceId, applications.id] }).onDelete("cascade"),
  check("application_note_body_check", sql`length(trim(${table.body})) between 1 and 5000`),
  index("application_note_workspace_application_idx").on(table.workspaceId, table.applicationId, table.createdAt),
]);

export const auditEvents = pgTable("audit_event", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  details: jsonb("details").default(sql`'{}'::jsonb`).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("audit_event_workspace_created_idx").on(table.workspaceId, table.createdAt)]);

export const jobInterviewRubrics = pgTable("job_interview_rubric", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").notNull(),
  version: integer("version").notNull(),
  criteria: jsonb("criteria").$type<string[]>().notNull(),
  createdBy: text("created_by").notNull().references(() => user.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("job_interview_rubric_workspace_id_unique").on(table.workspaceId, table.id),
  unique("job_interview_rubric_job_version_unique").on(table.workspaceId, table.jobId, table.version),
  foreignKey({ name: "job_interview_rubric_job_fk", columns: [table.workspaceId, table.jobId], foreignColumns: [jobs.workspaceId, jobs.id] }),
]);

export const interviewReviewRounds = pgTable("interview_review_round", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  applicationId: uuid("application_id").notNull(),
  rubricId: uuid("rubric_id").notNull(),
  createdBy: text("created_by").notNull().references(() => user.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("interview_review_round_workspace_id_unique").on(table.workspaceId, table.id),
  unique("interview_review_round_application_unique").on(table.workspaceId, table.applicationId),
  foreignKey({ name: "interview_review_round_application_fk", columns: [table.workspaceId, table.applicationId], foreignColumns: [applications.workspaceId, applications.id] }),
  foreignKey({ name: "interview_review_round_rubric_fk", columns: [table.workspaceId, table.rubricId], foreignColumns: [jobInterviewRubrics.workspaceId, jobInterviewRubrics.id] }),
]);

export const interviewFeedback = pgTable("interview_feedback", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  roundId: uuid("round_id").notNull(),
  interviewerId: text("interviewer_id").notNull(),
  revision: integer("revision").default(0).notNull(),
  ratings: jsonb("ratings").$type<(number | null)[]>().default([]).notNull(),
  notes: text("notes").default("").notNull(),
  recommendation: text("recommendation").default("").notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
}, (table) => [
  unique("interview_feedback_round_interviewer_unique").on(table.workspaceId, table.roundId, table.interviewerId),
  foreignKey({ name: "interview_feedback_round_fk", columns: [table.workspaceId, table.roundId], foreignColumns: [interviewReviewRounds.workspaceId, interviewReviewRounds.id] }),
  foreignKey({ name: "interview_feedback_interviewer_fk", columns: [table.workspaceId, table.interviewerId], foreignColumns: [memberships.workspaceId, memberships.userId] }),
]);

export const interviews = pgTable("interview", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  applicationId: uuid("application_id").notNull(),
  interviewerId: text("interviewer_id").notNull().references(() => user.id),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  timeZone: text("time_zone").default("UTC").notNull(),
  location: text("location").default("").notNull(),
  revision: integer("revision").default(0).notNull(),
  status: text("status").default("scheduled").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("interview_workspace_id_unique").on(table.workspaceId, table.id),
  foreignKey({ name: "interview_application_workspace_fk", columns: [table.workspaceId, table.applicationId], foreignColumns: [applications.workspaceId, applications.id] }),
  index("interview_workspace_schedule_idx").on(table.workspaceId, table.scheduledAt),
]);

export const scorecards = pgTable("scorecard", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  interviewId: uuid("interview_id").notNull(),
  authorId: text("author_id").notNull().references(() => user.id),
  ratings: jsonb("ratings").default(sql`'{}'::jsonb`).notNull(),
  recommendation: text("recommendation"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
}, (table) => [
  unique("scorecard_workspace_id_unique").on(table.workspaceId, table.id),
  foreignKey({ name: "scorecard_interview_workspace_fk", columns: [table.workspaceId, table.interviewId], foreignColumns: [interviews.workspaceId, interviews.id] }),
  unique("scorecard_interview_author_unique").on(table.interviewId, table.authorId),
]);

export const offers = pgTable("offer", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  applicationId: uuid("application_id").notNull(),
  status: text("status").default("draft").notNull(),
  details: jsonb("details").default(sql`'{}'::jsonb`).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("offer_workspace_id_unique").on(table.workspaceId, table.id),
  foreignKey({ name: "offer_application_workspace_fk", columns: [table.workspaceId, table.applicationId], foreignColumns: [applications.workspaceId, applications.id] }),
]);

export const reports = pgTable("saved_report", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  definition: jsonb("definition").default(sql`'{}'::jsonb`).notNull(),
  createdBy: text("created_by").notNull().references(() => user.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("saved_report_workspace_idx").on(table.workspaceId)]);

export const workspaceRelations = relations(workspaces, ({ many }) => ({ members: many(memberships), jobs: many(jobs), candidates: many(candidates), applications: many(applications), jobAssignments: many(jobAssignments) }));
