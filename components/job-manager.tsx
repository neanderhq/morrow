"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { StaffRole } from "../server/policy";

type Job = {
  id: string;
  title: string;
  department: string | null;
  location: string;
  employmentType: "full_time" | "part_time" | "contract";
  remote: boolean;
  description: string;
  hiringManagerId: string | null;
  hiringManagerName: string | null;
  interviewerIds: string[];
  state: "draft" | "published" | "closed";
  applicationCount: number;
};
type StaffOption = { id: string; name: string; email: string };
type Event = { id: string; action: string; createdAt: string; actorName: string | null; details: Record<string, unknown> };
type JobDraft = Omit<Job, "id" | "hiringManagerName" | "state" | "applicationCount"> & { id?: string; interviewerIds: string[] };

const emptyDraft = (): JobDraft => ({
  title: "", department: "", location: "", employmentType: "full_time", remote: false,
  description: "", hiringManagerId: "", interviewerIds: [],
});

const stateLabel = (state: Job["state"]) => state[0].toUpperCase() + state.slice(1);
const employmentLabel = (type: Job["employmentType"]) => ({ full_time: "Full time", part_time: "Part time", contract: "Contract" })[type];

export function JobManager({ role }: { role: StaffRole }) {
  const canManage = role === "admin" || role === "recruiter";
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState("all");
  const [draft, setDraft] = useState<JobDraft | null>(null);
  const [managers, setManagers] = useState<StaffOption[]>([]);
  const [interviewers, setInterviewers] = useState<StaffOption[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState("");
  const [editorError, setEditorError] = useState("");
  const [message, setMessage] = useState("");
  const jobTitle = useRef<HTMLInputElement>(null);
  const editorAlert = useRef<HTMLParagraphElement>(null);
  const createTrigger = useRef<HTMLButtonElement>(null);
  const editorTrigger = useRef<HTMLButtonElement | null>(null);
  const jobsRequest = useRef(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingJob, setPendingJob] = useState("");

  const loadJobs = useCallback(async (showLoading = true) => {
    const request = ++jobsRequest.current;
    if (showLoading) setLoading(true);
    setError("");
    const query = filter === "all" ? "" : `?status=${filter}`;
    try {
      const response = await fetch(`/api/jobs${query}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Jobs could not be loaded.");
      if (request === jobsRequest.current) setJobs(data.jobs);
    } catch (loadError) {
      if (request === jobsRequest.current) setError(loadError instanceof Error ? loadError.message : "Jobs could not be loaded.");
    } finally {
      if (request === jobsRequest.current) setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void loadJobs(); }, [loadJobs]);

  useEffect(() => {
    if (!canManage) return;
    void fetch("/api/jobs/options", { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (response.ok) {
        setManagers(data.hiringManagers);
        setInterviewers(data.interviewers);
      }
    }).catch(() => setError("Staff assignment options could not be loaded."));
    if (role === "admin") {
      void fetch("/api/audit", { cache: "no-store" }).then(async (response) => {
        const data = await response.json();
        if (response.ok) setEvents(data.events);
      }).catch(() => setError("The audit trail could not be loaded."));
    }
  }, [canManage, role]);

  useEffect(() => {
    if (editorError) editorAlert.current?.focus();
  }, [editorError]);

  function openEditor(nextDraft: JobDraft, trigger: HTMLButtonElement) {
    editorTrigger.current = trigger;
    setEditorError("");
    setMessage("");
    setDraft(nextDraft);
  }

  function editJob(job: Job, trigger: HTMLButtonElement) {
    openEditor({
      id: job.id, title: job.title, department: job.department || "", location: job.location,
      employmentType: job.employmentType, remote: job.remote, description: job.description,
      hiringManagerId: job.hiringManagerId || "", interviewerIds: job.interviewerIds,
    }, trigger);
  }

  async function saveJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || saving) return;
    setSaving(true);
    setEditorError("");
    try {
      const response = await fetch(draft.id ? `/api/jobs/${draft.id}` : "/api/jobs", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Job could not be saved.");
    } catch (saveError) {
      setEditorError(saveError instanceof Error ? saveError.message : "Job could not be saved.");
      return;
    } finally {
      setSaving(false);
    }

    setDraft(null);
    setMessage(draft.id ? "Job changes saved." : "Draft created.");
    if (!draft.id && filter !== "all" && filter !== "draft") {
      setFilter("draft");
    } else {
      void loadJobs(false);
    }
    if (role === "admin") {
      void fetch("/api/audit", { cache: "no-store" }).then(async (auditResponse) => {
        if (!auditResponse.ok) throw new Error();
        setEvents((await auditResponse.json()).events);
      }).catch(() => setError("The audit trail could not be refreshed."));
    }
  }

  async function transition(job: Job, action: "publish" | "close" | "reopen") {
    setPendingJob(job.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/jobs/${job.id}/status`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Job status could not be changed.");
      await loadJobs();
      if (role === "admin") {
        const auditResponse = await fetch("/api/audit", { cache: "no-store" });
        const auditData = await auditResponse.json();
        if (auditResponse.ok) setEvents(auditData.events);
      }
    } catch (transitionError) {
      setError(transitionError instanceof Error ? transitionError.message : "Job status could not be changed.");
    } finally {
      setPendingJob("");
    }
  }

  return <div className="grid min-w-0 grid-cols-1 gap-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><h1>Jobs</h1><p className="mt-2 text-muted-foreground">Open roles, hiring teams, and applications in your workspace.</p></div>
      {canManage && <Button ref={createTrigger} type="button" aria-haspopup="dialog" onClick={(event) => openEditor(emptyDraft(), event.currentTarget)}>Create job</Button>}
    </header>
    {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
    {message && <p role="status" className="text-sm font-medium text-success">{message}</p>}
    <Dialog open={draft !== null} onOpenChange={(open) => { if (!open && !saving) setDraft(null); }}>
      {draft && <DialogContent
        className="max-h-[calc(100dvh-2rem)] grid-cols-1 overflow-x-hidden overflow-y-auto overscroll-contain p-4 sm:max-w-2xl sm:p-6"
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          jobTitle.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const trigger = editorTrigger.current;
          (trigger?.isConnected ? trigger : createTrigger.current)?.focus();
        }}
      >
        <DialogHeader className="text-left">
          <DialogTitle>{draft.id ? "Edit job" : "Create a job"}</DialogTitle>
          <DialogDescription>{draft.id ? "Update the role and its hiring team." : "Save a draft to review before publishing."}</DialogDescription>
        </DialogHeader>
        <form className="grid min-w-0 grid-cols-1 gap-4" onSubmit={saveJob}>
          {editorError && <p ref={editorAlert} tabIndex={-1} role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{editorError}</p>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2"><Label htmlFor="job-title">Job title</Label><Input ref={jobTitle} id="job-title" required maxLength={140} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></div>
            <div className="grid gap-2"><Label htmlFor="job-department">Department</Label><Input id="job-department" maxLength={100} value={draft.department || ""} onChange={(event) => setDraft({ ...draft, department: event.target.value })} /></div>
            <div className="grid gap-2"><Label htmlFor="job-location">Location</Label><Input id="job-location" required maxLength={140} placeholder="City, State or country" value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} /></div>
            <div className="grid gap-2"><Label htmlFor="job-employment">Employment type</Label><select id="job-employment" className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm" value={draft.employmentType} onChange={(event) => setDraft({ ...draft, employmentType: event.target.value as JobDraft["employmentType"] })}><option value="full_time">Full time</option><option value="part_time">Part time</option><option value="contract">Contract</option></select></div>
            <div className="grid gap-2"><Label htmlFor="job-manager">Hiring manager</Label><select id="job-manager" required className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm" value={draft.hiringManagerId || ""} onChange={(event) => setDraft({ ...draft, hiringManagerId: event.target.value })}><option value="">Choose a hiring manager</option>{managers.map((person) => <option key={person.id} value={person.id}>{person.name} ({person.email})</option>)}</select></div>
            <label className="flex min-h-10 items-center gap-3 text-sm"><input type="checkbox" checked={draft.remote} onChange={(event) => setDraft({ ...draft, remote: event.target.checked })} />Remote option</label>
          </div>
          <fieldset className="grid min-w-0 gap-2"><legend className="mb-2 text-sm font-medium">Interviewers assigned to this job</legend><div className="grid gap-2 sm:grid-cols-2">{interviewers.length ? interviewers.map((person) => <label key={person.id} className="flex min-w-0 flex-wrap items-center gap-2 text-sm"><input type="checkbox" checked={draft.interviewerIds.includes(person.id)} onChange={(event) => setDraft({ ...draft, interviewerIds: event.target.checked ? [...draft.interviewerIds, person.id] : draft.interviewerIds.filter((id) => id !== person.id) })} />{person.name} <span className="min-w-0 wrap-anywhere text-muted-foreground">{person.email}</span></label>) : <p className="text-sm text-muted-foreground">Invite an Interviewer in Staff before assigning one.</p>}</div></fieldset>
          <div className="grid gap-2"><Label htmlFor="job-description">Description</Label><Textarea id="job-description" required minLength={10} maxLength={20000} rows={8} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => setDraft(null)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : draft.id ? "Save changes" : "Create draft"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>}
    </Dialog>

    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl">Openings</h2><p className="mt-1 text-sm text-muted-foreground">{canManage ? "Manage job details and lifecycle." : "Only jobs assigned to you are shown."}</p></div><div className="grid gap-1.5"><Label htmlFor="job-filter">Filter by status</Label><select id="job-filter" className="h-9 min-w-40 rounded-md border border-input bg-background px-3 text-sm" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All statuses</option><option value="draft">Draft</option><option value="published">Published</option><option value="closed">Closed</option></select></div></div>
    {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading jobs…</p> : jobs.length === 0 ? <Card><CardContent className="px-5 py-12 text-center"><h3>No jobs match this filter</h3><p className="mt-2 text-muted-foreground">{canManage ? "Create a draft to get started." : "You’ll see jobs here when you’re assigned to them."}</p></CardContent></Card> : <div className="grid min-w-0 grid-cols-1 gap-3">{jobs.map((job) => <Card id={`job-${job.id}`} key={job.id}><CardContent className="flex min-w-0 flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="min-w-0 wrap-anywhere">{job.title}</h3><Badge variant="secondary">{stateLabel(job.state)}</Badge>{job.remote && <Badge variant="outline">Remote</Badge>}</div><p className="mt-1 wrap-anywhere text-sm text-muted-foreground">{[job.department, job.location, employmentLabel(job.employmentType), job.hiringManagerName ? `Hiring manager: ${job.hiringManagerName}` : "No hiring manager"].filter(Boolean).join(" · ")}</p><p className="mt-2 text-sm"><Link className="text-primary underline-offset-4 hover:underline" href={`/applications?job=${job.id}`}>{job.applicationCount} {job.applicationCount === 1 ? "application" : "applications"}</Link></p></div><div className="flex flex-wrap gap-2">{canManage ? <>
        <Button type="button" size="sm" variant="outline" aria-haspopup="dialog" aria-label={`Edit ${job.title}`} onClick={(event) => editJob(job, event.currentTarget)}>Edit</Button>
        {job.state === "draft" && <Button type="button" size="sm" onClick={() => void transition(job, "publish")} disabled={pendingJob === job.id}>Publish</Button>}
        {job.state !== "closed" && <Button type="button" size="sm" variant="outline" onClick={() => void transition(job, "close")} disabled={pendingJob === job.id}>Close</Button>}
        {job.state === "closed" && <Button type="button" size="sm" onClick={() => void transition(job, "reopen")} disabled={pendingJob === job.id}>Reopen</Button>}
      </> : <Link className="text-sm text-primary underline-offset-4 hover:underline" href={`/applications?job=${job.id}`}>View applications</Link>}</div></CardContent></Card>)}</div>}

    {role === "admin" && <section className="grid gap-3 border-t pt-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl">Recent audit activity</h2><p className="mt-1 text-sm text-muted-foreground">Job changes and new applications, recorded with an actor and time.</p></div><Link className="text-sm font-medium text-primary underline-offset-4 hover:underline" href="/audit">View full Audit</Link></div>{events.length ? <div className="divide-y rounded-lg border">{events.slice(0, 20).map((event) => <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"><span className="min-w-0 wrap-anywhere"><strong className="font-medium">{event.actorName || "Candidate"}</strong> · {event.action.replaceAll(".", " ")}{typeof event.details.title === "string" ? ` · ${event.details.title}` : typeof event.details.jobTitle === "string" ? ` · ${event.details.jobTitle}` : ""}{typeof event.details.applicantEmail === "string" ? ` · ${event.details.applicantEmail}` : ""}</span><time className="text-muted-foreground" dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time></div>)}</div> : <p className="text-sm text-muted-foreground">No recruiting activity recorded yet.</p>}</section>}
  </div>;
}
