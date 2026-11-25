import { and, desc, eq, inArray, lt, ne, or, gt, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { canonicalTimeZone, resolveWallTime } from "@/lib/interview-time";
import { assignedInterviewers, canReviewApplication, lockRecruitingRecord, problem, type ApplicationWorkspace } from "./application-workspace";
import { getDb } from "./db";
import { canManageJobs } from "./policy";
import { isUuid } from "./recruiting";
import { auditEvents, interviews, jobs, user } from "./schema";

export async function interviewState({ member, application }: ApplicationWorkspace) {
  const { workspaceId } = member;
  const db = getDb();
  const canManage = canManageJobs(member.role);
  const canReview = canReviewApplication(member, application.hiringManagerId);
  const interviewer = alias(user, "interview_staff");
  const actor = alias(user, "interview_actor");
  const bookings = canReview || member.role === "interviewer" ? await db.select({
    id: interviews.id, interviewerId: interviews.interviewerId, interviewerName: interviewer.name,
    startsAt: interviews.scheduledAt, endsAt: interviews.endsAt, timeZone: interviews.timeZone,
    location: interviews.location, status: interviews.status, revision: interviews.revision,
  }).from(interviews).innerJoin(interviewer, eq(interviewer.id, interviews.interviewerId))
    .where(and(eq(interviews.workspaceId, workspaceId), eq(interviews.applicationId, application.id),
      canReview ? undefined : eq(interviews.interviewerId, member.userId))).orderBy(desc(interviews.scheduledAt)) : [];
  const history = bookings.length ? await db.select({
    id: auditEvents.id, interviewId: auditEvents.entityId, event: auditEvents.action, actorName: actor.name, at: auditEvents.createdAt,
  }).from(auditEvents).leftJoin(actor, eq(actor.id, auditEvents.actorUserId)).where(and(
    eq(auditEvents.workspaceId, workspaceId), eq(auditEvents.entityType, "interview"),
    inArray(auditEvents.entityId, bookings.map((booking) => booking.id)))).orderBy(desc(auditEvents.createdAt)) : [];
  const options = canManage ? await assignedInterviewers(db, workspaceId, application.jobId) : [];
  return { canManage, closed: application.jobState === "closed", jobTitle: application.jobTitle, options, bookings, history };
}

export async function changeInterview(scope: ApplicationWorkspace, body: Record<string, unknown>) {
  const { member, application } = scope;
  const { workspaceId } = member;
  if (!canManageJobs(member.role)) return problem("Only Admins and Recruiters can manage interviews.", 403);
  const { id, action, interviewerId } = body;
  if (typeof id !== "string" || !isUuid(id)) return problem("A valid interview record is required.");
  if (action !== "schedule" && action !== "reschedule" && action !== "cancel") return problem("Choose an interview action.");
  const timeZone = canonicalTimeZone(body.timeZone);
  const startsAt = timeZone && resolveWallTime(body.start, timeZone);
  const endsAt = timeZone && resolveWallTime(body.end, timeZone);
  const location = typeof body.location === "string" ? body.location.trim() : "";
  const details = startsAt && endsAt && timeZone && typeof interviewerId === "string"
    ? { scheduledAt: startsAt, endsAt, timeZone, location, interviewerId } : null;
  if (action !== "cancel") {
    if (!timeZone) return problem("Choose a valid IANA time zone, such as Asia/Kolkata.");
    if (!startsAt || !endsAt) return problem("Choose unambiguous start and end times in the selected time zone.");
    if (endsAt <= startsAt || endsAt.getTime() - startsAt.getTime() > 8 * 60 * 60 * 1000)
      return problem("End time must follow the start time by eight hours or less.");
    if (!details || !location || location.length > 300 || /[\x00-\x1f]/.test(location))
      return problem("Choose an interviewer and enter a location or meeting link of up to 300 characters.");
  }

  const result = await getDb().transaction(async (tx) => {
    await lockRecruitingRecord(tx, application.jobId);
    const byId = and(eq(interviews.workspaceId, workspaceId), eq(interviews.applicationId, application.id), eq(interviews.id, id));
    const [existing] = await tx.select().from(interviews).where(byId).limit(1);

    if (action !== "schedule" && !existing) return problem("Interview not found.", 404);
    if (action === "cancel" && existing.status === "cancelled") return;
    if (action !== "schedule" && body.revision !== existing.revision)
      return problem("The interview changed. Reload before making another update.", 409);

    if (action === "cancel") {
      await tx.update(interviews).set({ status: "cancelled", revision: existing.revision + 1 }).where(byId);
    } else {
      if (!details) return problem("Check the interview details.");
      if (existing && action === "schedule") {
        if (existing.status === "scheduled" && existing.interviewerId === details.interviewerId &&
            existing.scheduledAt.getTime() === +details.scheduledAt && existing.endsAt?.getTime() === +details.endsAt &&
            existing.timeZone === details.timeZone && existing.location === details.location) return;
        return problem("This booking request already exists. Reload to see its current details.", 409);
      }
      if (existing?.status === "cancelled") return problem("A cancelled interview cannot be rescheduled. Create a new booking.", 409);
      const [job] = await tx.select({ state: jobs.state }).from(jobs)
        .where(and(eq(jobs.workspaceId, workspaceId), eq(jobs.id, application.jobId))).limit(1);
      if (!job || job.state === "closed") return problem("Reopen this job before booking or rescheduling.", 409);
      const eligible = await assignedInterviewers(tx, workspaceId, application.jobId);
      if (!eligible.some((option) => option.id === details.interviewerId))
        return problem("Choose an active interviewer assigned to this job.");
      await lockRecruitingRecord(tx, "interview:" + workspaceId + ":" + details.interviewerId);
      const [conflict] = await tx.select({ id: interviews.id }).from(interviews).where(and(
        eq(interviews.workspaceId, workspaceId), eq(interviews.interviewerId, details.interviewerId),
        eq(interviews.status, "scheduled"), ne(interviews.id, id), lt(interviews.scheduledAt, details.endsAt),
        or(gt(interviews.endsAt, details.scheduledAt), and(isNull(interviews.endsAt), gt(interviews.scheduledAt, details.scheduledAt))),
      )).limit(1);
      if (conflict) return problem("This interviewer already has a Morrow booking in that time range.", 409);
      if (existing) {
        await tx.update(interviews).set({ ...details, revision: existing.revision + 1 }).where(byId);
      } else {
        const [inserted] = await tx.insert(interviews).values({ ...details, id, workspaceId, applicationId: application.id })
          .onConflictDoNothing().returning({ id: interviews.id });
        if (!inserted) return problem("This booking request was already used.", 409);
      }
    }

    await tx.insert(auditEvents).values({ workspaceId, actorUserId: member.userId, entityType: "interview", entityId: id,
      action: action === "schedule" ? "interview.scheduled" : action === "reschedule" ? "interview.rescheduled" : "interview.cancelled",
      details: { applicationId: application.id, previousStart: existing?.scheduledAt.toISOString() ?? null,
        start: details?.scheduledAt.toISOString() ?? null } });
  });
  return result ?? Response.json(await interviewState(scope));
}
