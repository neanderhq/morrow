import "server-only";
import { and, asc, eq } from "drizzle-orm";
import type { ActiveMember } from "./access";
import { getDb } from "./db";
import { canAccessApplication } from "./recruiting";
import { applications, candidates, jobs } from "./schema";

export async function getCandidateView(member: ActiveMember, candidateId: string) {
  const db = getDb();
  const [candidate] = await db.select({ id: candidates.id, name: candidates.name, email: candidates.email })
    .from(candidates).where(and(eq(candidates.id, candidateId), eq(candidates.workspaceId, member.workspaceId))).limit(1);
  if (!candidate) return null;

  const rows = await db.select({
    id: applications.id,
    stage: applications.stage,
    createdAt: applications.createdAt,
    jobId: applications.jobId,
    jobTitle: jobs.title,
    applicantName: applications.applicantName,
    applicantEmail: applications.applicantEmail,
  }).from(applications).innerJoin(jobs, and(eq(applications.jobId, jobs.id), eq(jobs.workspaceId, member.workspaceId)))
    .where(and(eq(applications.workspaceId, member.workspaceId), eq(applications.candidateId, candidateId)))
    .orderBy(asc(applications.createdAt));
  const accessibleJobs = new Set<string>();
  for (const jobId of new Set(rows.map((row) => row.jobId))) {
    if (await canAccessApplication(member, jobId)) accessibleJobs.add(jobId);
  }
  const visibleApplications = rows.filter((row) => accessibleJobs.has(row.jobId));
  if (!visibleApplications.length) return null;
  return {
    candidate: { id: candidate.id, name: candidate.name, email: candidate.email },
    applications: visibleApplications.map((row) => ({
      ...row,
      applicantName: row.applicantName || candidate.name,
      applicantEmail: row.applicantEmail || candidate.email,
    })),
  };
}
