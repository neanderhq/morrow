import { and, eq, isNull } from "drizzle-orm";
import { getAuth } from "../../../../server/auth";
import { getDb } from "../../../../server/db";
import { sameOrigin } from "../../../../server/http";
import { hashActionToken, validPassword } from "../../../../server/security";
import { auditEvents, invitations, memberships, user } from "../../../../server/schema";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request origin was not accepted." }, { status: 403 });
  const body = await request.json().catch(() => null) as { token?: string; name?: string; password?: string } | null;
  const token = body?.token ?? "";
  const name = body?.name?.trim();
  const password = body?.password ?? "";
  if (token.length < 32 || !name || name.length > 120) return Response.json({ error: "This invitation is invalid or incomplete." }, { status: 400 });
  if (!validPassword(password)) return Response.json({ error: "Password must be at least 12 characters." }, { status: 400 });
  try {
    const db = getDb();
    await db.transaction(async (tx) => {
      const [invite] = await tx.select().from(invitations).where(and(
        eq(invitations.tokenHash, hashActionToken(token)),
        isNull(invitations.acceptedAt),
      )).for("update").limit(1);
      if (!invite || invite.expiresAt.getTime() < Date.now()) throw new Error("This invitation has expired or was already used. Ask an Admin for a new link.");
      const signedUp = await getAuth().api.signUpEmail({ body: { name, email: invite.email, password } });
      const [account] = await tx.select({ email: user.email }).from(user).where(eq(user.id, signedUp.user.id)).limit(1);
      if (!account) throw new Error("Account creation did not complete.");
      const [membership] = await tx.insert(memberships).values({ workspaceId: invite.workspaceId, userId: signedUp.user.id, role: invite.role }).returning({ id: memberships.id });
      await tx.insert(auditEvents).values({
        workspaceId: invite.workspaceId,
        actorUserId: signedUp.user.id,
        action: "staff.invitation_accepted",
        entityType: "workspace_member",
        entityId: membership.id,
        details: { email: invite.email, role: invite.role },
      });
      await tx.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.id, invite.id));
    });
    return Response.json({ success: true, message: "Your account is ready. Sign in to continue." }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The invitation could not be accepted." }, { status: 400 });
  }
}
