"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Candidate = { id: string; name: string; email: string | null; applicationCount: number; latestApplicationAt: string | null };

export function CandidatesList() {
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams();
    if (submittedSearch) query.set("search", submittedSearch);
    setLoading(true);
    setError("");
    void fetch(`/api/candidates${query.size ? `?${query}` : ""}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Candidates could not be loaded.");
        if (active) setCandidates(data.candidates);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Candidates could not be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [submittedSearch]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedSearch(search.trim());
  }

  return <div className="grid gap-4">
    <form onSubmit={submitSearch} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <div className="grid gap-2"><Label htmlFor="candidate-search">Search candidates</Label><Input id="candidate-search" value={search} onChange={(event) => setSearch(event.target.value)} maxLength={120} placeholder="Name or email" /></div>
      <Button type="submit">Search</Button>
    </form>
    {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
    {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading candidates…</p>
      : candidates.length ? <div className="grid gap-3">{candidates.map((candidate) => <Card key={candidate.id}>
        <CardContent className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0"><h2 className="break-words text-base [overflow-wrap:anywhere]">{candidate.name}</h2>{candidate.email && <p className="mt-1 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">{candidate.email}</p>}<p className="mt-2 text-sm text-muted-foreground">{candidate.applicationCount} {candidate.applicationCount === 1 ? "application" : "applications"}{candidate.latestApplicationAt ? ` · Latest ${new Date(candidate.latestApplicationAt).toLocaleDateString()}` : ""}</p></div>
          <Link className="shrink-0 text-sm font-medium text-primary underline-offset-4 hover:underline" href={`/candidates/${candidate.id}`}>View candidate</Link>
        </CardContent>
      </Card>)}</div>
        : <Card><CardContent className="px-5 py-12 text-center"><h2>No candidates found</h2><p className="mt-2 text-sm text-muted-foreground">Try a different name or email search.</p></CardContent></Card>}
  </div>;
}
