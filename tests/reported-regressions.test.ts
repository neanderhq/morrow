import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { applicationStageBadgeLabel, formatStableDateTime } from "../server/application-display.ts";
import { dashboardContent } from "../server/dashboard-content.ts";
import { resetCompletionFeedback } from "../server/reset-feedback.ts";
import { canManageStaff, isHiringManagerAssignment, requiresHiringManagerReassignment } from "../server/policy.ts";
import { createActionToken, decryptActionToken, encryptActionToken, hashActionToken, invitationLinksForAdmin } from "../server/security.ts";
import { invalidLoginResponse, INVALID_LOGIN_MESSAGE } from "../server/auth-feedback.ts";
import { passwordResetSessionSettings } from "../server/auth-settings.ts";
import { nextJobReopenState, nextJobState } from "../server/job-lifecycle.ts";
import { applicationStageConfirmation, noteDeletionConfirmation, staffRoleChangeConfirmation } from "../server/confirmations.ts";
import { candidateProfileName, parseCandidateSearch } from "../server/recruiting-validation.ts";
import { APPLICATION_CLIENT_ID_COOKIE, APPLICATION_SUBMISSION_LIMIT, applicationSubmissionClientKey, issueApplicationClientIdentity, shouldAcceptApplicationSubmission, verifyApplicationClientIdentity } from "../server/application-rate-limit-policy.ts";

