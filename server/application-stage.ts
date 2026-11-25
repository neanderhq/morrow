import { and, eq, inArray } from "drizzle-orm";
import { type WorkspaceTransaction } from "./application-workspace";
import { type ApplicationStage } from "./policy";
import { applications, applicationStageHistory, auditEvents, rejectionEmails } from "./schema";

export async function recordApplicationStage(tx: WorkspaceTransaction, scope: {
  id: string; workspaceId: string; actorUserId: string; currentStage: string;
}, stage: ApplicationStage) {
  const { id, workspaceId, actorUserId, currentStage } = scope;
  await tx.update(applications).set({ stage, updatedAt: new Date() })
    .where(and(eq(applications.id, id), eq(applications.workspaceId, workspaceId)));
  const [history] = await tx.insert(applicationStageHistory).values({ workspaceId, applicationId: id,
    fromStage: currentStage, toStage: stage, actorUserId }).returning({
    id: applicationStageHistory.id, createdAt: applicationStageHistory.createdAt,
  });
  await tx.insert(auditEvents).values({ workspaceId, actorUserId, action: "application.stage_changed",
    entityType: "application", entityId: id, details: { from: currentStage, to: stage } });

  if (currentStage === "rejected" && stage !== "rejected") {
    const cancelled = await tx.update(rejectionEmails).set({ status: "cancelled", updatedAt: new Date() }).where(and(
      eq(rejectionEmails.workspaceId, workspaceId), eq(rejectionEmails.applicationId, id),
      inArray(rejectionEmails.status, ["queued", "failed"]))).returning({ id: rejectionEmails.id });
    if (cancelled.length) await tx.insert(auditEvents).values(cancelled.map((row) => ({
      workspaceId, actorUserId, action: "application.rejection_email_cancelled",
      entityType: "application", entityId: id, details: { messageId: row.id },
    })));
  }
  return history;
}
