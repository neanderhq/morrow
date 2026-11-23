import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ApplicationForm } from "../../../components/application-form";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { getDb } from "../../../server/db";
import { isUuid } from "../../../server/recruiting-validation";
import { jobs, workspaces } from "../../../server/schema";

export const dynamic = "force-dynamic";

const employment = { full_time: "Full time", part_time: "Part time", contract: "Contract" };

export default async function CareerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [job] = await getDb().select({
    id: jobs.id, title: jobs.title, department: jobs.department, location: jobs.location,
    employmentType: jobs.employmentType, remote: jobs.remote, description: jobs.description,
    state: jobs.state, workspaceName: workspaces.name,
  }).from(jobs).innerJoin(workspaces, eq(jobs.workspaceId, workspaces.id))
    .where(and(eq(jobs.id, id), eq(workspaces.singletonKey, "primary"))).limit(1);
  if (!job || job.state === "draft") notFound();
  return <main className="min-h-screen bg-muted/30">
    <header className="border-b bg-background"><div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-5 py-5"><Link href="/careers" className="break-words font-semibold [overflow-wrap:anywhere]">{job.workspaceName} careers</Link><Link href="/careers" className="text-sm text-muted-foreground hover:text-foreground">All openings</Link></div></header>
    <div className="mx-auto grid max-w-5xl gap-6 px-5 py-8 sm:py-12">
      {job.state === "closed" ? <Card><CardContent className="px-5 py-12 text-center"><h1 className="text-2xl">This job is no longer accepting applications</h1><p className="mt-3 text-muted-foreground">This position has closed. Browse our other open roles instead.</p><Button asChild className="mt-6"><Link href="/careers">View open positions</Link></Button></CardContent></Card> : <>
        <section className="min-w-0"><Badge variant="secondary" className="mb-3">{employment[job.employmentType]}{job.remote ? " · Remote" : ""}</Badge><h1 className="[overflow-wrap:anywhere]">{job.title}</h1><p className="mt-3 break-words text-muted-foreground [overflow-wrap:anywhere]">{[job.department, job.location].filter(Boolean).join(" · ")}</p></section>
        <section className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
          <Card><CardContent className="min-w-0 p-5 sm:p-7"><h2>About the role</h2><div className="mt-4 break-words whitespace-pre-wrap leading-7 text-muted-foreground [overflow-wrap:anywhere]">{job.description}</div></CardContent></Card>
          <Card id="apply"><CardContent className="grid gap-5 p-5 sm:p-6"><div><h2>Apply for this role</h2><p className="mt-2 text-sm text-muted-foreground">Fields marked as required must be completed.</p></div><ApplicationForm jobId={job.id} /></CardContent></Card>
        </section>
      </>}
    </div>
  </main>;
}
