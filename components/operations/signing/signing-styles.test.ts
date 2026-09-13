import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("portal signing retains its header and width while Operations uses a separate page class", () => {
  const css = readFileSync(
    new URL("./signing.module.css", import.meta.url),
    "utf8",
  );
  assert.match(
    css,
    /\.page\s*\{[^}]*max-width: 960px;[^}]*margin-inline: auto;/,
  );
  assert.match(css, /\.page > header\s*\{[^}]*padding-block: 16px 8px;/);
  assert.match(
    css,
    /\.page > header h1\s*\{[^}]*font-size: clamp\(2rem, 4vw, 3rem\);/,
  );
  assert.match(css, /\.page > header p\s*\{[^}]*max-width: 62ch;/);
  const portal = readFileSync(
    new URL(
      "../../../app/(portal)/portal/agreements/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const operations = readFileSync(
    new URL(
      "../../../app/(growth)/(dashboard)/growth/operations/clients/[organisationId]/signing/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(portal, /signingStyles\.page/);
  assert.doesNotMatch(portal, /signingStyles\.operationsPage/);
  assert.match(operations, /signingStyles\.operationsPage/);
  assert.doesNotMatch(operations, /signingStyles\.page/);
});
