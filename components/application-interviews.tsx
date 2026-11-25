"use client";

import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";
import { displayInterviewTime, zonedLocalTime } from "@/lib/interview-time";
import { formatStableDateTime } from "@/server/application-display";
import { fieldStyle, useApplicationSection } from "./application-section";

type Interview = {
  id: string; interviewerId: string; interviewerName: string; startsAt: string; endsAt: string | null;
  timeZone: string; location: string; status: string; revision: number;
};
type ScheduleState = {
  canManage: boolean; closed: boolean; jobTitle: string; options: { id: string; name: string }[];
  bookings: Interview[]; history: { id: string; interviewId: string; event: string; actorName: string | null; at: string }[];
};
type BookingDraft = { id: string; revision?: number; interviewerId: string; start: string; end: string; timeZone: string; location: string };

function makeDraft(existing: Interview | null, preferredTimeZone: string): BookingDraft {
  return existing ? {
    id: existing.id, revision: existing.revision, interviewerId: existing.interviewerId, timeZone: existing.timeZone,
    start: zonedLocalTime(new Date(existing.startsAt), existing.timeZone),
    end: existing.endsAt ? zonedLocalTime(new Date(existing.endsAt), existing.timeZone) : "", location: existing.location,
  } : { id: crypto.randomUUID(), interviewerId: "", timeZone: preferredTimeZone, start: "", end: "", location: "" };
}

function copyDetails(jobTitle: string, booking: Interview) {
  const start = displayInterviewTime(booking.startsAt, booking.timeZone);
  const end = booking.endsAt ? displayInterviewTime(booking.endsAt, booking.timeZone) : "End time unavailable";
  const duration = booking.endsAt ? " (" + (Date.parse(booking.endsAt) - Date.parse(booking.startsAt)) / 60_000 + " minutes)" : "";
  return ["Interview for " + jobTitle, start + " – " + end + " · " + booking.timeZone + duration, booking.location].join("\n");
}

const historyLabels: Record<string, string> = {
  "interview.scheduled": "Scheduled", "interview.rescheduled": "Rescheduled", "interview.cancelled": "Cancelled",
};

