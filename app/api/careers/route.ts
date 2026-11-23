import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../server/db";
import { jobs, workspaces } from "../../../server/schema";

export async function GET() {
  const rows = await getDb().select({
    id: jobs.id,
    title: jobs.title,
    department: jobs.department,
    location: jobs.location,
    employmentType: jobs.employmentType,
    remote: jobs.remote,
    description: jobs.description,
    workspaceName: workspaces.name,
  }).from(jobs).innerJoin(workspaces, eq(jobs.workspaceId, workspaces.id))
    .where(and(eq(jobs.state, "published"), eq(workspaces.singletonKey, "primary"))).orderBy(asc(jobs.title));
  return Response.json({ jobs: rows }, { headers: { "Cache-Control": "no-store" } });
}
