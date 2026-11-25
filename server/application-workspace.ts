import { and, eq, sql } from "drizzle-orm";
import { getMember, type ActiveMember } from "./access";
import { getDb } from "./db";
import { sameOrigin, unauthorized } from "./http";
import { canAccessApplication, isUuid } from "./recruiting";
import { applications, candidates, jobAssignments, jobs, memberships, user } from "./schema";

export type ApplicationParams = { params: Promise<{ id: string }> };
export type WorkspaceTransaction = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

export function problem(error: string, status = 400) {
  return Response.json({ error }, { status });
}

export async function applicationWorkspace(request: Request, context: ApplicationParams) {
  if (request.method !== "GET" && !sameOrigin(request)) return problem("Request origin was not accepted.", 403);
  const member = await getMember(request.headers);
  if (!member) return unauthorized();
  const { id } = await context.params;
  if (!isUuid(id)) return problem("Application not found.", 404);
  const [application] = await getDb().select({
    id: applications.id, jobId: applications.jobId, stage: applications.stage, jobState: jobs.state,
    jobTitle: jobs.title, hiringManagerId: jobs.hiringManagerId,
    recipient: sql<string | null>`coalesce(${applications.applicantEmail}, ${candidates.email})`,
  }).from(applications)
    .innerJoin(jobs, and(eq(jobs.id, applications.jobId), eq(jobs.workspaceId, applications.workspaceId)))
    .innerJoin(candidates, and(eq(candidates.id, applications.candidateId), eq(candidates.workspaceId, applications.workspaceId)))
    .where(and(eq(applications.id, id), eq(applications.workspaceId, member.workspaceId))).limit(1);
  if (!application) return problem("Application not found.", 404);
  if (!await canAccessApplication(member, application.jobId)) return problem("You do not have access to this application.", 403);
  return { member, application };
}

export type ApplicationWorkspace = Exclude<Awaited<ReturnType<typeof applicationWorkspace>>, Response>;

export function assignedInterviewers(db: ReturnType<typeof getDb> | WorkspaceTransaction, workspaceId: string, jobId: string) {
  return db.select({ id: user.id, name: user.name }).from(jobAssignments)
    .innerJoin(memberships, and(eq(memberships.workspaceId, jobAssignments.workspaceId), eq(memberships.userId, jobAssignments.userId)))
    .innerJoin(user, eq(user.id, jobAssignments.userId))
    .where(and(eq(jobAssignments.workspaceId, workspaceId), eq(jobAssignments.jobId, jobId),
      eq(memberships.active, true), eq(memberships.role, "interviewer"))).orderBy(user.name);
}

export function lockRecruitingRecord(tx: WorkspaceTransaction, id: string) {
  return tx.execute(sql`select pg_advisory_xact_lock(hashtext(${id}))`);
}

export function canReviewApplication(member: ActiveMember, hiringManagerId: string | null) {
  return member.role === "admin" || member.role === "recruiter" ||
    (member.role === "hiring_manager" && member.userId === hiringManagerId);
}
