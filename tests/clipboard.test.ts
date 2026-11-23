import assert from "node:assert/strict";
import test from "node:test";
import { copyTextToClipboard } from "../lib/copy-to-clipboard.ts";

function mockDocument(copyResult: boolean) {
  const appended: HTMLTextAreaElement[] = [];
  let copyCommand = "";
  const documentRef = {
    body: { appendChild: (field: HTMLTextAreaElement) => { appended.push(field); return field; } },
    createElement: () => ({
      value: "",
      style: {},
      setAttribute() {},
      select() {},
      setSelectionRange() {},
      remove() { appended.length = 0; },
    }),
    execCommand: (command: string) => { copyCommand = command; return copyResult; },
  } as unknown as Document;
  return { documentRef, appended, copyCommand: () => copyCommand };
}

test("uses a temporary selectable field when the clipboard API is unavailable", async () => {
  const fallback = mockDocument(true);
  assert.equal(await copyTextToClipboard("https://example.test/invite", undefined, fallback.documentRef), true);
  assert.equal(fallback.copyCommand(), "copy");
  assert.equal(fallback.appended.length, 0);
});

test("falls back when clipboard permission is rejected", async () => {
  const fallback = mockDocument(true);
  const clipboard = { writeText: async () => { throw new DOMException("Write permission denied", "NotAllowedError"); } };
  assert.equal(await copyTextToClipboard("https://example.test/reset", clipboard, fallback.documentRef), true);
  assert.equal(fallback.copyCommand(), "copy");
});

test("reports failure when both browser copy paths are denied", async () => {
  const fallback = mockDocument(false);
  const clipboard = { writeText: async () => { throw new Error("denied"); } };
  assert.equal(await copyTextToClipboard("https://example.test/invite", clipboard, fallback.documentRef), false);
  assert.equal(fallback.appended.length, 0);
});
