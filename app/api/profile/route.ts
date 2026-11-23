import { eq } from "drizzle-orm";
import { getMember } from "../../../server/access";
import { getDb } from "../../../server/db";
import { sameOrigin, unauthorized } from "../../../server/http";
import { user } from "../../../server/schema";

export async function GET(request: Request) {
  const member = await getMember(request.headers);
  return member ? Response.json({ profile: member }) : unauthorized();
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request origin was not accepted." }, { status: 403 });
  const member = await getMember(request.headers);
  if (!member) return unauthorized();
  const body = await request.json().catch(() => null) as { name?: string } | null;
  const name = body?.name?.trim();
  if (!name || name.length > 120) return Response.json({ error: "Name must be between 1 and 120 characters." }, { status: 400 });
  await getDb().update(user).set({ name, updatedAt: new Date() }).where(eq(user.id, member.userId));
  return Response.json({ success: true, name });
}
