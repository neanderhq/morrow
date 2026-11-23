import { and, eq } from "drizzle-orm";
import { getMember } from "../../../../../../server/access";
import { getDb } from "../../../../../../server/db";
import { canDeleteApplicationNote } from "../../../../../../server/policy";
import { canAccessApplication, isUuid } from "../../../../../../server/recruiting";
import { applicationNotes, applications, auditEvents } from "../../../../../../server/schema";
import { sameOrigin, unauthorized } from "../../../../../../server/http";

export async function DELETE(request: Request, context: { params: Promise<{ id: string; noteId: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "Request origin was not accepted." }, { status: 403 });
  const member = await getMember(request.headers);
  if (!member) return unauthorized();
  const { id, noteId } = await context.params;
  if (!isUuid(id) || !isUuid(noteId)) return Response.json({ error: "Note not found." }, { status: 404 });
  const db = getDb();
  const [application] = await db.select({ jobId: applications.jobId }).from(applications)
    .where(and(eq(applications.id, id), eq(applications.workspaceId, member.workspaceId))).limit(1);
  if (!application) return Response.json({ error: "Application not found." }, { status: 404 });
  if (!await canAccessApplication(member, application.jobId)) return Response.json({ error: "You do not have access to this application." }, { status: 403 });
  const result = await db.transaction(async (tx) => {
    const [note] = await tx.select({ authorUserId: applicationNotes.authorUserId }).from(applicationNotes)
      .where(and(
        eq(applicationNotes.id, noteId),
        eq(applicationNotes.workspaceId, member.workspaceId),
        eq(applicationNotes.applicationId, id),
      )).limit(1);
    if (!note) return { status: 404 as const, error: "Note not found." };
    if (!canDeleteApplicationNote(member.role, member.userId, note.authorUserId)) {
      return { status: 403 as const, error: "Only the note author or an Admin can delete this note." };
    }
    await tx.delete(applicationNotes).where(and(
      eq(applicationNotes.id, noteId), eq(applicationNotes.workspaceId, member.workspaceId),
      eq(applicationNotes.applicationId, id),
    ));
    await tx.insert(auditEvents).values({
      workspaceId: member.workspaceId, actorUserId: member.userId, action: "application.note_deleted",
      entityType: "application", entityId: id, details: { noteId },
    });
    return { status: 200 as const };
  });
  if (result.status !== 200) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ success: true });
}
