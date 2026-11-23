import { and, eq, ne, sql } from "drizzle-orm";
import { getMember } from "../../../../../server/access";
import { getDb } from "../../../../../server/db";
import { forbidden, sameOrigin, unauthorized } from "../../../../../server/http";
import { validRole } from "../../../../../server/security";
import { auditEvents, jobs, memberships } from "../../../../../server/schema";
import { canManageStaff, requiresHiringManagerReassignment } from "../../../../../server/policy";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "Request origin was not accepted." }, { status: 403 });
  const member = await getMember(request.headers);
  if (!member) return unauthorized();
  if (!canManageStaff(member.role)) return forbidden();
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { role?: unknown } | null;
  const role = body?.role;
  if (!validRole(role)) return Response.json({ error: "Choose a valid staff role." }, { status: 400 });
  const db = getDb();
  const failure = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('recruiting_admin_membership_changes'))`);
    const [target] = await tx.select().from(memberships).where(and(
      eq(memberships.id, id), eq(memberships.workspaceId, member.workspaceId),
    )).limit(1);
    if (!target) return { status: 404, error: "Staff member not found." };
    const assignedJobs = target.role === "hiring_manager" && role !== "hiring_manager"
      ? await tx.select({ id: jobs.id }).from(jobs).where(and(
        eq(jobs.workspaceId, member.workspaceId), eq(jobs.hiringManagerId, target.userId),
      ))
      : [];
    if (requiresHiringManagerReassignment(target.role, role, assignedJobs.length)) {
      return { status: 409, error: `Reassign the Hiring Manager on ${assignedJobs.length} ${assignedJobs.length === 1 ? "job" : "jobs"} before changing this person's role.` };
    }
    if (target.role === "admin" && target.active && role !== "admin") {
      const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(memberships)
        .where(and(eq(memberships.workspaceId, member.workspaceId), eq(memberships.role, "admin"), eq(memberships.active, true), ne(memberships.userId, target.userId)));
      if (count === 0) return { status: 409, error: "The workspace must keep at least one active Admin." };
    }
    await tx.update(memberships).set({ role, updatedAt: new Date() }).where(eq(memberships.id, target.id));
    await tx.insert(auditEvents).values({
      workspaceId: member.workspaceId, actorUserId: member.userId, action: "staff.role_changed", entityType: "workspace_member", entityId: target.id,
      details: { previousRole: target.role, role },
    });
    return null;
  });
  if (failure) return Response.json({ error: failure.error }, { status: failure.status });
  return Response.json({ success: true });
}
