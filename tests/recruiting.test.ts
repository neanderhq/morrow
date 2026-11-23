import assert from "node:assert/strict";
import test from "node:test";
import { isUuid, normalizeApplicantEmail, parseJobInput, validWebUrl } from "../server/recruiting-validation.ts";

test("job details require assigned roles and valid required fields", () => {
  const valid = {
    title: "Senior Recruiter", department: "People", location: "Remote - US", employmentType: "full_time",
    remote: true, description: "Help us build a thoughtful recruiting team.",
    hiringManagerId: "c5c1b8f7-0edb-4fa3-ae2d-ea02415977d1", interviewerIds: [],
  };
  assert.deepEqual(parseJobInput(valid), { ok: true, data: valid });
  assert.equal(parseJobInput({ ...valid, hiringManagerId: "user_01J8N4H7TQ9K3M2P" }).ok, true);
  assert.equal(parseJobInput({ ...valid, employmentType: "seasonal" }).ok, false);
  assert.equal(parseJobInput({ ...valid, remote: "yes" }).ok, false);
});

test("job assignments accept bounded opaque staff IDs and reject blank or oversized IDs", () => {
  const valid = {
    title: "Recruiting Coordinator", location: "Portland", employmentType: "contract", remote: false,
    description: "Coordinate hiring workflows across teams.", hiringManagerId: "user_manager_42",
    interviewerIds: ["user_interviewer_43"],
  };
  assert.equal(parseJobInput(valid).ok, true);
  assert.equal(parseJobInput({ ...valid, hiringManagerId: " " }).ok, false);
  assert.equal(parseJobInput({ ...valid, hiringManagerId: "x".repeat(256) }).ok, false);
  assert.equal(parseJobInput({ ...valid, interviewerIds: [""] }).ok, false);
  assert.equal(parseJobInput({ ...valid, interviewerIds: ["x".repeat(256)] }).ok, false);
});

test("resource IDs remain UUIDs while staff account IDs may be opaque text", () => {
  assert.equal(isUuid("c5c1b8f7-0edb-4fa3-ae2d-ea02415977d1"), true);
  assert.equal(isUuid("user_01J8N4H7TQ9K3M2P"), false);
});

test("job assignment input removes duplicate interviewer IDs", () => {
  const interviewerId = "c5c1b8f7-0edb-4fa3-ae2d-ea02415977d1";
  const parsed = parseJobInput({
    title: "Recruiting Coordinator", location: "Portland", employmentType: "contract", remote: false,
    description: "Coordinate hiring workflows across teams.", hiringManagerId: interviewerId,
    interviewerIds: [interviewerId, interviewerId],
  });
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.deepEqual(parsed.data.interviewerIds, [interviewerId]);
});

test("candidate email comparison is case-insensitive and links must be web URLs", () => {
  assert.equal(normalizeApplicantEmail(" Candidate@Example.com "), "candidate@example.com");
  assert.equal(validWebUrl("https://www.linkedin.com/in/example"), true);
  assert.equal(validWebUrl("mailto:person@example.com"), false);
  assert.equal(validWebUrl("not a URL"), false);
  assert.equal(validWebUrl(""), true);
});
