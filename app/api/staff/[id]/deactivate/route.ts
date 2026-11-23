import { and, eq, sql } from "drizzle-orm";
import { getMember } from "../../../../../server/access";
import { getDb } from "../../../../../server/db";
import { forbidden, sameOrigin, unauthorized } from "../../../../../server/http";
import { auditEvents, memberships, session } from "../../../../../server/schema";
import { canManageStaff, wouldDeactivateLastActiveAdmin } from "../../../../../server/policy";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "Request origin was not accepted." }, { status: 403 });
  const member = await getMember(request.headers);
  if (!member) return unauthorized();
  if (!canManageStaff(member.role)) return forbidden();
  const { id } = await context.params;
  const db = getDb();
  const failure = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('recruiting_admin_membership_changes'))`);
    const [target] = await tx.select().from(memberships).where(and(
      eq(memberships.id, id), eq(memberships.workspaceId, member.workspaceId),
    )).limit(1);
    if (!target) return { status: 404, error: "Staff member not found." };
    if (target.role === "admin" && target.active) {
      const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(memberships)
        .where(and(eq(memberships.workspaceId, member.workspaceId), eq(memberships.role, "admin"), eq(memberships.active, true)));
      if (wouldDeactivateLastActiveAdmin(target.role, target.active, count)) return { status: 409, error: "The workspace must keep at least one active Admin." };
    }
    await tx.update(memberships).set({ active: false, updatedAt: new Date() }).where(eq(memberships.id, target.id));
    await tx.delete(session).where(eq(session.userId, target.userId));
    await tx.insert(auditEvents).values({
      workspaceId: member.workspaceId, actorUserId: member.userId, action: "staff.deactivated", entityType: "workspace_member", entityId: target.id,
      details: { targetUserId: target.userId },
    });
    return null;
  });
  if (failure) return Response.json({ error: failure.error }, { status: failure.status });
  return Response.json({ success: true });
}
