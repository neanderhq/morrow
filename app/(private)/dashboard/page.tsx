import { and, countDistinct, eq, sql } from "drizzle-orm";
import { ArrowUpRight, BriefcaseBusiness, CircleCheck, UserRoundPlus, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMember } from "../../../server/access";
import { dashboardContent } from "../../../server/dashboard-content";
import { getDb } from "../../../server/db";
import { canManageJobs } from "../../../server/policy";
import { invitations, jobAssignments, jobs, memberships } from "../../../server/schema";

export default async function DashboardPage() {
  const member = await getMember();
  if (!member) return null;
  const db = getDb();
  const isAdmin = member.role === "admin";
  const canSeeAllJobs = canManageJobs(member.role);
  const [{ count: jobCount }] = canSeeAllJobs
    ? await db.select({ count: sql<number>`count(*)::int` }).from(jobs).where(eq(jobs.workspaceId, member.workspaceId))
    : await db.select({ count: countDistinct(jobAssignments.jobId) }).from(jobAssignments)
      .where(and(eq(jobAssignments.workspaceId, member.workspaceId), eq(jobAssignments.userId, member.userId)));
  const [{ count: staffCount = 0 } = {}] = isAdmin
    ? await db.select({ count: sql<number>`count(*)::int` }).from(memberships)
      .where(and(eq(memberships.workspaceId, member.workspaceId), eq(memberships.active, true)))
    : [];
  const [{ count: pendingCount = 0 } = {}] = isAdmin
    ? await db.select({ count: sql<number>`count(*)::int` }).from(invitations)
      .where(and(eq(invitations.workspaceId, member.workspaceId), sql`${invitations.acceptedAt} is null`, sql`${invitations.expiresAt} > now()`))
    : [];
  const overview = [
    { label: canSeeAllJobs ? "Workspace jobs" : "Assigned jobs", value: jobCount, detail: canSeeAllJobs ? "Jobs in your workspace" : "Jobs assigned to you", icon: BriefcaseBusiness },
  ];
  if (isAdmin) overview.unshift(
    { label: "Active team members", value: staffCount, detail: "People in this workspace", icon: Users },
    { label: "Pending invitations", value: pendingCount, detail: "Links awaiting acceptance", icon: UserRoundPlus },
  );
  const content = dashboardContent(member.role, { jobCount, staffCount });

  return <div className="grid min-w-0 gap-8"><section className="flex min-w-0 flex-col justify-between gap-5 sm:flex-row sm:items-end"><div className="min-w-0"><Badge variant="secondary" className="mb-3">{content.roleLabel}</Badge><h1 className="break-words text-3xl [overflow-wrap:anywhere]">Good to see you, {member.name.split(" ")[0]}</h1><p className="mt-2 max-w-xl text-muted-foreground">{content.introduction}</p></div>{isAdmin && <Button asChild><Link href="/staff"><UserRoundPlus />Invite teammate</Link></Button>}</section>
    <section aria-label="Workspace overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{overview.map(({ label, value, detail, icon: Icon }) => <Card key={label}><CardContent className="flex items-start justify-between p-5"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-3 text-3xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div><span className="grid size-10 place-items-center rounded-lg bg-muted text-primary"><Icon className="size-5" /></span></CardContent></Card>)}</section>
    <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]"><Card><CardHeader><CardTitle>Getting started</CardTitle><CardDescription>{content.taskDescription}</CardDescription></CardHeader><CardContent className="grid gap-4">{content.tasks.map((item) => <Link key={item.title} href={item.href} className="flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/40"><CircleCheck className={`mt-0.5 size-5 shrink-0 ${item.complete ? "text-success" : "text-muted-foreground"}`} /><span className="min-w-0 flex-1"><span className="font-medium">{item.title}</span><span className="mt-1 block text-sm text-muted-foreground">{item.description}</span></span><ArrowUpRight className="size-4 shrink-0 text-muted-foreground" /></Link>)}</CardContent></Card><Card className="bg-muted/30"><CardHeader><CardTitle>{content.roleLabel}</CardTitle><CardDescription>Work together, with the right access for every role.</CardDescription></CardHeader><CardContent><p className="leading-7 text-muted-foreground">You’re signed in as <span className="font-medium capitalize text-foreground">{member.role.replaceAll("_", " ")}</span>. Staff access is managed by your workspace Admin. Applications and jobs stay within your role access.</p><Button asChild variant="link" className="mt-3 h-auto p-0"><Link href="/profile">View your profile <ArrowUpRight /></Link></Button></CardContent></Card></section>
  </div>;
}
