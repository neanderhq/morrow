import { and, asc, eq, ilike, inArray, or } from "drizzle-orm";
import { getMember } from "../../../server/access";
import { getDb } from "../../../server/db";
import { isApplicationStage } from "../../../server/policy";
import { isUuid } from "../../../server/recruiting";
import { getAccessibleApplicationJobIds } from "../../../server/recruiting";
import { applications, candidates, jobs } from "../../../server/schema";
import { unauthorized } from "../../../server/http";

export async function GET(request: Request) {
  const member = await getMember(request.headers);
  if (!member) return unauthorized();
  const db = getDb();
  const query = new URL(request.url).searchParams;
  const jobId = query.get("job");
  if (jobId && !isUuid(jobId)) return Response.json({ error: "Job not found." }, { status: 404 });
  const stage = query.get("stage");
  if (stage && !isApplicationStage(stage)) return Response.json({ error: "Choose a valid application stage." }, { status: 400 });
  const search = query.get("search")?.trim() ?? "";
  if (search.length > 120) return Response.json({ error: "Search must be 120 characters or fewer." }, { status: 400 });
  const conditions = [eq(applications.workspaceId, member.workspaceId)];
  if (jobId) conditions.push(eq(applications.jobId, jobId));
  if (stage) conditions.push(eq(applications.stage, stage));
  if (search) {
    const escaped = search.replace(/[\\%_]/g, "\\$&");
    const pattern = `%${escaped}%`;
    conditions.push(or(
      ilike(applications.applicantName, pattern),
      ilike(applications.applicantEmail, pattern),
      ilike(candidates.name, pattern),
      ilike(candidates.email, pattern),
    )!);
  }
  const accessibleJobIds = await getAccessibleApplicationJobIds(member);
  if (accessibleJobIds !== null && !accessibleJobIds.length) return Response.json({ applications: [], jobs: [] });
  if (accessibleJobIds !== null) conditions.push(inArray(applications.jobId, accessibleJobIds));
  const rows = await db.select({
    id: applications.id,
    candidateId: applications.candidateId,
    stage: applications.stage,
    createdAt: applications.createdAt,
    jobId: applications.jobId,
    jobTitle: jobs.title,
    applicantName: applications.applicantName,
    applicantEmail: applications.applicantEmail,
    candidateName: candidates.name,
    candidateEmail: candidates.email,
    resumeName: applications.resumeName,
  }).from(applications).innerJoin(jobs, and(eq(applications.jobId, jobs.id), eq(jobs.workspaceId, member.workspaceId)))
    .innerJoin(candidates, and(eq(applications.candidateId, candidates.id), eq(candidates.workspaceId, member.workspaceId)))
    .where(and(...conditions)).orderBy(asc(applications.createdAt));
  const jobConditions = [eq(jobs.workspaceId, member.workspaceId)];
  if (accessibleJobIds !== null) jobConditions.push(inArray(jobs.id, accessibleJobIds));
  const jobOptions = await db.select({ id: jobs.id, title: jobs.title }).from(jobs)
    .where(and(...jobConditions)).orderBy(asc(jobs.title));
  return Response.json({
    applications: rows.map((row) => ({
      ...row,
      applicantName: row.applicantName || row.candidateName,
      applicantEmail: row.applicantEmail || row.candidateEmail,
    })),
    jobs: jobOptions,
  });
}
