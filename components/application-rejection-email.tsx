"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatStableDateTime } from "@/server/application-display";
import { fieldStyle, useApplicationSection } from "./application-section";

type EmailEntry = {
  id: string; stageEventId: string; status: string; subject: string; body: string; recipient: string; sender: string;
  providerMessageId: string | null; createdAt: string; updatedAt: string; createdBy: string; dispatchedBy: string | null; reason: string | null;
};
type RejectionState = {
  configured: boolean; sender: string | null; recipient: string | null; jobTitle: string; stage: string; stageEventId: string | null;
  messages: EmailEntry[];
};

const labels: Record<string, string> = {
  queued: "Ready to send", sending: "Sending", accepted: "Accepted by provider",
  failed: "Send failed", unknown: "Outcome uncertain", cancelled: "Cancelled before dispatch",
};

export function ApplicationRejectionEmail({ id }: { id: string }) {
  const { data, error, notice, busy, request } = useApplicationSection<RejectionState>("/api/applications/" + id + "/rejection-email");
  const [draft, setDraft] = useState<{ id: string; stageEventId: string | null; subject: string; body: string } | null>(null);
  const open = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const subjectField = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const editing = draft !== null;

  useEffect(() => {
    if (editing) subjectField.current?.focus();
  }, [editing]);
  useEffect(() => {
    function reloadOnStage(event: Event) {
      if ((event as CustomEvent<string>).detail === id) void request();
    }
    window.addEventListener("morrow:application-stage-changed", reloadOnStage);
    return () => window.removeEventListener("morrow:application-stage-changed", reloadOnStage);
  }, [id, request]);

  function start() {
    if (!data) return;
    setDraft({
      id: crypto.randomUUID(), stageEventId: data.stageEventId,
      subject: "Update on your application",
      body: "Thank you for applying for " + data.jobTitle + ". We have decided to close this application. We appreciate the time you spent with us.",
    });
  }

  function close() {
    setDraft(null);
    requestAnimationFrame(() => (open.current ?? title.current)?.focus());
  }

  async function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    const result = await request({ ...draft, action: "prepare" }, "Rejection recorded. Review the prepared email before sending.");
    if (result) {
      close();
      router.refresh();
    }
  }

  const currentMessage = data?.messages.some((entry) => entry.stageEventId === data.stageEventId);
  return <Card id="rejection-email"><CardContent className="grid min-w-0 gap-5 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 ref={title} tabIndex={-1}>Rejection email</h2><p className="text-sm text-muted-foreground">Use the pipeline to reject without email.</p></div>
      {data?.configured && data.recipient && !currentMessage && !editing &&
        <Button ref={open} onClick={start} disabled={busy}>Prepare rejection email</Button>}
    </div>
    {data && !data.configured && <p className="rounded-md bg-muted p-3 text-sm">Rejection email is unconfigured. You can still reject this application without email.</p>}
    {data?.configured && !data.recipient && <p className="text-sm text-muted-foreground">This application has no recipient email.</p>}
    {draft && data && <form className="grid min-w-0 gap-4 rounded-lg border p-4" aria-label="Rejection email preview"
      aria-describedby="rejection-error" onSubmit={(event) => void prepare(event)}
      onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); close(); } }}>
      <div className="grid gap-1 text-sm [overflow-wrap:anywhere]">
        <p><strong>Job</strong> {data.jobTitle}</p><p><strong>To</strong> {data.recipient}</p><p><strong>From</strong> {data.sender}</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="rejection-subject">Subject</Label>
        <input ref={subjectField} className={fieldStyle} id="rejection-subject" maxLength={180} required value={draft.subject}
          onChange={(event) => setDraft({ ...draft, subject: event.target.value })} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="rejection-message">Message</Label>
        <Textarea id="rejection-message" rows={5} maxLength={5000} required value={draft.body}
          onChange={(event) => setDraft({ ...draft, body: event.target.value })} />
      </div>
      <p className="text-sm text-muted-foreground">Preparing changes the stage to Rejected and saves the message for a separate send confirmation.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>Reject and prepare email</Button>
        <Button type="button" variant="outline" onClick={close}>Cancel preview</Button>
      </div>
    </form>}
    {data?.messages.map((entry) => {
      const canSend = data.stage === "rejected" && entry.stageEventId === data.stageEventId && data.configured;
      return <section key={entry.id} className="grid min-w-0 gap-2 rounded-lg border p-4" aria-label="Rejection email history">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="[overflow-wrap:anywhere]">{entry.subject}</h3>
          <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">{labels[entry.status] ?? entry.status}</span>
        </div>
        <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">To {entry.recipient} · Prepared by {entry.createdBy} on {formatStableDateTime(entry.createdAt)}</p>
        {entry.dispatchedBy && <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">Last send action by {entry.dispatchedBy} · {formatStableDateTime(entry.updatedAt)}</p>}
        {entry.status === "accepted" && <p className="text-sm text-muted-foreground">Inbox delivery is unverified.{entry.providerMessageId ? " Provider ID " + entry.providerMessageId : ""}</p>}
        {entry.status === "sending" && <Button size="sm" variant="outline" disabled={busy} onClick={() => void request()}>Refresh send status</Button>}
        {entry.reason && <p className="text-sm text-muted-foreground">{entry.reason}</p>}
        <details className="grid min-w-0 gap-2 text-sm">
          <summary className="cursor-pointer text-primary">Review message</summary>
          <p className="mt-2 whitespace-pre-wrap [overflow-wrap:anywhere]">{entry.body}</p>
        </details>
        {canSend && entry.status === "queued" && <div><Button disabled={busy} onClick={() => void request({ id: entry.id, action: "send" }, "Send outcome updated.")}>Send email</Button></div>}
        {canSend && entry.status === "failed" && <div><Button variant="outline" disabled={busy} onClick={() => void request({ id: entry.id, action: "retry" }, "Retry outcome updated.")}>Retry failed email</Button></div>}
      </section>;
    })}
    {busy && !data && <p className="text-sm text-muted-foreground">Loading email history…</p>}
    <div id="rejection-error" role="alert" className={error ? "text-sm text-destructive" : undefined}>{error}</div>
    <div role="status" className="text-sm text-muted-foreground">{notice}</div>
  </CardContent></Card>;
}
