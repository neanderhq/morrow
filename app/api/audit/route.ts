import { and, count, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getMember } from "../../../server/access";
import { auditActions, auditPageSize, parseAuditFilters } from "../../../server/audit";
import { getDb } from "../../../server/db";
import { unauthorized } from "../../../server/http";
import { applications, auditEvents, candidates, invitations, jobs, memberships, user } from "../../../server/schema";

function detailValue(details: unknown, key: string) {
  if (!details || typeof details !== "object" || !(key in details)) return null;
  const value = (details as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

export async function GET(request: Request) {
  const member = await getMember(request.headers);
  if (!member) return unauthorized();
  if (member.role !== "admin") return Response.json({ error: "Only Admins can view the audit trail." }, { status: 403 });

  const parsed = parseAuditFilters(new URL(request.url).searchParams);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const db = getDb();
  const conditions = [eq(auditEvents.workspaceId, member.workspaceId), inArray(auditEvents.action, auditActions)];
  if (parsed.filters.action) conditions.push(eq(auditEvents.action, parsed.filters.action));
  if (parsed.filters.userId) conditions.push(eq(auditEvents.actorUserId, parsed.filters.userId));
  if (parsed.filters.from) conditions.push(gte(auditEvents.createdAt, parsed.filters.from));
  if (parsed.filters.to) conditions.push(lt(auditEvents.createdAt, parsed.filters.to));
  const where = and(...conditions);
  const [{ total }] = await db.select({ total: count() }).from(auditEvents).where(where);
  const pageCount = Math.max(1, Math.ceil(total / auditPageSize));
  const page = Math.min(parsed.filters.page, pageCount);
  const actor = alias(user, "audit_actor");
  const rows = await db.select({
    id: auditEvents.id,
    action: auditEvents.action,
    entityType: auditEvents.entityType,
    entityId: auditEvents.entityId,
    details: auditEvents.details,
    createdAt: auditEvents.createdAt,
    actorName: actor.name,
    actorEmail: actor.email,
  }).from(auditEvents).leftJoin(actor, eq(auditEvents.actorUserId, actor.id))
    .where(where)
    .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
    .limit(auditPageSize)
    .offset((page - 1) * auditPageSize);

  const idsFor = (entityType: string) => [...new Set(rows.flatMap((row) => row.entityType === entityType && row.entityId ? [row.entityId] : []))];
  const jobIds = idsFor("job");
  const applicationIds = idsFor("application");
  const staffIds = idsFor("workspace_member");
  const invitationIds = idsFor("staff_invitation");
  const [jobRows, applicationRows, staffRows, invitationRows, staffOptions] = await Promise.all([
    jobIds.length ? db.select({ id: jobs.id, title: jobs.title }).from(jobs).where(and(eq(jobs.workspaceId, member.workspaceId), inArray(jobs.id, jobIds))) : [],
    applicationIds.length ? db.select({
      id: applications.id,
      name: applications.applicantName,
      email: applications.applicantEmail,
      candidateName: candidates.name,
      candidateEmail: candidates.email,
      jobTitle: jobs.title,
    }).from(applications)
      .innerJoin(jobs, and(eq(applications.jobId, jobs.id), eq(jobs.workspaceId, member.workspaceId)))
      .innerJoin(candidates, and(eq(applications.candidateId, candidates.id), eq(candidates.workspaceId, member.workspaceId)))
      .where(and(eq(applications.workspaceId, member.workspaceId), inArray(applications.id, applicationIds))) : [],
    staffIds.length ? db.select({ id: memberships.id, userId: memberships.userId, name: user.name, email: user.email })
      .from(memberships).innerJoin(user, eq(memberships.userId, user.id))
      .where(and(eq(memberships.workspaceId, member.workspaceId), inArray(memberships.id, staffIds))) : [],
    invitationIds.length ? db.select({ id: invitations.id, email: invitations.email, acceptedAt: invitations.acceptedAt })
      .from(invitations).where(and(eq(invitations.workspaceId, member.workspaceId), inArray(invitations.id, invitationIds))) : [],
    db.select({ id: user.id, membershipId: memberships.id, email: user.email, name: user.name, active: memberships.active })
      .from(memberships).innerJoin(user, eq(memberships.userId, user.id))
      .where(eq(memberships.workspaceId, member.workspaceId)),
  ]);

  const jobById = new Map(jobRows.map((row) => [row.id, row]));
  const applicationById = new Map(applicationRows.map((row) => [row.id, row]));
  const staffById = new Map(staffRows.map((row) => [row.id, row]));
  const staffByEmail = new Map(staffOptions.map((row) => [row.email.toLowerCase(), row]));
  const invitationById = new Map(invitationRows.map((row) => [row.id, row]));

  const events = rows.map((row) => {
    let recordLabel = `${row.entityType.replaceAll("_", " ")} record`;
    let recordHref: string | null = null;
    if (row.entityType === "job" && row.entityId) {
      const job = jobById.get(row.entityId);
      recordLabel = job?.title || detailValue(row.details, "title") || "Job no longer available";
      if (job) recordHref = `/jobs#job-${job.id}`;
    } else if (row.entityType === "application" && row.entityId) {
      const application = applicationById.get(row.entityId);
      const name = application?.name || application?.candidateName || application?.email || application?.candidateEmail
        || detailValue(row.details, "applicantName") || detailValue(row.details, "applicantEmail");
      const jobTitle = application?.jobTitle || detailValue(row.details, "jobTitle");
      recordLabel = [name, jobTitle].filter(Boolean).join(" · ") || "Application no longer available";
      if (application) recordHref = `/applications/${application.id}`;
    } else if (row.entityType === "workspace_member" && row.entityId) {
      const staff = staffById.get(row.entityId);
      recordLabel = staff ? `${staff.name} · ${staff.email}` : "Staff record no longer available";
      if (staff) recordHref = `/staff#staff-${staff.id}`;
    } else if (row.entityType === "staff_invitation" && row.entityId) {
      const invite = invitationById.get(row.entityId);
      const email = invite?.email || detailValue(row.details, "email");
      recordLabel = email ? `Invitation · ${email}` : "Invitation no longer available";
      if (invite) {
        const acceptedStaff = invite.acceptedAt ? staffByEmail.get(invite.email.toLowerCase()) : null;
        recordHref = acceptedStaff ? `/staff#staff-${acceptedStaff.id}` : invite.acceptedAt ? null : `/staff#invite-${invite.id}`;
      }
    }
    const applicant = row.action === "application.received"
      ? applicationById.get(row.entityId || "")?.name || applicationById.get(row.entityId || "")?.candidateName
        || detailValue(row.details, "applicantName") || detailValue(row.details, "applicantEmail")
      : null;
    return {
      id: row.id,
      action: row.action,
      details: row.details,
      createdAt: row.createdAt,
      actorName: row.actorName,
      actorEmail: row.actorEmail,
      actorLabel: row.actorName || row.actorEmail || (applicant ? `Applicant · ${applicant}` : "Unknown user"),
      recordLabel,
      recordHref,
    };
  });

  return Response.json({
    events,
    users: staffOptions.map(({ id, name, email, active }) => ({ id, name, email, active })),
    pagination: { page, pageSize: auditPageSize, total, totalPages: pageCount },
  }, { headers: { "Cache-Control": "private, no-store" } });
}
