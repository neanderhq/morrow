import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent } from "../../../../components/ui/card";
import { ApplicationPipeline } from "../../../../components/application-pipeline";
import { getMember } from "../../../../server/access";
import { getDb } from "../../../../server/db";
import { canChangeApplicationStage } from "../../../../server/policy";
import { applicationStageBadgeLabel, formatStableDateTime } from "../../../../server/application-display";
import { canAccessApplication, isUuid } from "../../../../server/recruiting";
import { applicationStageHistory, applications, candidates, jobs, user } from "../../../../server/schema";
import { alias } from "drizzle-orm/pg-core";

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const member = await getMember();
  if (!member) redirect("/login");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [application] = await getDb().select({
    id: applications.id, candidateId: applications.candidateId, stage: applications.stage, createdAt: applications.createdAt,
    jobId: applications.jobId, jobTitle: jobs.title, applicantName: applications.applicantName,
    applicantEmail: applications.applicantEmail, phone: applications.phone,
    portfolioUrl: applications.portfolioUrl, coverNote: applications.coverNote,
    resumeName: applications.resumeName, candidateName: candidates.name, candidateEmail: candidates.email,
  }).from(applications).innerJoin(jobs, eq(applications.jobId, jobs.id))
    .innerJoin(candidates, eq(applications.candidateId, candidates.id))
    .where(and(eq(applications.workspaceId, member.workspaceId), eq(applications.id, id))).limit(1);
  if (!application || !await canAccessApplication(member, application.jobId)) notFound();
  const stageActor = alias(user, "application_page_stage_actor");
  const history = await getDb().select({
    id: applicationStageHistory.id,
    fromStage: applicationStageHistory.fromStage,
    toStage: applicationStageHistory.toStage,
    createdAt: applicationStageHistory.createdAt,
    actorName: stageActor.name,
  }).from(applicationStageHistory).leftJoin(stageActor, eq(applicationStageHistory.actorUserId, stageActor.id))
    .where(and(eq(applicationStageHistory.workspaceId, member.workspaceId), eq(applicationStageHistory.applicationId, id)))
    .orderBy(applicationStageHistory.createdAt);
  const assigned = await canAccessApplication(member, application.jobId);
  const mayChangeStage = canChangeApplicationStage(member.role, assigned);
  const stageBadgeLabel = applicationStageBadgeLabel(application.stage);
  return <div className="grid gap-6">
    <header className="flex min-w-0 flex-wrap items-start justify-between gap-4"><div className="min-w-0"><Link href={`/applications?job=${application.jobId}`} className="text-sm text-muted-foreground hover:text-foreground">← Applications</Link><div className="mt-3 flex flex-wrap items-center gap-2"><h1 className="[overflow-wrap:anywhere]">{application.applicantName || application.candidateName}</h1>{stageBadgeLabel && <Badge variant="secondary">{stageBadgeLabel}</Badge>}</div><p className="mt-2 break-words text-muted-foreground [overflow-wrap:anywhere]">{application.applicantEmail || application.candidateEmail} · {application.jobTitle}</p><Link href={`/candidates/${application.candidateId}`} className="mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline">View candidate applications</Link></div><Button asChild variant="outline"><a href={`/api/applications/${application.id}/resume`}>Download resume</a></Button></header>
    <div className="grid min-w-0 gap-5 md:grid-cols-2"><Card><CardContent className="grid gap-4 p-5"><h2>Candidate details</h2><div className="min-w-0"><p className="text-xs text-muted-foreground">Email</p><a className="mt-1 block break-words text-primary hover:underline [overflow-wrap:anywhere]" href={`mailto:${application.applicantEmail || application.candidateEmail}`}>{application.applicantEmail || application.candidateEmail}</a></div>{application.phone && <div><p className="text-xs text-muted-foreground">Phone</p><p className="mt-1">{application.phone}</p></div>}{application.portfolioUrl && <div><p className="text-xs text-muted-foreground">LinkedIn or portfolio</p><a className="mt-1 block break-all text-primary hover:underline" href={application.portfolioUrl} target="_blank" rel="noreferrer">{application.portfolioUrl}</a></div>}<div><p className="text-xs text-muted-foreground">Received</p><time className="mt-1 block" dateTime={application.createdAt.toISOString()}>{formatStableDateTime(application.createdAt)}</time></div></CardContent></Card><Card><CardContent className="grid gap-4 p-5"><h2>Cover note</h2><p className="break-words whitespace-pre-wrap leading-7 text-muted-foreground [overflow-wrap:anywhere]">{application.coverNote || "No cover note provided."}</p><div className="border-t pt-4"><p className="text-xs text-muted-foreground">Resume</p><a className="mt-1 block break-words text-primary hover:underline [overflow-wrap:anywhere]" href={`/api/applications/${application.id}/resume`}>{application.resumeName || "Download resume"}</a><p className="mt-1 text-xs text-muted-foreground">Only assigned staff can access this file.</p></div></CardContent></Card></div>
    <ApplicationPipeline applicationId={application.id} initialStage={application.stage} initialHistory={history.map((entry) => ({ ...entry, createdAt: entry.createdAt.toISOString() }))} currentUserId={member.userId} canChangeStage={mayChangeStage} isAdmin={member.role === "admin"} />
  </div>;
}
