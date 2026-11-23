import { and, asc, count, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { getMember } from "../../../server/access";
import { getDb } from "../../../server/db";
import { canManageJobs } from "../../../server/policy";
import { parseJobInput } from "../../../server/recruiting";
import { auditEvents, jobAssignments, jobs, memberships, applications, user } from "../../../server/schema";
import { sameOrigin, unauthorized } from "../../../server/http";

export async function GET(request: Request) {
  const member = await getMember(request.headers);
  if (!member) return unauthorized();
  const filter = new URL(request.url).searchParams.get("status");
  const db = getDb();
  const conditions = [eq(jobs.workspaceId, member.workspaceId)];
  if (filter === "draft" || filter === "published" || filter === "closed") conditions.push(eq(jobs.state, filter));
  const rows = await db.select({
    id: jobs.id,
    title: jobs.title,
    department: jobs.department,
    location: jobs.location,
    employmentType: jobs.employmentType,
    remote: jobs.remote,
    description: jobs.description,
    hiringManagerId: jobs.hiringManagerId,
    hiringManagerName: user.name,
    hiringManagerRole: memberships.role,
    hiringManagerActive: memberships.active,
    state: jobs.state,
    updatedAt: jobs.updatedAt,
    applicationCount: count(applications.id),
  }).from(jobs)
    .leftJoin(user, eq(jobs.hiringManagerId, user.id))
    .leftJoin(memberships, and(eq(jobs.workspaceId, memberships.workspaceId), eq(jobs.hiringManagerId, memberships.userId)))
    .leftJoin(applications, and(eq(applications.workspaceId, jobs.workspaceId), eq(applications.jobId, jobs.id)))
    .where(and(...conditions))
    .groupBy(jobs.id, user.name, memberships.role, memberships.active)
    .orderBy(asc(jobs.title));
  const assignments = await db.select({ jobId: jobAssignments.jobId }).from(jobAssignments)
    .innerJoin(jobs, and(eq(jobAssignments.workspaceId, jobs.workspaceId), eq(jobAssignments.jobId, jobs.id)))
    .where(and(
      eq(jobAssignments.workspaceId, member.workspaceId), eq(jobAssignments.userId, member.userId),
      or(isNull(jobs.hiringManagerId), ne(jobAssignments.userId, jobs.hiringManagerId))!,
    ));
  const interviewerAssignments = await db.select({ jobId: jobAssignments.jobId, userId: jobAssignments.userId })
    .from(jobAssignments)
    .innerJoin(memberships, and(eq(jobAssignments.workspaceId, memberships.workspaceId), eq(jobAssignments.userId, memberships.userId)))
    .innerJoin(jobs, and(eq(jobAssignments.workspaceId, jobs.workspaceId), eq(jobAssignments.jobId, jobs.id)))
    .where(and(eq(jobAssignments.workspaceId, member.workspaceId), eq(memberships.role, "interviewer"), eq(memberships.active, true), or(isNull(jobs.hiringManagerId), ne(jobAssignments.userId, jobs.hiringManagerId))!));
  const interviewersByJob = new Map<string, string[]>();
  for (const assignment of interviewerAssignments) interviewersByJob.set(assignment.jobId, [...(interviewersByJob.get(assignment.jobId) ?? []), assignment.userId]);
  const visibleIds = new Set(assignments.map((row) => row.jobId));
  const visible = canManageJobs(member.role) ? rows : rows.filter((row) =>
    (row.hiringManagerId === member.userId && member.role === "hiring_manager") || visibleIds.has(row.id));
  return Response.json({ jobs: visible.map((job) => {
    const { hiringManagerRole, hiringManagerActive, ...details } = job;
    const managerIsActive = hiringManagerActive && hiringManagerRole === "hiring_manager";
    return {
      ...details,
      hiringManagerName: managerIsActive ? job.hiringManagerName : null,
      interviewerIds: interviewersByJob.get(job.id) ?? [],
    };
  }) });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request origin was not accepted." }, { status: 403 });
  const member = await getMember(request.headers);
  if (!member) return unauthorized();
  if (!canManageJobs(member.role)) return Response.json({ error: "Only Admins and Recruiters can manage jobs." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const parsed = parseJobInput(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const db = getDb();
  const ids = [parsed.data.hiringManagerId, ...parsed.data.interviewerIds];
  const staff = await db.select({ userId: memberships.userId, role: memberships.role }).from(memberships)
    .where(and(eq(memberships.workspaceId, member.workspaceId), eq(memberships.active, true), inArray(memberships.userId, ids)));
  const manager = staff.find((row) => row.userId === parsed.data.hiringManagerId);
  if (!manager || manager.role !== "hiring_manager") return Response.json({ error: "Choose an active Hiring Manager from this workspace." }, { status: 400 });
  if (parsed.data.interviewerIds.some((id) => !staff.some((row) => row.userId === id && row.role === "interviewer"))) {
    return Response.json({ error: "Choose only active Interviewers from this workspace." }, { status: 400 });
  }
  const result = await db.transaction(async (tx) => {
    const [job] = await tx.insert(jobs).values({
      workspaceId: member.workspaceId,
      title: parsed.data.title,
      department: parsed.data.department,
      location: parsed.data.location,
      employmentType: parsed.data.employmentType,
      remote: parsed.data.remote,
      description: parsed.data.description,
      hiringManagerId: parsed.data.hiringManagerId,
      createdBy: member.userId,
    }).returning({ id: jobs.id });
    await tx.insert(jobAssignments).values([parsed.data.hiringManagerId, ...parsed.data.interviewerIds].map((userId) => ({
      workspaceId: member.workspaceId, jobId: job.id, userId, assignedBy: member.userId,
    })));
    await tx.insert(auditEvents).values({
      workspaceId: member.workspaceId, actorUserId: member.userId, action: "job.created", entityType: "job", entityId: job.id,
      details: { title: parsed.data.title },
    });
    return job;
  });
  return Response.json({ job: result }, { status: 201 });
}
