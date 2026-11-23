import { CandidatesList } from "../../../components/candidates-list";

export default function CandidatesPage() {
  return <div className="grid gap-6">
    <header><h1>Candidates</h1><p className="mt-2 text-muted-foreground">Search candidates from applications you can access.</p></header>
    <CandidatesList />
  </div>;
}