export function ApplicationInterviews({ id }: { id: string }) {
  const { data, error, notice, busy, request } = useApplicationSection<ScheduleState>("/api/applications/" + id + "/interviews");
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [copyNotice, setCopyNotice] = useState("");
  const [copyFallback, setCopyFallback] = useState("");
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const firstField = useRef<HTMLSelectElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const editorOpen = draft !== null;
  useEffect(() => { if (editorOpen) firstField.current?.focus(); }, [editorOpen]);

  function openEditor(event: MouseEvent<HTMLButtonElement>, interview: Interview | null) {
    trigger.current = event.currentTarget;
    setDraft(makeDraft(interview, Intl.DateTimeFormat().resolvedOptions().timeZone));
  }

  function closeEditor() {
    setDraft(null);
    requestAnimationFrame(() => trigger.current?.focus());
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    const action = draft.revision === undefined ? "schedule" : "reschedule";
    if (await request({ ...draft, action }, action === "schedule" ? "Interview scheduled." : "Interview rescheduled.")) closeEditor();
  }

  async function copy(interview: Interview) {
    if (!data) return;
    const details = copyDetails(data.jobTitle, interview);
    const copied = await copyTextToClipboard(details);
    setCopyFallback(copied ? "" : details);
    setCopyNotice(copied ? "Interview details copied. Share them with the candidate." : "Select and copy the interview details below.");
  }

  return <Card id="manual-interviews"><CardContent className="grid min-w-0 gap-5 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2>Interviews</h2><p className="text-sm text-muted-foreground">Record an agreed time and share the details manually.</p></div>
      {data?.canManage && <Button type="button" disabled={data.closed || busy || editorOpen} onClick={(event) => openEditor(event, null)}>Schedule interview</Button>}
    </div>
    {data?.closed && <p className="text-sm text-muted-foreground">Reopen the job to schedule or reschedule.</p>}
    {draft && data && <form onSubmit={(event) => void save(event)} className="grid min-w-0 gap-3 rounded-lg border p-4"
      aria-label={draft.revision === undefined ? "New interview" : "Reschedule interview"} aria-describedby="interview-error"
      onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeEditor(); } }}>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <div className="grid min-w-0 gap-2">
          <Label htmlFor="booking-interviewer">Interviewer</Label>
          <select ref={firstField} id="booking-interviewer" className={fieldStyle} required value={draft.interviewerId}
            onChange={(event) => setDraft({ ...draft, interviewerId: event.target.value })}>
            <option value="">Choose assigned interviewer</option>
            {data.options.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        </div>
        <div className="grid min-w-0 gap-2">
          <Label htmlFor="booking-zone">Time zone</Label>
          <input id="booking-zone" className={fieldStyle} required value={draft.timeZone} list="booking-zones"
            onChange={(event) => setDraft({ ...draft, timeZone: event.target.value })} />
          <datalist id="booking-zones">{["UTC", "Asia/Kolkata", "America/New_York", "America/Los_Angeles", "Europe/London"].map((zone) => <option key={zone} value={zone} />)}</datalist>
        </div>
        <div className="grid min-w-0 gap-2">
          <Label htmlFor="booking-start">Start time</Label>
          <input id="booking-start" className={fieldStyle} required type="datetime-local" value={draft.start}
            onChange={(event) => setDraft({ ...draft, start: event.target.value })} />
        </div>
        <div className="grid min-w-0 gap-2">
          <Label htmlFor="booking-end">End time</Label>
          <input id="booking-end" className={fieldStyle} required type="datetime-local" value={draft.end}
            onChange={(event) => setDraft({ ...draft, end: event.target.value })} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="booking-location">Location or meeting link</Label>
        <input id="booking-location" className={fieldStyle} required maxLength={300} value={draft.location}
          onChange={(event) => setDraft({ ...draft, location: event.target.value })} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>{draft.revision === undefined ? "Save interview" : "Save new time"}</Button>
        <Button variant="outline" type="button" onClick={closeEditor}>Close editor</Button>
      </div>
    </form>}
    {data && data.bookings.length === 0 && <p className="text-sm text-muted-foreground">No interviews recorded for this application.</p>}
    {data?.bookings.map((interview) => {
      const cancelled = interview.status === "cancelled";
      return <section key={interview.id} className="grid min-w-0 gap-3 rounded-lg border p-4" aria-label={"Interview with " + interview.interviewerName}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="[overflow-wrap:anywhere]">{interview.interviewerName}</h3>
          <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">{cancelled ? "Cancelled" : "Scheduled"}</span>
        </div>
        <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{copyDetails(data.jobTitle, interview)}</p>
        {!cancelled && <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void copy(interview)}>Copy interview details</Button>
          {data.canManage && <Button size="sm" variant="outline" disabled={data.closed || busy || editorOpen} onClick={(event) => openEditor(event, interview)}>Reschedule</Button>}
          {data.canManage && <Button size="sm" variant="outline" disabled={busy || editorOpen} onClick={() => setConfirmCancel(interview.id)}>Cancel interview</Button>}
        </div>}
        {confirmCancel === interview.id && !cancelled && <div className="grid gap-2">
          <p className="text-sm">Cancel this booking and keep it in history?</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="destructive" disabled={busy} onClick={async () => {
              if (await request({ id: interview.id, revision: interview.revision, action: "cancel" }, "Interview cancelled.")) setConfirmCancel(null);
            }}>Confirm cancellation</Button>
            <Button size="sm" variant="outline" onClick={() => setConfirmCancel(null)}>Keep interview</Button>
          </div>
        </div>}
        <ul className="grid gap-1 text-xs text-muted-foreground">
          {data.history.filter((entry) => entry.interviewId === interview.id).map((entry) =>
            <li key={entry.id} className="[overflow-wrap:anywhere]">{historyLabels[entry.event]} by {entry.actorName ?? "Former staff"} · {formatStableDateTime(entry.at)}</li>)}
        </ul>
      </section>;
    })}
    {copyFallback && <div className="grid gap-2"><Label htmlFor="interview-copy-text">Copyable interview details</Label>
      <textarea id="interview-copy-text" className={fieldStyle} rows={4} readOnly value={copyFallback} /></div>}
    {busy && !data && <p className="text-sm text-muted-foreground">Loading interviews…</p>}
    <div id="interview-error" role="alert" className={error ? "text-sm text-destructive" : undefined}>{error}</div>
    <div role="status" className="text-sm text-muted-foreground">{notice || copyNotice}</div>
  </CardContent></Card>;
}
