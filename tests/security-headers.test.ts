import assert from "node:assert/strict";
import test from "node:test";
import { securityHeaders } from "../server/security-headers.ts";
import config from "../next.config.ts";

test("applies compatible security headers across every app path", async () => {
  const rules = await config.headers?.();
  assert.ok(rules?.some((rule) => rule.source === "/:path*"));
  const headers = new Map(securityHeaders.map(({ key, value }) => [key.toLowerCase(), value]));
  assert.equal(headers.get("x-content-type-options"), "nosniff");
  assert.equal(headers.get("x-frame-options"), "DENY");
  assert.equal(headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.match(headers.get("permissions-policy") ?? "", /camera=\(\)/);
  assert.match(headers.get("strict-transport-security") ?? "", /max-age=31536000/);
  assert.equal(headers.has("content-security-policy"), false);
});
