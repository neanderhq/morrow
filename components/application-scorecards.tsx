"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatStableDateTime } from "@/server/application-display";
import { interviewRecommendations } from "@/server/interview-scorecard-validation";
import { fieldStyle, useApplicationSection } from "./application-section";

type Rubric = { version: number; criteria: string[] };
type Feedback = {
  interviewerId: string; interviewerName: string; revision: number; submittedAt: string | null;
  ratings: (number | null)[] | null; notes: string | null; recommendation: string | null;
};
type FeedbackState = {
  canManage: boolean; canReview: boolean; closed: boolean;
  rubric: Rubric | null; round: (Rubric & { id: string }) | null;
  interviewers: { id: string; name: string }[]; cards: Feedback[]; yourCard: Feedback | null;
};

function recommendationLabel(value: string | null) {
  return interviewRecommendations.find((option) => option.value === value)?.label ?? "";
}

function SubmittedFeedback({ card, criteria }: { card: Feedback; criteria: string[] }) {
  return <div className="grid min-w-0 gap-2 text-sm">
    <p className="text-muted-foreground">Submitted {formatStableDateTime(card.submittedAt!)} · {recommendationLabel(card.recommendation)}</p>
    <ul className="grid gap-1">{criteria.map((criterion, index) =>
      <li key={criterion} className="[overflow-wrap:anywhere]">{criterion} · {card.ratings?.[index]}/5</li>)}</ul>
    <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{card.notes}</p>
  </div>;
}

function ScorecardEditor({ card, round, busy, closed, onSave }: {
  card: Feedback; round: Rubric; busy: boolean; closed: boolean;
  onSave: (data: object, notice: string) => Promise<FeedbackState | null>;
}) {
  const [ratings, setRatings] = useState(() => round.criteria.map((_, index) => card.ratings?.[index] ?? null));
  const [notes, setNotes] = useState(card.notes ?? "");
  const [recommendation, setRecommendation] = useState(card.recommendation ?? "");
  const submittedView = useRef<HTMLDivElement>(null);
  const submittedHere = useRef(false);
  useEffect(() => {
    if (card.submittedAt && submittedHere.current) submittedView.current?.focus();
  }, [card.submittedAt]);
  if (card.submittedAt) return <div ref={submittedView} tabIndex={-1}><SubmittedFeedback card={card} criteria={round.criteria} /></div>;
  return <form className="grid min-w-0 gap-4" onSubmit={(event) => {
    event.preventDefault();
    const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "submit" ? "submit" : "draft";
    submittedHere.current = action === "submit";
    void onSave({ action, ratings, notes, recommendation, revision: card.revision },
      action === "submit" ? "Scorecard submitted." : "Scorecard draft saved.");
  }} aria-describedby="scorecards-error">
    <p className="text-sm text-muted-foreground">Rubric version {round.version}. Submission is final.</p>
    {round.criteria.map((criterion, index) => <div key={criterion} className="grid min-w-0 gap-2">
      <Label htmlFor={"scorecard-rating-" + index} className="[overflow-wrap:anywhere]">{criterion}</Label>
      <select className={fieldStyle} id={"scorecard-rating-" + index} value={ratings[index] ?? ""}
        disabled={closed || busy} onChange={(event) => setRatings((previous) => previous.map((rating, at) =>
          at === index ? Number(event.target.value) || null : rating))}>
        <option value="">Select a rating</option>
        {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} of 5</option>)}
      </select>
    </div>)}
    <div className="grid gap-2">
      <Label htmlFor="scorecard-notes">Written evidence</Label>
      <Textarea id="scorecard-notes" value={notes} maxLength={2000} disabled={closed || busy}
        onChange={(event) => setNotes(event.target.value)} />
    </div>
    <div className="grid gap-2">
      <Label htmlFor="scorecard-recommendation">Recommendation</Label>
      <select className={fieldStyle} id="scorecard-recommendation" value={recommendation} disabled={closed || busy}
        onChange={(event) => setRecommendation(event.target.value)}>
        <option value="">Choose a recommendation</option>
        {interviewRecommendations.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" type="submit" value="draft" disabled={closed || busy}>Save draft</Button>
      <Button type="submit" value="submit" disabled={closed || busy}>Submit scorecard</Button>
    </div>
  </form>;
}

