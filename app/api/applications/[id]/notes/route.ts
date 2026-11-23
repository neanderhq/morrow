import { and, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getMember } from "../../../../../server/access";
import { getDb } from "../../../../../server/db";
import { canAccessApplication, isUuid } from "../../../../../server/recruiting";
import { applicationNotes, applications, auditEvents, user } from "../../../../../server/schema";
import { sameOrigin, unauthorized } from "../../../../../server/http";

async function accessibleApplication(applicationId: string, workspaceId: string) {
  return getDb().select({ jobId: applications.jobId }).from(applications)
    .where(and(eq(applications.id, applicationId), eq(applications.workspaceId, workspaceId))).limit(1);
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const member = await getMember(request.headers);
  if (!member) return unauthorized();
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: "Application not found." }, { status: 404 });
  const [application] = await accessibleApplication(id, member.workspaceId);
  if (!application) return Response.json({ error: "Application not found." }, { status: 404 });
  if (!await canAccessApplication(member, application.jobId)) return Response.json({ error: "You do not have access to this application." }, { status: 403 });
  const author = alias(user, "application_note_author");
  const notes = await getDb().select({
    id: applicationNotes.id,
    body: applicationNotes.body,
    createdAt: applicationNotes.createdAt,
    authorUserId: applicationNotes.authorUserId,
    authorName: author.name,
  }).from(applicationNotes).innerJoin(author, eq(applicationNotes.authorUserId, author.id))
    .where(and(eq(applicationNotes.workspaceId, member.workspaceId), eq(applicationNotes.applicationId, id)))
    .orderBy(desc(applicationNotes.createdAt));
  return Response.json({ notes });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "Request origin was not accepted." }, { status: 403 });
  const member = await getMember(request.headers);
  if (!member) return unauthorized();
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: "Application not found." }, { status: 404 });
  const body = await request.json().catch(() => null) as { body?: unknown } | null;
  const noteBody = typeof body?.body === "string" ? body.body.trim() : "";
  if (!noteBody || noteBody.length > 5000) return Response.json({ error: "Notes must be 1–5,000 characters." }, { status: 400 });
  const [application] = await accessibleApplication(id, member.workspaceId);
  if (!application) return Response.json({ error: "Application not found." }, { status: 404 });
  if (!await canAccessApplication(member, application.jobId)) return Response.json({ error: "You do not have access to this application." }, { status: 403 });
  const saved = await getDb().transaction(async (tx) => {
    const [note] = await tx.insert(applicationNotes).values({
      workspaceId: member.workspaceId, applicationId: id, authorUserId: member.userId, body: noteBody,
    }).returning({ id: applicationNotes.id, body: applicationNotes.body, createdAt: applicationNotes.createdAt });
    await tx.insert(auditEvents).values({
      workspaceId: member.workspaceId, actorUserId: member.userId, action: "application.note_added",
      entityType: "application", entityId: id, details: { noteId: note.id },
    });
    return note;
  });
  return Response.json({ note: { ...saved, authorUserId: member.userId, authorName: member.name } }, { status: 201 });
}