test("invitation tokens remain hash-looked-up and can be recovered only from authenticated ciphertext", () => {
  const previousSecret = process.env.BETTER_AUTH_SECRET;
  process.env.BETTER_AUTH_SECRET = "focused-regression-test-secret";
  try {
    const token = createActionToken();
    const encrypted = encryptActionToken(token);
    assert.notEqual(encrypted, token);
    assert.equal(decryptActionToken(encrypted), token);
    assert.equal(hashActionToken(token), createHash("sha256").update(token).digest("hex"));
    assert.equal(hashActionToken(token).length, 64);
    assert.notEqual(encryptActionToken(token), encrypted);
    const secondToken = createActionToken();
    const invitations = invitationLinksForAdmin([
      { id: "first", encryptedToken: encrypted },
      { id: "second", encryptedToken: encryptActionToken(secondToken) },
      { id: "legacy", encryptedToken: null },
    ], "https://recruiting.example");
    assert.equal(invitations.length, 3);
    assert.equal(invitations[0].inviteUrl, `https://recruiting.example/invite/${token}`);
    assert.equal(invitations[1].inviteUrl, `https://recruiting.example/invite/${secondToken}`);
    assert.equal(invitations[2].inviteUrl, null);
    assert.equal("encryptedToken" in invitations[0], false);
    assert.equal(canManageStaff("admin"), true);
    assert.equal(canManageStaff("recruiter"), false);
  } finally {
    if (previousSecret === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = previousSecret;
  }
});

test("tampered invitation ciphertext is rejected", () => {
  const previousSecret = process.env.BETTER_AUTH_SECRET;
  process.env.BETTER_AUTH_SECRET = "focused-regression-test-secret";
  try {
    const [iv, tag, payload] = encryptActionToken("single-use-token").split(".");
    const tampered = `${iv}.${tag}.${payload?.[0] === "A" ? "B" : "A"}${payload?.slice(1)}`;
    assert.throws(() => decryptActionToken(tampered));
  } finally {
    if (previousSecret === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = previousSecret;
  }
});

test("role-specific dashboard content keeps Admin-only tasks off Recruiter dashboards", () => {
  const recruiter = dashboardContent("recruiter", { jobCount: 2, staffCount: 8 });
  const recruiterText = JSON.stringify(recruiter);
  assert.equal(recruiter.roleLabel, "Recruiter workspace");
  assert.equal(recruiter.tasks.some((task) => task.href === "/staff"), false);
  assert.equal(recruiterText.includes("Build your team"), false);
  assert.equal(recruiterText.includes("Pending invitations"), false);
  assert.equal(recruiterText.includes("Invite teammate"), false);
  assert.equal(recruiter.tasks.some((task) => task.href === "/applications"), true);
  assert.equal(dashboardContent("admin", { jobCount: 0, staffCount: 1 }).tasks.some((task) => task.title === "Build your team"), true);
  for (const role of ["hiring_manager", "interviewer"] as const) {
    const content = dashboardContent(role, { jobCount: 1, staffCount: 1 });
    assert.equal(content.tasks.some((task) => task.href === "/jobs"), true);
    assert.equal(content.tasks.some((task) => task.href === "/applications"), true);
    assert.equal(content.tasks.some((task) => task.href === "/profile"), true);
  }
});

test("password reset confirmation remains successful when logout fails, with a separate warning", () => {
  assert.deepEqual(resetCompletionFeedback(true), {
    confirmation: "Password updated. Sign in using your new password.",
    logoutWarning: null,
  });
  const logoutFailure = resetCompletionFeedback(false);
  assert.equal(logoutFailure.confirmation, "Password updated. Sign in using your new password.");
  assert.match(logoutFailure.logoutWarning ?? "", /current session could not be ended/);
});

test("application detail only shows known stages and formats every displayed date in UTC", () => {
  assert.equal(applicationStageBadgeLabel("screening"), "screening");
  assert.equal(applicationStageBadgeLabel("error"), null);
  const timestamp = "2025-01-02T03:04:00.000Z";
  const expected = "Jan 2, 2025, 3:04 AM UTC";
  assert.equal(formatStableDateTime(timestamp), expected);
  assert.equal(formatStableDateTime(new Date(timestamp)), expected);
  assert.equal(formatStableDateTime(new Date(timestamp)), formatStableDateTime(timestamp));
});

test("changing a Hiring Manager's role is blocked until assigned jobs are reassigned and warns first", () => {
  assert.equal(requiresHiringManagerReassignment("hiring_manager", "interviewer", 2), true);
  assert.equal(requiresHiringManagerReassignment("hiring_manager", "hiring_manager", 2), false);
  assert.equal(requiresHiringManagerReassignment("interviewer", "recruiter", 2), false);
  assert.equal(isHiringManagerAssignment("hiring_manager", "manager-1", "manager-1"), true);
  assert.equal(isHiringManagerAssignment("interviewer", "manager-1", "manager-1"), false);
  assert.match(staffRoleChangeConfirmation("Alex", "hiring_manager", "interviewer") ?? "", /Reassign this person's jobs/);
  assert.match(staffRoleChangeConfirmation("Alex", "recruiter", "interviewer") ?? "", /Change Alex's role to Interviewer/);
});

test("password reset revokes existing sessions", () => {
  assert.equal(passwordResetSessionSettings.revokeSessionsOnPasswordReset, true);
});

test("job reopen restores Draft or Published instead of publishing every closed job", () => {
  assert.equal(nextJobState("draft", "close", null), "closed");
  assert.equal(nextJobReopenState("draft", "close"), "draft");
  assert.equal(nextJobState("closed", "reopen", "draft"), "draft");
  assert.equal(nextJobState("published", "close", null), "closed");
  assert.equal(nextJobState("closed", "reopen", "published"), "published");
  assert.equal(nextJobState("published", "publish", null), null);
});

test("existing candidates keep their original profile name while a new application has its own name", () => {
  assert.equal(candidateProfileName("Original Candidate", "Different Submitted Name"), "Original Candidate");
  assert.equal(candidateProfileName(null, "New Candidate"), "New Candidate");
});

test("application submission rate policy allows a normal burst and stops repeated requests", () => {
  assert.equal(APPLICATION_SUBMISSION_LIMIT, 5);
  for (let count = 1; count <= APPLICATION_SUBMISSION_LIMIT; count += 1) assert.equal(shouldAcceptApplicationSubmission(count), true);
  assert.equal(shouldAcceptApplicationSubmission(APPLICATION_SUBMISSION_LIMIT + 1), false);
  const secret = "test-secret";
  const identity = issueApplicationClientIdentity(secret);
  const headers = new Headers({ cookie: `${APPLICATION_CLIENT_ID_COOKIE}=${identity}`, "x-forwarded-for": "198.51.100.44", "x-real-ip": "198.51.100.44", "cf-connecting-ip": "198.51.100.44" });
  const changedSpoofedAddress = new Headers({ cookie: `${APPLICATION_CLIENT_ID_COOKIE}=${identity}`, "x-forwarded-for": "192.0.2.88", "x-real-ip": "192.0.2.88", "cf-connecting-ip": "192.0.2.88" });
  const clientKey = applicationSubmissionClientKey(headers, secret);
  assert.ok(clientKey);
  assert.equal(applicationSubmissionClientKey(changedSpoofedAddress, secret), clientKey);
  const requestCounts = new Map<string, number>();
  for (let attempt = 1; attempt <= APPLICATION_SUBMISSION_LIMIT + 1; attempt += 1) {
    const requestHeaders = attempt % 2 === 0 ? changedSpoofedAddress : headers;
    const requestKey = applicationSubmissionClientKey(requestHeaders, secret);
    assert.equal(requestKey, clientKey);
    const requestCount = (requestCounts.get(requestKey) ?? 0) + 1;
    requestCounts.set(requestKey, requestCount);
    assert.equal(shouldAcceptApplicationSubmission(requestCount), attempt <= APPLICATION_SUBMISSION_LIMIT);
  }
});

test("application submissions use independent signed browser identities and reject missing or invalid identities", () => {
  const secret = "test-secret";
  const firstIdentity = issueApplicationClientIdentity(secret);
  const secondIdentity = issueApplicationClientIdentity(secret);
  const firstHeaders = new Headers({ cookie: `${APPLICATION_CLIENT_ID_COOKIE}=${firstIdentity}` });
  const secondHeaders = new Headers({ cookie: `${APPLICATION_CLIENT_ID_COOKIE}=${secondIdentity}` });
  const firstKey = applicationSubmissionClientKey(firstHeaders, secret);
  const secondKey = applicationSubmissionClientKey(secondHeaders, secret);
  assert.ok(firstKey);
  assert.ok(secondKey);
  assert.notEqual(firstKey, secondKey);
  const requestCounts = new Map<string, number>();
  for (let attempt = 1; attempt <= APPLICATION_SUBMISSION_LIMIT; attempt += 1) {
    requestCounts.set(firstKey, (requestCounts.get(firstKey) ?? 0) + 1);
  }
  requestCounts.set(secondKey, (requestCounts.get(secondKey) ?? 0) + 1);
  assert.equal(shouldAcceptApplicationSubmission(requestCounts.get(firstKey) ?? 0), true);
  assert.equal(requestCounts.get(secondKey), 1);

  const missingIdentity = new Headers({ "x-forwarded-for": "203.0.113.9", "x-real-ip": "203.0.113.9", "cf-connecting-ip": "203.0.113.9" });
  const invalidIdentity = new Headers({ cookie: `${APPLICATION_CLIENT_ID_COOKIE}=${firstIdentity.slice(0, -1)}0` });
  assert.equal(applicationSubmissionClientKey(missingIdentity, secret), null);
  assert.equal(applicationSubmissionClientKey(invalidIdentity, secret), null);
  assert.equal(verifyApplicationClientIdentity(firstIdentity, "different-secret"), null);
});

test("invalid login attempts use one generic response regardless of account lookup", async () => {
  const first = invalidLoginResponse();
  const second = invalidLoginResponse();
  assert.equal(first.status, 401);
  assert.equal(second.status, 401);
  assert.deepEqual(await first.json(), { message: INVALID_LOGIN_MESSAGE });
  assert.deepEqual(await second.json(), { message: INVALID_LOGIN_MESSAGE });
});

test("sensitive application outcomes and note deletion require confirmation", () => {
  assert.match(applicationStageConfirmation("hired") ?? "", /Move this application to Hired/);
  assert.match(applicationStageConfirmation("rejected") ?? "", /Move this application to Rejected/);
  assert.equal(applicationStageConfirmation("screening"), null);
  assert.match(noteDeletionConfirmation, /cannot be undone/);
});

test("candidate search trims text and enforces the input limit", () => {
  assert.deepEqual(parseCandidateSearch("  casey@example.com  "), { ok: true, search: "casey@example.com" });
  assert.deepEqual(parseCandidateSearch(null), { ok: true, search: "" });
  assert.deepEqual(parseCandidateSearch("x".repeat(121)), { ok: false });
});
