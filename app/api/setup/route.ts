import { eq, sql } from "drizzle-orm";
import { getAuth } from "../../../server/auth";
import { getDb } from "../../../server/db";
import { sameOrigin } from "../../../server/http";
import { validEmail, validPassword } from "../../../server/security";
import { memberships, workspaces } from "../../../server/schema";

export async function GET() {
  const [workspace] = await getDb().select({ id: workspaces.id }).from(workspaces).limit(1);
  return Response.json({ setupRequired: !workspace });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request origin was not accepted." }, { status: 403 });
  const body = await request.json().catch(() => null) as { workspaceName?: string; name?: string; email?: string; password?: string } | null;
  const workspaceName = body?.workspaceName?.trim();
  const name = body?.name?.trim();
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password ?? "";
  if (!workspaceName || workspaceName.length > 120 || !name || name.length > 120 || !email || !validEmail(email)) {
    return Response.json({ error: "Enter a workspace name, your name, and a valid email address." }, { status: 400 });
  }
  if (!validPassword(password)) return Response.json({ error: "Password must be at least 12 characters." }, { status: 400 });

  try {
    await getDb().transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('recruiting_workspace_bootstrap'))`);
      const [existing] = await tx.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.singletonKey, "primary")).limit(1);
      if (existing) throw new Error("Workspace setup has already been completed. Sign in instead.");
      const signedUp = await getAuth().api.signUpEmail({ body: { name, email, password } });
      const [workspace] = await tx.insert(workspaces).values({ name: workspaceName }).returning({ id: workspaces.id });
      await tx.insert(memberships).values({ workspaceId: workspace.id, userId: signedUp.user.id, role: "admin" });
    });
    return Response.json({ success: true, message: "Workspace created. Sign in with your new Admin account." }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("already been completed")
      ? error.message
      : "We could not create the account. Check that this email is not already registered and try again.";
    return Response.json({ error: message }, { status: 400 });
  }
}
