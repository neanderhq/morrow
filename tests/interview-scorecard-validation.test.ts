import assert from "node:assert/strict";
import { test } from "node:test";
import { parseInterviewFeedback, parseJobCriteria } from "../server/interview-scorecard-validation.ts";

test("job criteria require distinct, bounded, job-specific entries", () => {
  assert.deepEqual(parseJobCriteria([" Explain a tradeoff ", "Validate with evidence"]), ["Explain a tradeoff", "Validate with evidence"]);
  assert.equal(parseJobCriteria(["Criterion", " criterion "]), null);
  assert.equal(parseJobCriteria(["One"]), null);
  assert.equal(parseJobCriteria(["Valid heading", "Fragment\naddition"]), null);
});

test("drafts can be incomplete but submission requires every rating and a decision", () => {
  const draft = { ratings: [4, null], notes: "", recommendation: "" };
  assert.deepEqual(parseInterviewFeedback(draft, 2, false), draft);
  assert.equal(parseInterviewFeedback(draft, 2, true), null);
  assert.equal(parseInterviewFeedback({ ...draft, ratings: [0, 8] }, 2, false), null);
  const full = { ratings: [4, 3], notes: "Example evidence", recommendation: "debrief" };
  assert.deepEqual(parseInterviewFeedback(full, 2, true), full);
});
