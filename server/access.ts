import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getAuth } from "./auth";
import { getDb } from "./db";
import { memberships, user, workspaces } from "./schema";
import type { StaffRole } from "./policy";

export type ActiveMember = {
  userId: string;
  name: string;
  email: string;
  role: StaffRole;
  workspaceId: string;
  workspaceName: string;
};

export async function getMember(requestHeaders?: Headers): Promise<ActiveMember | null> {
  const session = await getAuth().api.getSession({ headers: requestHeaders ?? await headers() });
  if (!session) return null;
  const db = getDb();
  const [member] = await db.select({
    userId: memberships.userId,
    name: user.name,
    email: user.email,
    role: memberships.role,
    workspaceId: memberships.workspaceId,
    workspaceName: workspaces.name,
  }).from(memberships).innerJoin(workspaces, eq(memberships.workspaceId, workspaces.id)).innerJoin(user, eq(memberships.userId, user.id)).where(and(
    eq(memberships.userId, session.user.id),
    eq(memberships.active, true),
  )).limit(1);
  return member ?? null;
}

export async function hasWorkspace() {
  const [workspace] = await getDb().select({ id: workspaces.id }).from(workspaces).limit(1);
  return Boolean(workspace);
}
