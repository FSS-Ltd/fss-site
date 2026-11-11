import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  isKnownKeyword,
  parseKeywordBank,
  readKeywordBank,
} from "./keyword-bank";

const FIXTURE = `# Bank

## How to use

| Not | This |
|---|---|
| ignored | table |

## High-intent keywords

| Phrase | Intent | Source | Status |
|---|---|---|---|
| AI automation cost UK | transactional | https://example.com/a; inference | open |
| Spreadsheet to app | transactional | https://example.com/b | used |

## Informational keywords

| Phrase | Status |
|---|---|
| should not appear | open |
`;

test("parses only the High-intent keywords table", () => {
  assert.deepEqual(parseKeywordBank(FIXTURE), [
    { phrase: "AI automation cost UK", status: "open" },
    { phrase: "Spreadsheet to app", status: "used" },
  ]);
});

test("membership is case and whitespace insensitive", () => {
  const bank = parseKeywordBank(FIXTURE);
  assert.equal(isKnownKeyword(bank, "  ai AUTOMATION   cost uk "), true);
  assert.equal(isKnownKeyword(bank, "church software"), false);
});

test("without a bank only a non-empty keyword is required", () => {
  assert.equal(isKnownKeyword(null, "anything at all"), true);
  assert.equal(isKnownKeyword(null, "   "), false);
  assert.equal(isKnownKeyword(parseKeywordBank(FIXTURE), ""), false);
});

test("readKeywordBank returns null for a missing or empty file and parses a present one", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kwbank-"));
  try {
    assert.equal(readKeywordBank(path.join(dir, "missing.md")), null);
    const empty = path.join(dir, "empty.md");
    fs.writeFileSync(empty, "# nothing here\n");
    assert.equal(readKeywordBank(empty), null);
    const present = path.join(dir, "bank.md");
    fs.writeFileSync(present, FIXTURE);
    assert.equal(readKeywordBank(present)?.length, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
