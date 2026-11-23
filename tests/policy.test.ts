import assert from "node:assert/strict";
import test from "node:test";
import { applicationStages, canChangeApplicationStage, canDeleteApplicationNote, canManageJobs, canManageStaff, canReactivateStaff, canViewAllApplications, isApplicationStage, validEmail, validEmploymentType, validPassword, validRole, wouldDeactivateLastActiveAdmin } from "../server/policy.ts";

test("only Admin can manage staff", () => {
  assert.equal(canManageStaff("admin"), true);
  assert.equal(canManageStaff("recruiter"), false);
  assert.equal(canManageStaff("hiring_manager"), false);
  assert.equal(canManageStaff("interviewer"), false);
});

test("only Admin can reactivate staff accounts", () => {
  assert.equal(canReactivateStaff("admin"), true);
  assert.equal(canReactivateStaff("recruiter"), false);
  assert.equal(canReactivateStaff("hiring_manager"), false);
  assert.equal(canReactivateStaff("interviewer"), false);
});

test("staff changes preserve at least one active Admin", () => {
  assert.equal(wouldDeactivateLastActiveAdmin("admin", true, 1), true);
  assert.equal(wouldDeactivateLastActiveAdmin("admin", true, 2), false);
  assert.equal(wouldDeactivateLastActiveAdmin("admin", false, 0), false);
  assert.equal(wouldDeactivateLastActiveAdmin("recruiter", true, 1), false);
});

test("Admins and Recruiters manage jobs and all applications", () => {
  assert.equal(canManageJobs("admin"), true);
  assert.equal(canManageJobs("recruiter"), true);
  assert.equal(canManageJobs("hiring_manager"), false);
  assert.equal(canManageJobs("interviewer"), false);
  assert.equal(canViewAllApplications("recruiter"), true);
  assert.equal(canViewAllApplications("interviewer"), false);
});

test("application stage changes follow role and assignment rules", () => {
  for (const stage of applicationStages) assert.equal(isApplicationStage(stage), true);
  assert.equal(isApplicationStage("withdrawn"), false);
  assert.equal(canChangeApplicationStage("admin", false), true);
  assert.equal(canChangeApplicationStage("recruiter", false), true);
  assert.equal(canChangeApplicationStage("hiring_manager", true), true);
  assert.equal(canChangeApplicationStage("hiring_manager", false), false);
  assert.equal(canChangeApplicationStage("interviewer", true), false);
});

test("application notes can only be deleted by their author or an Admin", () => {
  assert.equal(canDeleteApplicationNote("recruiter", "staff-1", "staff-1"), true);
  assert.equal(canDeleteApplicationNote("recruiter", "staff-1", "staff-2"), false);
  assert.equal(canDeleteApplicationNote("admin", "staff-1", "staff-2"), true);
});

test("employment type accepts only the requested choices", () => {
  assert.equal(validEmploymentType("full_time"), true);
  assert.equal(validEmploymentType("part_time"), true);
  assert.equal(validEmploymentType("contract"), true);
  assert.equal(validEmploymentType("temporary"), false);
});

test("role validation accepts the four supported roles only", () => {
  for (const role of ["admin", "recruiter", "hiring_manager", "interviewer"]) assert.equal(validRole(role), true);
  assert.equal(validRole("owner"), false);
  assert.equal(validRole(null), false);
});

test("password and email validation handles boundaries", () => {
  assert.equal(validPassword("short"), false);
  assert.equal(validPassword("twelve-chars"), true);
  assert.equal(validPassword("x".repeat(129)), false);
  assert.equal(validEmail("person@example.com"), true);
  assert.equal(validEmail("not-an-email"), false);
});
