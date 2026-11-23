import { and, eq, inArray } from "drizzle-orm";
import { getMember } from "../../../../server/access";
import { getDb } from "../../../../server/db";
import { canManageJobs } from "../../../../server/policy";
import { isUuid, parseJobInput } from "../../../../server/recruiting";
import { auditEvents, jobAssignments, jobs, memberships } from "../../../../server/schema";
import { sameOrigin, unauthorized } from "../../../../server/http";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "Request origin was not accepted." }, { status: 403 });
  const member = await getMember(request.headers);
  if (!member) return unauthorized();
  if (!canManageJobs(member.role)) return Response.json({ error: "Only Admins and Recruiters can manage jobs." }, { status: 403 });
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: "Job not found." }, { status: 404 });
  const body = await request.json().catch(() => null);
  const parsed = parseJobInput(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const db = getDb();
  const [existing] = await db.select({ id: jobs.id }).from(jobs)
    .where(and(eq(jobs.id, id), eq(jobs.workspaceId, member.workspaceId))).limit(1);
  if (!existing) return Response.json({ error: "Job not found." }, { status: 404 });
  const userIds = [parsed.data.hiringManagerId, ...parsed.data.interviewerIds];
  const staff = await db.select({ userId: memberships.userId, role: memberships.role }).from(memberships)
    .where(and(eq(memberships.workspaceId, member.workspaceId), eq(memberships.active, true), inArray(memberships.userId, userIds)));
  if (!staff.some((row) => row.userId === parsed.data.hiringManagerId && row.role === "hiring_manager")) {
    return Response.json({ error: "Choose an active Hiring Manager from this workspace." }, { status: 400 });
  }
  if (parsed.data.interviewerIds.some((userId) => !staff.some((row) => row.userId === userId && row.role === "interviewer"))) {
    return Response.json({ error: "Choose only active Interviewers from this workspace." }, { status: 400 });
  }
  await db.transaction(async (tx) => {
    await tx.update(jobs).set({
      title: parsed.data.title,
      department: parsed.data.department,
      location: parsed.data.location,
      employmentType: parsed.data.employmentType,
      remote: parsed.data.remote,
      description: parsed.data.description,
      hiringManagerId: parsed.data.hiringManagerId,
      updatedAt: new Date(),
    }).where(and(eq(jobs.id, id), eq(jobs.workspaceId, member.workspaceId)));
    await tx.delete(jobAssignments).where(and(eq(jobAssignments.workspaceId, member.workspaceId), eq(jobAssignments.jobId, id)));
    await tx.insert(jobAssignments).values([parsed.data.hiringManagerId, ...parsed.data.interviewerIds].map((userId) => ({
      workspaceId: member.workspaceId, jobId: id, userId, assignedBy: member.userId,
    })));
    await tx.insert(auditEvents).values({
      workspaceId: member.workspaceId, actorUserId: member.userId, action: "job.edited", entityType: "job", entityId: id,
      details: { title: parsed.data.title },
    });
  });
  return Response.json({ success: true });
}
