import { and, eq, sql } from "drizzle-orm";
import { getMember } from "../../../../../server/access";
import { getDb } from "../../../../../server/db";
import { canChangeApplicationStage, isApplicationStage } from "../../../../../server/policy";
import { canAccessApplication, isUuid } from "../../../../../server/recruiting";
import { applicationStageHistory, applications, auditEvents } from "../../../../../server/schema";
import { sameOrigin, unauthorized } from "../../../../../server/http";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "Request origin was not accepted." }, { status: 403 });
  const member = await getMember(request.headers);
  if (!member) return unauthorized();
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: "Application not found." }, { status: 404 });
  const body = await request.json().catch(() => null) as { stage?: unknown } | null;
  const stage = body?.stage;
  if (!isApplicationStage(stage)) return Response.json({ error: "Choose a valid application stage." }, { status: 400 });

  const db = getDb();
  const [visible] = await db.select({ jobId: applications.jobId }).from(applications)
    .where(and(eq(applications.id, id), eq(applications.workspaceId, member.workspaceId))).limit(1);
  if (!visible) return Response.json({ error: "Application not found." }, { status: 404 });
  const assigned = await canAccessApplication(member, visible.jobId);
  if (!assigned) return Response.json({ error: "You do not have access to this application." }, { status: 403 });
  if (!canChangeApplicationStage(member.role, assigned)) return Response.json({ error: "You cannot change this application's stage." }, { status: 403 });

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${id}))`);
    const [application] = await tx.select({ stage: applications.stage }).from(applications)
      .where(and(eq(applications.id, id), eq(applications.workspaceId, member.workspaceId))).limit(1);
    if (!application) return { status: 404 as const, error: "Application not found." };
    if (application.stage === stage) return { status: 200 as const, stage: application.stage, changed: false as const };
    await tx.update(applications).set({ stage, updatedAt: new Date() })
      .where(and(eq(applications.id, id), eq(applications.workspaceId, member.workspaceId)));
    const [history] = await tx.insert(applicationStageHistory).values({
      workspaceId: member.workspaceId,
      applicationId: id,
      fromStage: application.stage,
      toStage: stage,
      actorUserId: member.userId,
    }).returning({ id: applicationStageHistory.id, createdAt: applicationStageHistory.createdAt });
    await tx.insert(auditEvents).values({
      workspaceId: member.workspaceId,
      actorUserId: member.userId,
      action: "application.stage_changed",
      entityType: "application",
      entityId: id,
      details: { from: application.stage, to: stage },
    });
    return { status: 200 as const, stage, changed: true as const, history };
  });
  if (result.status !== 200) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ ...result, actorName: result.changed ? member.name : null });
}
