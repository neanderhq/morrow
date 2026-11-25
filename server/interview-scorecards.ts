import { and, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { assignedInterviewers, canReviewApplication, lockRecruitingRecord, problem, type ApplicationWorkspace } from "./application-workspace";
import { getDb } from "./db";
import { parseInterviewFeedback, parseJobCriteria } from "./interview-scorecard-validation";
import { canManageJobs } from "./policy";
import { interviewFeedback, interviewReviewRounds, jobInterviewRubrics, jobs, user } from "./schema";

const requiredFeedback = "Rate every criterion, add written evidence and choose a recommendation.";

export async function scorecardState({ member, application }: ApplicationWorkspace) {
  const { workspaceId } = member;
  const db = getDb();
  const canManage = canManageJobs(member.role);
  const canReview = canReviewApplication(member, application.hiringManagerId);
  const [round] = await db.select({ id: interviewReviewRounds.id, version: jobInterviewRubrics.version,
    criteria: jobInterviewRubrics.criteria }).from(interviewReviewRounds)
    .innerJoin(jobInterviewRubrics, and(eq(jobInterviewRubrics.workspaceId, interviewReviewRounds.workspaceId),
      eq(jobInterviewRubrics.id, interviewReviewRounds.rubricId)))
    .where(and(eq(interviewReviewRounds.workspaceId, workspaceId), eq(interviewReviewRounds.applicationId, application.id)))
    .limit(1);
  const [latest] = canManage ? await db.select({ version: jobInterviewRubrics.version, criteria: jobInterviewRubrics.criteria })
    .from(jobInterviewRubrics).where(and(eq(jobInterviewRubrics.workspaceId, workspaceId),
      eq(jobInterviewRubrics.jobId, application.jobId))).orderBy(desc(jobInterviewRubrics.version)).limit(1) : [];
  const options = canManage ? await assignedInterviewers(db, workspaceId, application.jobId) : [];
  const author = alias(user, "scorecard_author");
  const cards = round && (canReview || member.role === "interviewer") ? await db.select({
    interviewerId: interviewFeedback.interviewerId, interviewerName: author.name, revision: interviewFeedback.revision,
    submittedAt: interviewFeedback.submittedAt,
    ratings: sql<(number | null)[] | null>`case when ${interviewFeedback.interviewerId} = ${member.userId} or ${interviewFeedback.submittedAt} is not null then ${interviewFeedback.ratings} end`,
    notes: sql<string | null>`case when ${interviewFeedback.interviewerId} = ${member.userId} or ${interviewFeedback.submittedAt} is not null then ${interviewFeedback.notes} end`,
    recommendation: sql<string | null>`case when ${interviewFeedback.interviewerId} = ${member.userId} or ${interviewFeedback.submittedAt} is not null then ${interviewFeedback.recommendation} end`,
  }).from(interviewFeedback).innerJoin(author, eq(author.id, interviewFeedback.interviewerId))
    .where(and(eq(interviewFeedback.workspaceId, workspaceId), eq(interviewFeedback.roundId, round.id),
      canReview ? undefined : eq(interviewFeedback.interviewerId, member.userId))).orderBy(author.name) : [];
  return {
    canManage, canReview, closed: application.jobState === "closed",
    rubric: latest ?? null, interviewers: options, round: canReview || cards.length ? round ?? null : null,
    cards, yourCard: member.role === "interviewer" ? cards[0] ?? null : null,
  };
}

export async function changeScorecard(scope: ApplicationWorkspace, body: Record<string, unknown>) {
  const { application, member } = scope;
  const { workspaceId } = member;
  const manages = body.action === "rubric" || body.action === "assign";
  if (manages && !canManageJobs(member.role)) return problem("Only Admins and Recruiters can manage scorecards.", 403);
  if (!manages && member.role !== "interviewer") return problem("Only an assigned interviewer can fill out their scorecard.", 403);
  if (!manages && body.action !== "draft" && body.action !== "submit") return problem("Choose a valid scorecard action.");

  const result = await getDb().transaction(async (tx) => {
    await lockRecruitingRecord(tx, application.jobId);
    const [job] = await tx.select({ state: jobs.state }).from(jobs)
      .where(and(eq(jobs.id, application.jobId), eq(jobs.workspaceId, workspaceId))).limit(1);
    if (!job || job.state === "closed") return problem("This job is closed. Reopen it to resume interview feedback.", 409);
    const [latest] = await tx.select().from(jobInterviewRubrics).where(and(eq(jobInterviewRubrics.workspaceId, workspaceId),
      eq(jobInterviewRubrics.jobId, application.jobId))).orderBy(desc(jobInterviewRubrics.version)).limit(1);

    if (body.action === "rubric") {
      const criteria = parseJobCriteria(body.criteria);
      if (!criteria) return problem("Enter 2–8 distinct criteria, one per line, up to 120 characters each.");
      if (latest && JSON.stringify(latest.criteria) === JSON.stringify(criteria)) return;
      const version = latest?.version ?? 0;
      if (body.version !== version) return problem("The rubric changed. Reload before saving a new version.", 409);
      await tx.insert(jobInterviewRubrics).values({ workspaceId, jobId: application.jobId,
        version: version + 1, criteria, createdBy: member.userId });
      return;
    }

    const [existingRound] = await tx.select().from(interviewReviewRounds).where(and(
      eq(interviewReviewRounds.workspaceId, workspaceId), eq(interviewReviewRounds.applicationId, application.id))).limit(1);
    if (body.action === "assign") {
      if (!latest) return problem("Save a job rubric before assigning feedback.");
      const ids = body.interviewerIds;
      if (!Array.isArray(ids) || ids.length < 1 || ids.length > 20) return problem("Select at least one assigned interviewer.");
      const eligible = await assignedInterviewers(tx, workspaceId, application.jobId);
      if (!ids.every((id) => eligible.some((option) => option.id === id))) return problem("Choose active interviewers assigned to this job.");
      const round = existingRound ?? (await tx.insert(interviewReviewRounds).values({
        workspaceId, applicationId: application.id, rubricId: latest.id, createdBy: member.userId,
      }).returning())[0];
      await tx.insert(interviewFeedback).values([...new Set(ids as string[])].map((interviewerId) => ({
        workspaceId, roundId: round.id, interviewerId,
      }))).onConflictDoNothing();
      return;
    }

    if (!existingRound) return problem("No scorecard was assigned to you.", 403);
    const eligible = await assignedInterviewers(tx, workspaceId, application.jobId);
    if (!eligible.some((option) => option.id === member.userId)) return problem("No scorecard was assigned to you.", 403);
    const [card] = await tx.select().from(interviewFeedback).where(and(eq(interviewFeedback.workspaceId, workspaceId),
      eq(interviewFeedback.roundId, existingRound.id), eq(interviewFeedback.interviewerId, member.userId))).limit(1);
    if (!card) return problem("No scorecard was assigned to you.", 403);
    const [assignedRubric] = await tx.select({ criteria: jobInterviewRubrics.criteria }).from(jobInterviewRubrics)
      .where(and(eq(jobInterviewRubrics.id, existingRound.rubricId), eq(jobInterviewRubrics.workspaceId, workspaceId))).limit(1);
    const submit = body.action === "submit";
    const data = parseInterviewFeedback(body, assignedRubric.criteria.length, submit);
    if (!data) return problem(submit ? requiredFeedback : "Check the ratings, written evidence and recommendation.");
    if (card.submittedAt) {
      if (submit && card.notes === data.notes && card.recommendation === data.recommendation &&
          JSON.stringify(card.ratings) === JSON.stringify(data.ratings)) return;
      return problem("This scorecard was submitted and cannot be edited.", 409);
    }
    if (card.revision !== body.revision) return problem("This draft changed in another tab. Reload it before saving.", 409);
    await tx.update(interviewFeedback).set({ ...data, revision: card.revision + 1, submittedAt: submit ? new Date() : null })
      .where(and(eq(interviewFeedback.id, card.id), eq(interviewFeedback.workspaceId, workspaceId)));
  });
  return result ?? Response.json(await scorecardState(scope));
}
