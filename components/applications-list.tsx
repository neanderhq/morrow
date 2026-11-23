"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const stages = [
  { value: "applied", label: "Applied" }, { value: "screening", label: "Screening" },
  { value: "interview", label: "Interview" }, { value: "offer", label: "Offer" },
  { value: "hired", label: "Hired" }, { value: "rejected", label: "Rejected" },
];
type Application = { id: string; candidateId: string; stage: string; createdAt: string; jobId: string; jobTitle: string; applicantName: string; applicantEmail: string; resumeName: string | null };
type JobOption = { id: string; title: string };

export function ApplicationsList({ jobId: initialJobId = "", stage: initialStage = "all", search: initialSearch = "" }: { jobId?: string; stage?: string; search?: string }) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [jobId, setJobId] = useState(initialJobId);
  const [stage, setStage] = useState(initialStage);
  const [search, setSearch] = useState(initialSearch);
  const [submittedSearch, setSubmittedSearch] = useState(initialSearch);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const query = new URLSearchParams();
    if (jobId) query.set("job", jobId);
    if (stage !== "all") query.set("stage", stage);
    if (submittedSearch.trim()) query.set("search", submittedSearch.trim());
    void fetch(`/api/applications${query.size ? `?${query}` : ""}`, { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Applications could not be loaded.");
      if (active) { setApplications(data.applications); setJobs(data.jobs); }
    }).catch((loadError) => {
      if (active) setError(loadError instanceof Error ? loadError.message : "Applications could not be loaded.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [jobId, stage, submittedSearch]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedSearch(search);
  }

  return <div className="grid gap-4">
    <form onSubmit={submitSearch} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-[minmax(14rem,1fr)_minmax(12rem,0.7fr)_minmax(12rem,0.7fr)_auto] md:items-end">
      <div className="grid gap-2"><Label htmlFor="application-search">Search candidate</Label><Input id="application-search" value={search} onChange={(event) => setSearch(event.target.value)} maxLength={120} placeholder="Name or email" /></div>
      <div className="grid gap-2"><Label htmlFor="application-job-filter">Job</Label><Select value={jobId || "all"} onValueChange={(value) => setJobId(value === "all" ? "" : value)}><SelectTrigger id="application-job-filter" className="w-full"><SelectValue placeholder="All jobs" /></SelectTrigger><SelectContent><SelectItem value="all">All jobs</SelectItem>{jobs.map((job) => <SelectItem value={job.id} key={job.id}>{job.title}</SelectItem>)}</SelectContent></Select></div>
      <div className="grid gap-2"><Label htmlFor="application-stage-filter">Stage</Label><Select value={stage} onValueChange={setStage}><SelectTrigger id="application-stage-filter" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All stages</SelectItem>{stages.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
      <Button type="submit">Search</Button>
    </form>
    {error && <p role="alert" className="rounded-md border border-destructive/40 px-4 py-3 text-sm text-destructive">{error}</p>}
    {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading applications…</p> : applications.length === 0 ? <Card><CardContent className="px-5 py-12 text-center"><h2>No applications match these filters</h2><p className="mt-2 text-muted-foreground">Try changing the search or filters. Only applications you can access are included.</p></CardContent></Card> : applications.map((application) => <Card key={application.id}><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="break-words text-lg [overflow-wrap:anywhere]"><Link className="underline-offset-4 hover:underline" href={`/candidates/${application.candidateId}`}>{application.applicantName}</Link></h2><Badge variant="secondary">{stages.find((item) => item.value === application.stage)?.label ?? application.stage}</Badge></div><p className="mt-1 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">{application.applicantEmail} · {application.jobTitle}</p><p className="mt-1 break-words text-xs text-muted-foreground">Received {new Date(application.createdAt).toLocaleDateString()}{application.resumeName ? ` · ${application.resumeName}` : ""}</p></div><Link className="text-sm font-medium text-primary underline-offset-4 hover:underline" href={`/applications/${application.id}`}>Review application</Link></CardContent></Card>)}
  </div>;
}
