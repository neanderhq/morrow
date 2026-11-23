import { lt, sql } from "drizzle-orm";
import { getDb } from "./db";
import { applicationSubmissionLimits } from "./schema";
import { APPLICATION_SUBMISSION_LIMIT, APPLICATION_SUBMISSION_WINDOW_MS, shouldAcceptApplicationSubmission } from "./application-rate-limit-policy";

export { APPLICATION_SUBMISSION_LIMIT, APPLICATION_SUBMISSION_WINDOW_MS, applicationSubmissionClientKey, applicationClientIdentitySetCookie, issueApplicationClientIdentity, shouldAcceptApplicationSubmission, verifyApplicationClientIdentity } from "./application-rate-limit-policy";
let nextCleanupAt = 0;

export async function consumeApplicationSubmission(clientKeyHash: string, now = new Date()) {
  const db = getDb();
  const resetBefore = new Date(now.getTime() - APPLICATION_SUBMISSION_WINDOW_MS);
  const [limit] = await db.insert(applicationSubmissionLimits).values({
    clientKeyHash,
    windowStartedAt: now,
    requestCount: 1,
  }).onConflictDoUpdate({
    target: applicationSubmissionLimits.clientKeyHash,
    set: {
      windowStartedAt: sql`case when ${applicationSubmissionLimits.windowStartedAt} <= ${resetBefore} then ${now} else ${applicationSubmissionLimits.windowStartedAt} end`,
      requestCount: sql`case when ${applicationSubmissionLimits.windowStartedAt} <= ${resetBefore} then 1 else least(${applicationSubmissionLimits.requestCount} + 1, ${APPLICATION_SUBMISSION_LIMIT + 1}) end`,
    },
  }).returning({ requestCount: applicationSubmissionLimits.requestCount, windowStartedAt: applicationSubmissionLimits.windowStartedAt });

  if (now.getTime() >= nextCleanupAt) {
    nextCleanupAt = now.getTime() + APPLICATION_SUBMISSION_WINDOW_MS * 5;
    await db.delete(applicationSubmissionLimits).where(lt(
      applicationSubmissionLimits.windowStartedAt,
      new Date(now.getTime() - APPLICATION_SUBMISSION_WINDOW_MS * 24),
    ));
  }

  return {
    accepted: shouldAcceptApplicationSubmission(limit.requestCount),
    retryAfterSeconds: Math.max(1, Math.ceil((limit.windowStartedAt.getTime() + APPLICATION_SUBMISSION_WINDOW_MS - now.getTime()) / 1000)),
  };
}
