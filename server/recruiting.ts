import { and, eq, isNull, ne, or } from "drizzle-orm";
import type { ActiveMember } from "./access";
import { getDb } from "./db";
import { canManageJobs, isHiringManagerAssignment } from "./policy";
import { jobAssignments, jobs } from "./schema";
import { isUuid } from "./recruiting-validation";
export { candidateProfileName, isUuid, normalizeApplicantEmail, parseCandidateSearch, parseJobInput, validWebUrl } from "./recruiting-validation";

export async function canAccessJob(member: ActiveMember, jobId: string) {
  if (canManageJobs(member.role)) return true;
  const db = getDb();
  const [job] = await db.select({ id: jobs.id, hiringManagerId: jobs.hiringManagerId }).from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.workspaceId, member.workspaceId))).limit(1);
  if (!job) return false;
  if (job.hiringManagerId === member.userId) return isHiringManagerAssignment(member.role, member.userId, job.hiringManagerId);
  const [assignment] = await db.select({ id: jobAssignments.id }).from(jobAssignments)
    .where(and(
      eq(jobAssignments.workspaceId, member.workspaceId),
      eq(jobAssignments.jobId, jobId),
      eq(jobAssignments.userId, member.userId),
    )).limit(1);
  return Boolean(assignment);
}

export async function canAccessApplication(member: ActiveMember, jobId: string) {
  return canAccessJob(member, jobId);
}

export async function getAccessibleApplicationJobIds(member: ActiveMember) {
  if (canManageJobs(member.role)) return null;
  const db = getDb();
  const assignments = await db.select({ jobId: jobAssignments.jobId }).from(jobAssignments)
    .innerJoin(jobs, and(eq(jobAssignments.workspaceId, jobs.workspaceId), eq(jobAssignments.jobId, jobs.id)))
    .where(and(
      eq(jobAssignments.workspaceId, member.workspaceId), eq(jobAssignments.userId, member.userId),
      or(isNull(jobs.hiringManagerId), ne(jobAssignments.userId, jobs.hiringManagerId))!,
    ));
  const managedJobs = member.role === "hiring_manager"
    ? await db.select({ id: jobs.id }).from(jobs)
      .where(and(eq(jobs.workspaceId, member.workspaceId), eq(jobs.hiringManagerId, member.userId)))
    : [];
  return [...new Set([...assignments.map(({ jobId }) => jobId), ...managedJobs.map(({ id }) => id)])];
}

