import assert from "node:assert/strict";
import test from "node:test";

import { markKeywordUsed, parseKeywordBank } from "./keyword-bank";

const PADDED = `## High-intent keywords

| Phrase                 | Intent        | Status |
|------------------------|---------------|--------|
|  AI automation cost UK | transactional | open   |
| Spreadsheet to app     | transactional | used   |

## Other

| Phrase | Status |
|---|---|
| AI automation cost UK | open |
`;

test("marks the matching open row used in a padded table and keeps the spacing", () => {
  const { text, matched } = markKeywordUsed(PADDED, "ai automation  cost uk");
  assert.equal(matched, true);
  assert.match(text, /\|  AI automation cost UK \| transactional \| used   \|/);
  // The same phrase in another section is untouched.
  assert.match(text, /\| AI automation cost UK \| open \|/);
  assert.deepEqual(
    parseKeywordBank(text).map((entry) => entry.status),
    ["used", "used"],
  );
});

test("reports no match for unknown or already used phrases and changes nothing", () => {
  for (const phrase of ["church software", "Spreadsheet to app"]) {
    const result = markKeywordUsed(PADDED, phrase);
    assert.equal(result.matched, false);
    assert.equal(result.text, PADDED);
  }
});
