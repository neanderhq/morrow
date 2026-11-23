import { and, eq } from "drizzle-orm";
import { getMember } from "../../../../../server/access";
import { getDb } from "../../../../../server/db";
import { canAccessApplication, isUuid } from "../../../../../server/recruiting";
import { resumeContentType, safeResumeFilename } from "../../../../../server/resume-validation";
import { applications } from "../../../../../server/schema";
import { unauthorized } from "../../../../../server/http";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const member = await getMember(request.headers);
  if (!member) return unauthorized();
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: "Resume not found." }, { status: 404 });
  const [application] = await getDb().select({
    jobId: applications.jobId,
    resumeData: applications.resumeData,
    resumeName: applications.resumeName,
    resumeType: applications.resumeType,
  }).from(applications).where(and(eq(applications.id, id), eq(applications.workspaceId, member.workspaceId))).limit(1);
  if (!application) return Response.json({ error: "Resume not found." }, { status: 404 });
  if (!await canAccessApplication(member, application.jobId)) return Response.json({ error: "You do not have access to this resume." }, { status: 403 });
  if (!application.resumeData) return Response.json({ error: "No resume is stored for this application." }, { status: 404 });
  const filename = safeResumeFilename(application.resumeName || "resume", application.resumeType);
  const bytes = new Uint8Array(application.resumeData.byteLength);
  bytes.set(application.resumeData);
  return new Response(bytes.buffer, {
    headers: {
      "Content-Type": resumeContentType(application.resumeType),
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
