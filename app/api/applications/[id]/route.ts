import { and, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getMember } from "../../../../server/access";
import { getDb } from "../../../../server/db";
import { canAccessApplication, isUuid } from "../../../../server/recruiting";
import { applicationStageHistory, applications, candidates, jobs, user } from "../../../../server/schema";
import { unauthorized } from "../../../../server/http";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const member = await getMember(request.headers);
  if (!member) return unauthorized();
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: "Application not found." }, { status: 404 });
  const [application] = await getDb().select({
    id: applications.id,
    candidateId: applications.candidateId,
    stage: applications.stage,
    createdAt: applications.createdAt,
    jobId: applications.jobId,
    jobTitle: jobs.title,
    applicantName: applications.applicantName,
    applicantEmail: applications.applicantEmail,
    phone: applications.phone,
    portfolioUrl: applications.portfolioUrl,
    coverNote: applications.coverNote,
    resumeName: applications.resumeName,
    candidateName: candidates.name,
    candidateEmail: candidates.email,
  }).from(applications).innerJoin(jobs, and(eq(applications.jobId, jobs.id), eq(jobs.workspaceId, member.workspaceId)))
    .innerJoin(candidates, and(eq(applications.candidateId, candidates.id), eq(candidates.workspaceId, member.workspaceId)))
    .where(and(eq(applications.id, id), eq(applications.workspaceId, member.workspaceId))).limit(1);
  if (!application) return Response.json({ error: "Application not found." }, { status: 404 });
  if (!await canAccessApplication(member, application.jobId)) return Response.json({ error: "You do not have access to this application." }, { status: 403 });
  const actor = alias(user, "stage_history_actor");
  const stageHistory = await getDb().select({
    id: applicationStageHistory.id,
    fromStage: applicationStageHistory.fromStage,
    toStage: applicationStageHistory.toStage,
    createdAt: applicationStageHistory.createdAt,
    actorName: actor.name,
  }).from(applicationStageHistory).leftJoin(actor, eq(applicationStageHistory.actorUserId, actor.id))
    .where(and(
      eq(applicationStageHistory.workspaceId, member.workspaceId),
      eq(applicationStageHistory.applicationId, id),
    )).orderBy(applicationStageHistory.createdAt);
  return Response.json({ application: {
    ...application,
    applicantName: application.applicantName || application.candidateName,
    applicantEmail: application.applicantEmail || application.candidateEmail,
  }, stageHistory });
}
