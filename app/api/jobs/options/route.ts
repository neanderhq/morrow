import { and, asc, eq, inArray } from "drizzle-orm";
import { getMember } from "../../../../server/access";
import { getDb } from "../../../../server/db";
import { canManageJobs } from "../../../../server/policy";
import { memberships, user } from "../../../../server/schema";
import { unauthorized } from "../../../../server/http";

export async function GET(request: Request) {
  const member = await getMember(request.headers);
  if (!member) return unauthorized();
  if (!canManageJobs(member.role)) return Response.json({ error: "Only Admins and Recruiters can manage jobs." }, { status: 403 });
  const rows = await getDb().select({ id: memberships.userId, name: user.name, email: user.email, role: memberships.role })
    .from(memberships).innerJoin(user, eq(memberships.userId, user.id))
    .where(and(eq(memberships.workspaceId, member.workspaceId), eq(memberships.active, true), inArray(memberships.role, ["hiring_manager", "interviewer"])))
    .orderBy(asc(user.name));
  return Response.json({ hiringManagers: rows.filter((row) => row.role === "hiring_manager"), interviewers: rows.filter((row) => row.role === "interviewer") });
}
