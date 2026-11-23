import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "../../../../components/ui/badge";
import { Card, CardContent } from "../../../../components/ui/card";
import { getMember } from "../../../../server/access";
import { getCandidateView } from "../../../../server/candidate-view";
import { isUuid } from "../../../../server/recruiting";

const stageLabels: Record<string, string> = {
  applied: "Applied", screening: "Screening", interview: "Interview",
  offer: "Offer", hired: "Hired", rejected: "Rejected",
};

export default async function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const member = await getMember();
  if (!member) redirect("/login");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const view = await getCandidateView(member, id);
  if (!view) notFound();
  return <div className="grid gap-6">
    <header>
      <Link href="/applications" className="text-sm text-muted-foreground hover:text-foreground">← Applications</Link>
      <h1 className="mt-3 [overflow-wrap:anywhere]">{view.candidate.name}</h1>
      {view.candidate.email && <p className="mt-2 break-words text-muted-foreground [overflow-wrap:anywhere]">{view.candidate.email}</p>}
    </header>
    <section className="grid gap-3">
      <div><h2 className="text-xl">Applications</h2><p className="mt-1 text-sm text-muted-foreground">Only applications you are assigned to are shown.</p></div>
      {view.applications.map((application) => <Card key={application.id}>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0"><h3 className="break-words [overflow-wrap:anywhere]">{application.jobTitle}</h3><p className="mt-1 text-sm text-muted-foreground">Received {application.createdAt.toLocaleDateString()}</p></div>
          <div className="flex flex-wrap items-center gap-3"><Badge variant="secondary">{stageLabels[application.stage] ?? application.stage}</Badge><Link className="text-sm font-medium text-primary underline-offset-4 hover:underline" href={`/applications/${application.id}`}>Review application</Link></div>
        </CardContent>
      </Card>)}
    </section>
  </div>;
}
