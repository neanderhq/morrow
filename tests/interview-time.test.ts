import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalTimeZone, resolveWallTime, zonedLocalTime } from "../lib/interview-time.ts";

test("manual scheduling round-trips non-hour offsets and simultaneous local times", () => {
  const instant = resolveWallTime("2030-02-12T15:30", "Asia/Kolkata")!;
  assert.equal(instant.toISOString(), "2030-02-12T10:00:00.000Z");
  assert.equal(zonedLocalTime(instant, "America/New_York"), "2030-02-12T05:00");
  assert.equal(canonicalTimeZone("bad/tz"), null);
});

test("manual scheduling refuses invalid, nonexistent and ambiguous wall times", () => {
  assert.equal(resolveWallTime("2026-02-31T12:15", "UTC"), null);
  assert.equal(resolveWallTime("2026-03-08T02:30", "America/New_York"), null);
  assert.equal(resolveWallTime("2026-11-01T01:30", "America/New_York"), null);
  assert.equal(resolveWallTime("2026-04-05T01:45", "Australia/Lord_Howe"), null);
});
