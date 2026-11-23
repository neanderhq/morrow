import { and, asc, eq } from "drizzle-orm";
import { getMember } from "../../../server/access";
import { getDb } from "../../../server/db";
import { forbidden, unauthorized } from "../../../server/http";
import { memberships, user } from "../../../server/schema";
import { canManageStaff } from "../../../server/policy";

export async function GET(request: Request) {
  const member = await getMember(request.headers);
  if (!member) return unauthorized();
  if (!canManageStaff(member.role)) return forbidden();
  const rows = await getDb().select({
    id: memberships.id,
    userId: user.id,
    name: user.name,
    email: user.email,
    role: memberships.role,
    active: memberships.active,
  }).from(memberships).innerJoin(user, eq(memberships.userId, user.id))
    .where(eq(memberships.workspaceId, member.workspaceId)).orderBy(asc(user.name));
  return Response.json({ staff: rows });
}
