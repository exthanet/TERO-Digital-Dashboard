import assert from "node:assert/strict";
import test from "node:test";
import { anonymousDownloadUrl, isXlsx } from "../lib/integrations/sharepoint.ts";

test("a sharing link asks for the file itself", () => {
  assert.equal(anonymousDownloadUrl("https://example.sharepoint.com/:x:/s/team/AbC?e=xyz"), "https://example.sharepoint.com/:x:/s/team/AbC?e=xyz&download=1");
  assert.equal(anonymousDownloadUrl("https://example.sharepoint.com/:x:/g/AbC"), "https://example.sharepoint.com/:x:/g/AbC?download=1");
  assert.equal(anonymousDownloadUrl("https://example.sharepoint.com/:x:/g/AbC?download=1"), "https://example.sharepoint.com/:x:/g/AbC?download=1");
});

test("an Excel file is a zip; a sign-in page is not", () => {
  assert.equal(isXlsx(new Uint8Array([0x50, 0x4b, 3, 4, 0])), true);
  assert.equal(isXlsx(new TextEncoder().encode("<!DOCTYPE html>")), false);
});
