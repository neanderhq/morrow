import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { getMember } from "../../../server/access";
import { getDb } from "../../../server/db";
import { forbidden, sameOrigin, unauthorized } from "../../../server/http";
import { createActionToken, encryptActionToken, hashActionToken, invitationLinksForAdmin, validEmail, validRole } from "../../../server/security";
import { canManageStaff } from "../../../server/policy";
import { auditEvents, invitations, memberships, user } from "../../../server/schema";

export async function GET(request: Request) {
  const member = await getMember(request.headers);
  if (!member) return unauthorized();
  if (!canManageStaff(member.role)) return forbidden();
  const db = getDb();
  const rows = await db.select({ id: invitations.id, email: invitations.email, role: invitations.role, expiresAt: invitations.expiresAt, encryptedToken: invitations.encryptedToken })
    .from(invitations).where(and(eq(invitations.workspaceId, member.workspaceId), isNull(invitations.acceptedAt), gt(invitations.expiresAt, new Date())))
    .orderBy(desc(invitations.createdAt));
  const origin = process.env.BETTER_AUTH_URL || new URL(request.url).origin;
  return Response.json({ invitations: invitationLinksForAdmin(rows, origin) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request origin was not accepted." }, { status: 403 });
  const member = await getMember(request.headers);
  if (!member) return unauthorized();
  if (!canManageStaff(member.role)) return forbidden();
  const body = await request.json().catch(() => null) as { email?: string; role?: unknown } | null;
  const email = body?.email?.trim().toLowerCase();
  if (!email || !validEmail(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  if (!validRole(body?.role)) return Response.json({ error: "Choose a valid staff role." }, { status: 400 });
  const db = getDb();
  const [existing] = await db.select({ id: user.id }).from(user).innerJoin(memberships, eq(user.id, memberships.userId))
    .where(and(eq(memberships.workspaceId, member.workspaceId), eq(user.email, email))).limit(1);
  if (existing) return Response.json({ error: "This email already belongs to the workspace." }, { status: 409 });
  const token = createActionToken();
  await db.delete(invitations).where(and(eq(invitations.workspaceId, member.workspaceId), eq(invitations.email, email), isNull(invitations.acceptedAt)));
  const [invitation] = await db.insert(invitations).values({
    workspaceId: member.workspaceId,
    email,
    role: body.role,
    tokenHash: hashActionToken(token),
    encryptedToken: encryptActionToken(token),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdBy: member.userId,
  }).returning({ id: invitations.id });
  await db.insert(auditEvents).values({
    workspaceId: member.workspaceId, actorUserId: member.userId, action: "staff.invited", entityType: "staff_invitation", entityId: invitation.id, details: { email, role: body.role },
  });
  return Response.json({ expiresInDays: 7, email, role: body.role }, { status: 201 });
}