export function ApplicationScorecards({ id }: { id: string }) {
  const { data, error, notice, busy, request } = useApplicationSection<FeedbackState>("/api/applications/" + id + "/scorecards");
  const [criteria, setCriteria] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => { setCriteria(data?.rubric?.criteria.join("\n") ?? ""); }, [data?.rubric?.version]);
  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await request({ action: "assign", interviewerIds: selected }, "Scorecards assigned.")) setSelected([]);
  }
  return <Card id="interview-feedback"><CardContent className="grid min-w-0 gap-5 p-5">
    <h2>Interview feedback</h2>
    {data?.closed && <p className="text-sm text-muted-foreground">Feedback writes are paused while this job is closed.</p>}
    {data?.canManage && <div className="grid min-w-0 gap-5 lg:grid-cols-2">
      <form className="grid min-w-0 gap-3" aria-describedby="scorecards-error" onSubmit={(event) => {
        event.preventDefault();
        void request({ action: "rubric", version: data.rubric?.version ?? 0, criteria: criteria.trim().split("\n") }, "Job rubric saved.");
      }}>
        <div><h3>Job rubric</h3><p className="text-sm text-muted-foreground">Two to eight job-related criteria, one per line. Edits apply to future rounds.</p></div>
        <Label htmlFor="job-scorecard-criteria">Rubric criteria</Label>
        <Textarea id="job-scorecard-criteria" rows={3} value={criteria} onChange={(event) => setCriteria(event.target.value)}
          disabled={data.closed || busy} />
        <div><Button type="submit" disabled={data.closed || busy}>Save job rubric</Button></div>
      </form>
      <form className="grid content-start gap-3" aria-describedby="scorecards-error" onSubmit={(event) => void assign(event)}>
        <h3>Assign feedback</h3>
        {data.interviewers.length === 0 && <p className="text-sm text-muted-foreground">Assign an active interviewer to the job first.</p>}
        {data.interviewers.map((person) => {
          const assigned = data.cards.some((card) => card.interviewerId === person.id);
          return <label key={person.id} className="flex items-start gap-2 text-sm [overflow-wrap:anywhere]">
            <input type="checkbox" className="mt-0.5" checked={assigned || selected.includes(person.id)}
              disabled={assigned || data.closed || busy}
              onChange={(event) => setSelected(event.target.checked ? [...selected, person.id] : selected.filter((id) => id !== person.id))} />
            {person.name}{assigned ? " (assigned)" : ""}
          </label>;
        })}
        <div><Button type="submit" disabled={!data.rubric || data.closed || busy}>Assign scorecards</Button></div>
      </form>
    </div>}
    {data?.canReview && data.round && <section className="grid gap-3 border-t pt-4" aria-label="Feedback progress">
      <h3>Feedback progress</h3>
      <p className="text-sm text-muted-foreground">Rubric version {data.round.version} · {data.cards.filter((card) => card.submittedAt).length} of {data.cards.length} submitted</p>
      {data.cards.map((card) => <div key={card.interviewerId} className="grid min-w-0 gap-1 rounded-lg border p-3">
        <p className="font-medium [overflow-wrap:anywhere]">{card.interviewerName}</p>
        {card.submittedAt ? <SubmittedFeedback card={card} criteria={data.round!.criteria} /> : <p className="text-sm text-muted-foreground">Pending</p>}
      </div>)}
    </section>}
    {data?.round && data.yourCard && <ScorecardEditor key={data.round.id} card={data.yourCard}
      round={data.round} busy={busy} closed={data.closed} onSave={request} />}
    {data && !data.round && !data.canManage && <p className="text-sm text-muted-foreground">No scorecard is available.</p>}
    {busy && !data && <p className="text-sm text-muted-foreground">Loading interview feedback…</p>}
    <div id="scorecards-error" role="alert" className={error ? "text-sm text-destructive" : undefined}>{error}</div>
    <div role="status" className={notice ? "text-sm text-muted-foreground" : undefined}>{notice}</div>
  </CardContent></Card>;
}
