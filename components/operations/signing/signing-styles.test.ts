import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("legacy signing retains its header and width while redesigned portal agreements use shared portal layout", () => {
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
      "../../../app/(portal)/(client)/portal/agreements/page.tsx",
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
  const journey = readFileSync(
    new URL(
      "../../../app/(growth)/(dashboard)/growth/operations/clients/[organisationId]/journey/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(
    portal,
    /components\/portal\/agreements\/agreements\.module\.css/,
  );
  assert.match(portal, /className=\{styles\.page\}/);
  assert.doesNotMatch(portal, /signingStyles\./);
  assert.match(operations, /signingStyles\.operationsPage/);
  assert.doesNotMatch(operations, /signingStyles\.page/);
  assert.match(journey, /layout\.operationsPage/);
  assert.doesNotMatch(journey, /layout\.page/);
});
