import { toNextJsHandler } from "better-auth/next-js";
import { and, eq } from "drizzle-orm";
import { getAuth } from "../../../../server/auth";
import { invalidLoginResponse } from "../../../../server/auth-feedback";
import { getDb } from "../../../../server/db";
import { memberships, session, user } from "../../../../server/schema";

const handlers = () => toNextJsHandler(getAuth());

function authPath(request: Request) {
  return new URL(request.url).pathname.replace(/^\/api\/auth/, "").replace(/\/$/, "");
}

function denied() {
  return Response.json({ message: "This authentication action is not available." }, { status: 404 });
}

export async function GET(request: Request) {
  const path = authPath(request);
  if (path !== "/get-session" && !path.startsWith("/reset-password/")) return denied();
  return handlers().GET(request);
}

export async function POST(request: Request) {
  const path = authPath(request);
  let activeUserId: string | null = null;
  let signInEmail: string | null = null;
  if (path === "/sign-in/email") {
    const body = await request.clone().json().catch(() => null) as { email?: string } | null;
    const email = body?.email?.trim().toLowerCase();
    if (!email) return Response.json({ message: "Enter a valid email and password." }, { status: 400 });
    signInEmail = email;
    const db = getDb();
    const [active] = await db.select({ userId: memberships.userId }).from(memberships)
      .innerJoin(user, eq(memberships.userId, user.id))
      .where(and(eq(user.email, email), eq(memberships.active, true))).limit(1);
    activeUserId = active?.userId ?? null;
  }
  if (path !== "/sign-in/email" && path !== "/sign-out" && path !== "/reset-password") return denied();
  const response = await handlers().POST(request);
  if (path !== "/sign-in/email") return response;
  if (response.status === 401) return invalidLoginResponse();
  if (response.ok && !activeUserId) {
    if (signInEmail) {
      const db = getDb();
      const [account] = await db.select({ id: user.id }).from(user).where(eq(user.email, signInEmail)).limit(1);
      if (account) await db.delete(session).where(eq(session.userId, account.id));
    }
    return invalidLoginResponse();
  }
  return response;
}
