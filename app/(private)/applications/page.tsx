import { getMember } from "../../../server/access";
import { ApplicationsList } from "../../../components/applications-list";

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ job?: string; stage?: string; search?: string }> }) {
  const member = await getMember();
  if (!member) return null;
  const { job, stage, search } = await searchParams;
  return <div className="grid min-w-0 gap-6"><header><h1>Applications</h1><p className="mt-2 text-muted-foreground">Search and filter applications for jobs you manage or are assigned to.</p></header><ApplicationsList jobId={job} stage={stage} search={search} /></div>;
}
