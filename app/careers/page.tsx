import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { getDb } from "../../server/db";
import { jobs, workspaces } from "../../server/schema";

export const dynamic = "force-dynamic";

const employment = { full_time: "Full time", part_time: "Part time", contract: "Contract" };

export default async function CareersPage() {
  const openings = await getDb().select({
    id: jobs.id, title: jobs.title, department: jobs.department, location: jobs.location,
    employmentType: jobs.employmentType, remote: jobs.remote, workspaceName: workspaces.name,
  }).from(jobs).innerJoin(workspaces, eq(jobs.workspaceId, workspaces.id))
    .where(and(eq(jobs.state, "published"), eq(workspaces.singletonKey, "primary"))).orderBy(asc(jobs.title));
  const workspaceName = openings[0]?.workspaceName || "Careers";
  return <main className="min-h-screen bg-muted/30">
    <header className="border-b bg-background"><div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-5 py-5"><Link href="/careers" className="min-w-0 wrap-anywhere font-semibold">{workspaceName} careers</Link><span className="text-sm text-muted-foreground">Open positions</span></div></header>
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-7 px-5 py-10 sm:py-14">
      <header><Badge variant="secondary" className="mb-3">Careers</Badge><h1>Find your next role</h1><p className="mt-3 max-w-xl text-base text-muted-foreground">Explore our current openings and apply to join the team.</p></header>
      {openings.length ? <div className="grid min-w-0 grid-cols-1 gap-3">{openings.map((job) => <Card key={job.id}><CardContent className="flex min-w-0 flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div className="min-w-0"><h2 className="wrap-anywhere text-xl">{job.title}</h2><p className="mt-2 wrap-anywhere text-sm text-muted-foreground">{[job.department, job.location, employment[job.employmentType], job.remote ? "Remote" : ""].filter(Boolean).join(" · ")}</p></div><Button asChild><Link href={`/careers/${job.id}`}>View role</Link></Button></CardContent></Card>)}</div> : <Card><CardContent className="px-5 py-14 text-center"><h2>No open positions right now</h2><p className="mt-2 text-muted-foreground">Please check back later.</p></CardContent></Card>}
    </div>
  </main>;
}
