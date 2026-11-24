import { and, eq, or, sql } from "drizzle-orm";
import { getDb } from "../../../../../server/db";
import { validEmail } from "../../../../../server/policy";
import { candidateProfileName, isUuid, normalizeApplicantEmail, validWebUrl } from "../../../../../server/recruiting";
import { MAX_RESUME_BYTES, validateResumeBytes } from "../../../../../server/resume-validation";
import { applicationStageHistory, applications, auditEvents, candidates, jobs, workspaces } from "../../../../../server/schema";
import { sameOrigin } from "../../../../../server/http";
import { applicationSubmissionClientKey, consumeApplicationSubmission } from "../../../../../server/application-rate-limit";

const response = (error: string, status: number) => Response.json({ error }, { status });
const resumeError = (error: string) => Response.json({ error, field: "resume" }, { status: 400 });
type ApplyResult = { ok: true; id: string } | { ok: false; error: string; status: 404 | 409 | 410 };

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return response("Request origin was not accepted.", 403);
  const { id: jobId } = await context.params;
  if (!isUuid(jobId)) return response("Job not found.", 404);
  const db = getDb();
  const [job] = await db.select({ id: jobs.id, workspaceId: jobs.workspaceId, state: jobs.state, title: jobs.title })
    .from(jobs).innerJoin(workspaces, eq(jobs.workspaceId, workspaces.id))
    .where(and(eq(jobs.id, jobId), eq(workspaces.singletonKey, "primary"))).limit(1);
  if (!job) return response("Job not found.", 404);
  if (job.state === "closed") return response("This job is no longer accepting applications.", 410);
  if (job.state !== "published") return response("This job is not accepting applications.", 404);

  const clientKey = applicationSubmissionClientKey(request.headers, process.env.BETTER_AUTH_SECRET ?? "");
  if (!clientKey) return response("Please refresh the application form and try again.", 403);

  const form = await request.formData().catch(() => null);
  if (!form) return response("Complete the application form and try again.", 400);
  const fullName = String(form.get("fullName") ?? "").trim();
  const email = normalizeApplicantEmail(String(form.get("email") ?? ""));
  const phone = String(form.get("phone") ?? "").trim();
  const portfolioUrl = String(form.get("portfolioUrl") ?? "").trim();
  const coverNote = String(form.get("coverNote") ?? "").trim();
  const file = form.get("resume");
  if (fullName.length < 2 || fullName.length > 200) return response("Enter your full name (2–200 characters).", 400);
  if (!validEmail(email)) return response("Enter a valid email address.", 400);
  if (phone.length > 50) return response("Phone number must be 50 characters or fewer.", 400);
  if (!validWebUrl(portfolioUrl)) return response("Enter a valid LinkedIn or portfolio link starting with http:// or https://.", 400);
  if (coverNote.length > 2000) return response("Cover note must be 2,000 characters or fewer.", 400);
  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") return resumeError("Choose a PDF or DOCX resume file.");
  if (file.size === 0) return resumeError("Choose a resume file; the selected file is empty.");
  if (file.size > MAX_RESUME_BYTES) return resumeError("Resume must be 5 MB or smaller.");
  const fileBytes = Buffer.from(await file.arrayBuffer());
  const validation = validateResumeBytes(fileBytes);
  if (!validation.ok) return resumeError(validation.error);
  const limit = await consumeApplicationSubmission(clientKey);
  if (!limit.accepted) {
    return Response.json({ error: "Too many applications from this connection. Please wait before trying again." }, {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });
  }

  try {
    const application: ApplyResult = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${jobId}))`);
      const [currentJob] = await tx.select({ workspaceId: jobs.workspaceId, state: jobs.state, title: jobs.title })
        .from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.workspaceId, job.workspaceId))).limit(1);
      if (!currentJob || currentJob.state === "draft") return { ok: false as const, error: "This job is not accepting applications.", status: 404 as const };
      if (currentJob.state === "closed") return { ok: false as const, error: "This job is no longer accepting applications.", status: 410 as const };
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${job.workspaceId}), hashtext(${email}))`);
      const [candidate] = await tx.select({ id: candidates.id, name: candidates.name }).from(candidates)
        .where(and(eq(candidates.workspaceId, job.workspaceId), sql`lower(${candidates.email}) = ${email}`)).limit(1);
      const duplicateConditions = [eq(applications.applicantEmail, email)];
      if (candidate) duplicateConditions.push(eq(applications.candidateId, candidate.id));
      const [existing] = await tx.select({ id: applications.id }).from(applications)
        .where(and(eq(applications.workspaceId, job.workspaceId), eq(applications.jobId, jobId), or(...duplicateConditions))).limit(1);
      if (existing) return { ok: false as const, error: "You’ve already applied for this job with that email address.", status: 409 as const };
      const candidateName = candidateProfileName(candidate?.name ?? null, fullName);
      const savedCandidate = candidate ?? (await tx.insert(candidates).values({
        workspaceId: job.workspaceId, name: candidateName, email,
      }).returning({ id: candidates.id }))[0];
      const [savedApplication] = await tx.insert(applications).values({
        workspaceId: job.workspaceId,
        jobId,
        candidateId: savedCandidate.id,
        applicantName: fullName,
        applicantEmail: email,
        phone: phone || null,
        portfolioUrl: portfolioUrl || null,
        coverNote: coverNote || null,
        resumeData: fileBytes,
        resumeName: file.name,
        resumeType: validation.type,
      }).returning({ id: applications.id });
      await tx.insert(applicationStageHistory).values({
        workspaceId: job.workspaceId,
        applicationId: savedApplication.id,
        fromStage: null,
        toStage: "applied",
        actorUserId: null,
      });
      await tx.insert(auditEvents).values({
        workspaceId: job.workspaceId, actorUserId: null, action: "application.received", entityType: "application", entityId: savedApplication.id,
        details: { jobId, jobTitle: currentJob.title, applicantName: fullName, applicantEmail: email },
      });
      return { ok: true as const, id: savedApplication.id };
    });
    if (!application.ok) return response(application.error, application.status);
    return Response.json({ applicationId: application.id }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return response("You’ve already applied for this job with that email address.", 409);
    }
    console.error("Unable to save application", error);
    return response("We could not save your application. Please try again.", 500);
  }
}
