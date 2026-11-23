import { and, eq } from "drizzle-orm";
import { getMember } from "../../../../../server/access";
import { getAuth } from "../../../../../server/auth";
import { getDb } from "../../../../../server/db";
import { forbidden, sameOrigin, unauthorized } from "../../../../../server/http";
import { decryptPasswordResetLink, resetLinkForUser } from "../../../../../server/security";
import { auditEvents, memberships, user } from "../../../../../server/schema";
import { canManageStaff } from "../../../../../server/policy";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "Request origin was not accepted." }, { status: 403 });
  const member = await getMember(request.headers);
  if (!member) return unauthorized();
  if (!canManageStaff(member.role)) return forbidden();
  const { id } = await context.params;
  const [target] = await getDb().select({ membershipId: memberships.id, userId: user.id, email: user.email, active: memberships.active })
    .from(memberships).innerJoin(user, eq(memberships.userId, user.id))
    .where(and(eq(memberships.id, id), eq(memberships.workspaceId, member.workspaceId))).limit(1);
  if (!target) return Response.json({ error: "Staff member not found." }, { status: 404 });
  if (!target.active) return Response.json({ error: "Reactivate this staff account before generating a password link." }, { status: 409 });
  const origin = process.env.BETTER_AUTH_URL || new URL(request.url).origin;
  await getAuth().api.requestPasswordReset({ body: { email: target.email, redirectTo: `${origin}/reset-password` } });
  const link = await resetLinkForUser(target.userId);
  if (!link || link.expiresAt.getTime() <= Date.now()) return Response.json({ error: "The reset link was not generated. Try again." }, { status: 500 });
  await getDb().insert(auditEvents).values({
    workspaceId: member.workspaceId,
    actorUserId: member.userId,
    action: "staff.reset_link_created",
    entityType: "workspace_member",
    entityId: target.membershipId,
    details: { email: target.email },
  });
  return Response.json({ resetUrl: decryptPasswordResetLink(link.encryptedUrl), expiresAt: link.expiresAt });
}
