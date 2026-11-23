import { and, eq, sql } from "drizzle-orm";
import { getMember } from "../../../../../server/access";
import { getDb } from "../../../../../server/db";
import { canManageJobs } from "../../../../../server/policy";
import { isUuid } from "../../../../../server/recruiting";
import { auditEvents, jobs } from "../../../../../server/schema";
import { nextJobReopenState, nextJobState, type JobStatusAction } from "../../../../../server/job-lifecycle";
import { sameOrigin, unauthorized } from "../../../../../server/http";

function isJobStatusAction(value: unknown): value is JobStatusAction {
  return value === "publish" || value === "close" || value === "reopen";
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "Request origin was not accepted." }, { status: 403 });
  const member = await getMember(request.headers);
  if (!member) return unauthorized();
  if (!canManageJobs(member.role)) return Response.json({ error: "Only Admins and Recruiters can change job status." }, { status: 403 });
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: "Job not found." }, { status: 404 });
  const body = await request.json().catch(() => null) as { action?: unknown } | null;
  const action = body?.action;
  if (!isJobStatusAction(action)) {
    return Response.json({ error: "Choose publish, close, or reopen." }, { status: 400 });
  }
  const db = getDb();
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${id}))`);
    const [job] = await tx.select({ id: jobs.id, state: jobs.state, reopenState: jobs.reopenState }).from(jobs)
      .where(and(eq(jobs.id, id), eq(jobs.workspaceId, member.workspaceId))).limit(1);
    if (!job) return { status: 404, error: "Job not found." };
    const nextState = nextJobState(job.state, action, job.reopenState);
    if (!nextState) return { status: 409, error: "That action is not available for the current job status." };
    await tx.update(jobs).set({
      state: nextState,
      reopenState: nextJobReopenState(job.state, action),
      updatedAt: new Date(),
    })
      .where(and(eq(jobs.id, id), eq(jobs.workspaceId, member.workspaceId)));
    await tx.insert(auditEvents).values({
      workspaceId: member.workspaceId, actorUserId: member.userId,
      action: action === "publish" ? "job.published" : action === "close" ? "job.closed" : "job.reopened",
      entityType: "job", entityId: id, details: { from: job.state, to: nextState },
    });
    return { status: 200, state: nextState };
  });
  if (result.status !== 200) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ state: result.state });
}
