import assert from "node:assert/strict";
import test from "node:test";
import { sameOrigin, trustedOriginsForRequest } from "../server/http.ts";

test("origin checks accept registered local aliases and reject cross-site origins", () => {
  const original = process.env.BETTER_AUTH_URL;
  process.env.BETTER_AUTH_URL = "http://localhost:3000";

  try {
    for (const host of ["localhost:3000", "127.0.0.1:3000"]) {
      const request = new Request(`http://${host}/api/setup`, {
        method: "POST",
        headers: { host, origin: `http://${host}` },
      });
      assert.equal(sameOrigin(request), true);
    }

    const crossSite = new Request("http://127.0.0.1:3000/api/setup", {
      method: "POST",
      headers: { host: "127.0.0.1:3000", origin: "https://attacker.example" },
    });
    assert.equal(sameOrigin(crossSite), false);

    const unexpectedPort = new Request("http://127.0.0.1:3001/api/setup", {
      method: "POST",
      headers: { host: "127.0.0.1:3001", origin: "http://127.0.0.1:3001" },
    });
    assert.equal(sameOrigin(unexpectedPort), false);
  } finally {
    if (original === undefined) delete process.env.BETTER_AUTH_URL;
    else process.env.BETTER_AUTH_URL = original;
  }
});

test("origin checks accept only configured forwarded preview host and protocol", () => {
  const original = process.env.BETTER_AUTH_URL;
  process.env.BETTER_AUTH_URL = "https://preview.example.test";

  try {
    const preview = new Request("http://app-internal:3000/api/setup", {
      method: "POST",
      headers: {
        host: "app-internal:3000",
        origin: "https://preview.example.test",
        "x-forwarded-host": "preview.example.test",
        "x-forwarded-proto": "https",
      },
    });
    assert.equal(sameOrigin(preview), true);
    assert.ok(trustedOriginsForRequest(preview).includes("https://preview.example.test"));

    const spoofedForwarding = new Request("http://app-internal:3000/api/setup", {
      method: "POST",
      headers: {
        host: "app-internal:3000",
        origin: "https://attacker.example",
        "x-forwarded-host": "attacker.example",
        "x-forwarded-proto": "https",
      },
    });
    assert.equal(sameOrigin(spoofedForwarding), false);

    const wrongProtocol = new Request("http://app-internal:3000/api/setup", {
      method: "POST",
      headers: {
        host: "app-internal:3000",
        origin: "http://preview.example.test",
        "x-forwarded-host": "preview.example.test",
        "x-forwarded-proto": "http",
      },
    });
    assert.equal(sameOrigin(wrongProtocol), false);
  } finally {
    if (original === undefined) delete process.env.BETTER_AUTH_URL;
    else process.env.BETTER_AUTH_URL = original;
  }
});

test("origin checks reject missing and malformed origins", () => {
  const original = process.env.BETTER_AUTH_URL;
  process.env.BETTER_AUTH_URL = "http://localhost:3000";

  try {
    assert.equal(sameOrigin(new Request("http://localhost:3000/api/setup")), false);
    const malformed = new Request("http://localhost:3000/api/setup", {
      headers: { origin: "null" },
    });
    assert.equal(sameOrigin(malformed), false);
  } finally {
    if (original === undefined) delete process.env.BETTER_AUTH_URL;
    else process.env.BETTER_AUTH_URL = original;
  }
});
