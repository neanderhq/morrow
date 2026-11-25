import { and, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { recordApplicationStage } from "./application-stage";
import { lockRecruitingRecord, problem, type ApplicationWorkspace } from "./application-workspace";
import { getDb } from "./db";
import { validEmail } from "./policy";
import { isUuid } from "./recruiting";
import { emailConfig, sendRejectionEmail } from "./rejection-provider";
import { applicationStageHistory, applications, auditEvents, rejectionEmails, user } from "./schema";

const interrupted = "The send was interrupted and may have reached the provider. Review the provider dashboard before taking any action.";

export async function rejectionState({ member, application }: ApplicationWorkspace) {
  const { workspaceId } = member;
  const db = getDb();
  const [current] = await db.select({ stage: applications.stage }).from(applications)
    .where(and(eq(applications.workspaceId, workspaceId), eq(applications.id, application.id))).limit(1);
  const [stageEvent] = await db.select({ id: applicationStageHistory.id }).from(applicationStageHistory).where(and(
    eq(applicationStageHistory.workspaceId, workspaceId), eq(applicationStageHistory.applicationId, application.id),
  )).orderBy(desc(applicationStageHistory.createdAt), desc(applicationStageHistory.id)).limit(1);
  const creator = alias(user, "rejection_preparer");
  const dispatcher = alias(user, "rejection_dispatcher");
  const messages = await db.select({
    id: rejectionEmails.id, stageEventId: rejectionEmails.stageEventId, status: rejectionEmails.status,
    subject: rejectionEmails.subject, body: rejectionEmails.body, recipient: rejectionEmails.recipient, sender: rejectionEmails.sender,
    createdAt: rejectionEmails.createdAt, updatedAt: rejectionEmails.updatedAt, createdBy: creator.name,
    dispatchedBy: dispatcher.name, attempts: rejectionEmails.attempts, reason: rejectionEmails.reason,
    providerMessageId: rejectionEmails.providerMessageId,
  }).from(rejectionEmails)
    .leftJoin(creator, eq(creator.id, rejectionEmails.createdBy))
    .leftJoin(dispatcher, eq(dispatcher.id, rejectionEmails.dispatchedBy))
    .where(and(eq(rejectionEmails.workspaceId, workspaceId), eq(rejectionEmails.applicationId, application.id)))
    .orderBy(desc(rejectionEmails.createdAt));
  return {
    configured: Boolean(emailConfig()), sender: emailConfig()?.from ?? null,
    recipient: application.recipient, jobTitle: application.jobTitle, stage: current?.stage,
    stageEventId: stageEvent?.id ?? null,
    messages: messages.map((message) => message.status === "sending" && Date.now() - +message.updatedAt > 30_000
      ? { ...message, status: "unknown", reason: interrupted } : message),
  };
}

export async function prepareRejectionEmail(scope: ApplicationWorkspace, body: Record<string, unknown>) {
  const { application, member } = scope;
  const { workspaceId } = member;
  const config = emailConfig();
  if (!config) return problem("Rejection email is unconfigured. You can still reject without email.", 409);
  if (typeof body.id !== "string" || !isUuid(body.id)) return problem("A valid email request is required.");
  const id = body.id;
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.body === "string" ? body.body.trim() : "";
  if (!subject || subject.length > 180 || /[\x00-\x1f]/.test(subject))
    return problem("Enter a one-line subject up to 180 characters.");
  if (!message || message.length > 5000 || message.includes("\0")) return problem("Enter an email message up to 5,000 characters.");
  const recipient = application.recipient;
  if (!recipient || !validEmail(recipient)) return problem("This application has no valid recipient email.");

  const duplicateRequest = new Error("Rejection email request collision");
  const result = await getDb().transaction(async (tx) => {
    await lockRecruitingRecord(tx, application.id);
    const [existing] = await tx.select().from(rejectionEmails).where(and(eq(rejectionEmails.workspaceId, workspaceId),
      eq(rejectionEmails.applicationId, application.id), eq(rejectionEmails.id, id))).limit(1);
    if (existing) return existing.subject === subject && existing.body === message
      ? undefined : problem("This email request was already used with different text.", 409);

    const [current] = await tx.select({ stage: applications.stage }).from(applications)
      .where(and(eq(applications.id, application.id), eq(applications.workspaceId, workspaceId))).limit(1);
    if (!current) return problem("Application not found.", 404);
    const [latest] = await tx.select({ id: applicationStageHistory.id }).from(applicationStageHistory).where(and(
      eq(applicationStageHistory.workspaceId, workspaceId), eq(applicationStageHistory.applicationId, application.id),
    )).orderBy(desc(applicationStageHistory.createdAt), desc(applicationStageHistory.id)).limit(1);
    if ((latest?.id ?? null) !== body.stageEventId) return problem("The application stage changed. Reload and review the decision.", 409);
    const stageEvent = current.stage === "rejected" ? latest : await recordApplicationStage(tx, {
      id: application.id, workspaceId, currentStage: current.stage, actorUserId: member.userId,
    }, "rejected");
    if (!stageEvent) return problem("This application has no recorded rejection. Update its stage before preparing email.", 409);
    const [saved] = await tx.insert(rejectionEmails).values({
      id, workspaceId, applicationId: application.id, stageEventId: stageEvent.id,
      sender: config.from, recipient, subject, body: message, createdBy: member.userId,
    }).onConflictDoNothing().returning({ id: rejectionEmails.id });
    if (!saved) {
      // Roll back a just-created stage event if the request ID already belongs
      // to another application.
      if (current.stage !== "rejected") throw duplicateRequest;
      return problem("A message is already recorded for this rejection.", 409);
    }
    await tx.insert(auditEvents).values({ workspaceId, actorUserId: member.userId, entityType: "application",
      entityId: application.id, action: "application.rejection_email_prepared", details: { messageId: id } });
  }).catch((error: unknown) => {
    if (error === duplicateRequest)
      return problem("This email request was already used.", 409);
    throw error;
  });
  return result ?? Response.json(await rejectionState(scope));
}

export async function dispatchRejectionEmail(scope: ApplicationWorkspace, action: "send" | "retry", id: unknown) {
  const { application, member } = scope;
  const { workspaceId } = member;
  if (typeof id !== "string" || !isUuid(id)) return problem("Email not found.", 404);
  const config = emailConfig();
  if (!config) return problem("Rejection email is unconfigured.", 409);
  const db = getDb();
  const identity = and(eq(rejectionEmails.id, id), eq(rejectionEmails.workspaceId, workspaceId), eq(rejectionEmails.applicationId, application.id));
  const claimed = await db.transaction(async (tx) => {
    await lockRecruitingRecord(tx, application.id);
    const [outgoing] = await tx.select().from(rejectionEmails).where(identity).limit(1);
    if (!outgoing) return problem("Email not found.", 404);
    if (outgoing.status === "accepted" || outgoing.status === "sending") return null;
    if (outgoing.status !== (action === "retry" ? "failed" : "queued"))
      return problem("This email is no longer available for that action.", 409);
    if (outgoing.sender !== config.from) return problem("The configured sender changed. Restore the original sender before sending this email.", 409);
    const [current] = await tx.select({ stage: applications.stage }).from(applications)
      .where(and(eq(applications.workspaceId, workspaceId), eq(applications.id, application.id))).limit(1);
    if (current?.stage !== "rejected") return problem("The application was restored before email dispatch.", 409);
    await tx.update(rejectionEmails).set({ status: "sending", reason: null, updatedAt: new Date(),
      dispatchedBy: member.userId, attempts: outgoing.attempts + 1 }).where(identity);
    return outgoing;
  });
  if (claimed instanceof Response) return claimed;
  if (!claimed) return Response.json(await rejectionState(scope));

  const result = await sendRejectionEmail(config, id, claimed);
  await db.transaction(async (tx) => {
    await tx.update(rejectionEmails).set({
      status: result.status, providerMessageId: result.id, reason: result.reason, updatedAt: new Date(),
    }).where(and(identity, eq(rejectionEmails.status, "sending")));
    await tx.insert(auditEvents).values({ workspaceId, actorUserId: member.userId, entityType: "application",
      entityId: application.id, action: "application.rejection_email_" + result.status, details: { messageId: id } });
  });
  return Response.json(await rejectionState(scope));
}
