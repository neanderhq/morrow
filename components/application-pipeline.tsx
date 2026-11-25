"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatStableDateTime } from "../server/application-display";
import { applicationStageConfirmation, noteDeletionConfirmation } from "../server/confirmations";

const stages = [
  { value: "applied", label: "Applied" },
  { value: "screening", label: "Screening" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "hired", label: "Hired" },
  { value: "rejected", label: "Rejected" },
] as const;

type HistoryEntry = { id: string; fromStage: string | null; toStage: string; createdAt: string; actorName: string | null };
type Note = { id: string; body: string; createdAt: string; authorUserId: string; authorName: string };

export function ApplicationPipeline({
  applicationId,
  initialStage,
  initialHistory,
  currentUserId,
  canChangeStage,
  isAdmin,
}: {
  applicationId: string;
  initialStage: string;
  initialHistory: HistoryEntry[];
  currentUserId: string;
  canChangeStage: boolean;
  isAdmin: boolean;
}) {
  const [stage, setStage] = useState(initialStage);
  const [history, setHistory] = useState(initialHistory);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteBody, setNoteBody] = useState("");
  const [error, setError] = useState("");
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch(`/api/applications/${applicationId}/notes`, { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Notes could not be loaded.");
      if (active) setNotes(data.notes);
    }).catch((loadError) => {
      if (active) setError(loadError instanceof Error ? loadError.message : "Notes could not be loaded.");
    }).finally(() => { if (active) setLoadingNotes(false); });
    return () => { active = false; };
  }, [applicationId]);

  async function updateStage(nextStage: string) {
    if (nextStage === stage) return;
    const confirmation = applicationStageConfirmation(nextStage);
    if (confirmation && !window.confirm(confirmation)) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/applications/${applicationId}/stage`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ stage: nextStage }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Stage could not be changed.");
      setStage(data.stage);
      if (data.changed) window.dispatchEvent(new CustomEvent("morrow:application-stage-changed", { detail: applicationId }));
      if (data.changed && data.history) setHistory((current) => [...current, { ...data.history, fromStage: stage, toStage: data.stage, actorName: data.actorName ?? null }]);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Stage could not be changed.");
    } finally {
      setSaving(false);
    }
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/applications/${applicationId}/notes`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: noteBody }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Note could not be added.");
      setNotes((current) => [data.note, ...current]);
      setNoteBody("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Note could not be added.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(noteId: string) {
    if (!window.confirm(noteDeletionConfirmation)) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/applications/${applicationId}/notes/${noteId}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Note could not be deleted.");
      setNotes((current) => current.filter((note) => note.id !== noteId));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Note could not be deleted.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="grid min-w-0 gap-5 lg:grid-cols-2">
    <Card>
      <CardContent className="grid gap-5 p-5">
        <div><h2>Pipeline</h2><p className="mt-1 text-sm text-muted-foreground">Each application keeps its own stage history.</p></div>
        <div className="grid gap-2">
          <Label htmlFor="application-stage">Current stage</Label>
          <Select value={stage} onValueChange={(value) => void updateStage(value)} disabled={!canChangeStage || saving}>
            <SelectTrigger id="application-stage" className="w-full sm:w-64"><SelectValue /></SelectTrigger>
            <SelectContent>{stages.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
          {!canChangeStage && <p className="text-xs text-muted-foreground">You can view this application but cannot change its stage.</p>}
        </div>
        <div className="grid gap-3">
          <h3>Stage history</h3>
          {history.length ? <ol className="grid min-w-0 gap-0 border-l pl-4">{history.map((entry) => <li key={entry.id} className="relative min-w-0 border-b py-3 last:border-b-0"><span className="absolute -left-[1.3rem] top-4 size-2 rounded-full bg-primary" /><p className="break-words font-medium [overflow-wrap:anywhere]">{stages.find((item) => item.value === entry.toStage)?.label ?? entry.toStage}{entry.fromStage ? ` · from ${stages.find((item) => item.value === entry.fromStage)?.label ?? entry.fromStage}` : ""}</p><p className="mt-1 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">{entry.actorName || (entry.fromStage ? "Former staff member" : "Initial application")} · {formatStableDateTime(entry.createdAt)}</p></li>)}</ol> : <p className="text-sm text-muted-foreground">No stage history is available.</p>}
        </div>
      </CardContent>
    </Card>
    <Card>
      <CardContent className="grid gap-5 p-5">
        <div><h2>Team notes</h2><p className="mt-1 text-sm text-muted-foreground">Notes are visible to staff who can access this application.</p></div>
        <form onSubmit={(event) => void addNote(event)} className="grid gap-3">
          <Label htmlFor="application-note">Add a note</Label>
          <Textarea id="application-note" value={noteBody} onChange={(event) => setNoteBody(event.target.value)} rows={3} maxLength={5000} placeholder="Add context for your team…" required />
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted-foreground">Up to 5,000 characters</span><Button type="submit" size="sm" disabled={saving || !noteBody.trim()}>Add note</Button></div>
        </form>
        {error && <p role="alert" className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">{error}</p>}
        {loadingNotes ? <p className="text-sm text-muted-foreground">Loading notes…</p> : notes.length ? <ol className="grid min-w-0 gap-3">{notes.map((note) => <li key={note.id} className="min-w-0 rounded-md border p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="break-words text-sm font-medium [overflow-wrap:anywhere]">{note.authorName}</p><time className="text-xs text-muted-foreground" dateTime={note.createdAt}>{formatStableDateTime(note.createdAt)}</time></div>{(isAdmin || note.authorUserId === currentUserId) && <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => void deleteNote(note.id)}>Delete</Button>}</div><p className="mt-3 break-words whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]">{note.body}</p></li>)}</ol> : <p className="text-sm text-muted-foreground">No notes yet.</p>}
      </CardContent>
    </Card>
  </div>;
}
