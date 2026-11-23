import assert from "node:assert/strict";
import test from "node:test";
import { auditActions, auditPageSize, parseAuditFilters } from "../server/audit.ts";

test("audit filters accept combined action, user, date range, and pagination", () => {
  const result = parseAuditFilters(new URLSearchParams({
    action: "application.stage_changed",
    userId: "staff-123",
    from: "2026-03-14",
    to: "2026-03-16",
    page: "3",
  }));

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.filters.action, "application.stage_changed");
  assert.equal(result.filters.userId, "staff-123");
  assert.equal(result.filters.from?.toISOString(), "2026-03-14T00:00:00.000Z");
  assert.equal(result.filters.to?.toISOString(), "2026-03-17T00:00:00.000Z");
  assert.equal(result.filters.page, 3);
});

test("audit filters default to all actions and the first page", () => {
  const result = parseAuditFilters(new URLSearchParams());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.filters.action, null);
  assert.equal(result.filters.userId, null);
  assert.equal(result.filters.page, 1);
  assert.equal(auditPageSize, 25);
});

test("audit filters reject unsupported actions, invalid dates, reversed ranges, and invalid pages", () => {
  assert.equal(parseAuditFilters(new URLSearchParams({ action: "staff.password_exposed" })).ok, false);
  assert.equal(parseAuditFilters(new URLSearchParams({ from: "2026-02-30" })).ok, false);
  assert.equal(parseAuditFilters(new URLSearchParams({ from: "2026-04-02", to: "2026-04-01" })).ok, false);
  assert.equal(parseAuditFilters(new URLSearchParams({ page: "0" })).ok, false);
  assert.equal(auditActions.includes("staff.reset_link_created"), true);
  assert.equal(auditActions.includes("staff.invitation_accepted"), true);
  assert.equal(auditActions.includes("staff.reactivated"), true);
});
