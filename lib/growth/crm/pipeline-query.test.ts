import assert from "node:assert/strict";
import test from "node:test";
import { pipelineFiltersSchema } from "./schemas";
import { pipelineHref, parsePipelineFilters } from "./pipeline-query";
test("pipeline URLs retain filters across view changes and stage cursors", () => {
  const filters = parsePipelineFilters({
    q: "Acme & Sons",
    sector: "Engineering",
    nextAction: "overdue",
  });
  const href = pipelineHref(filters, { view: "list" }, { qualified: "cursor" });
  const url = new URL(href, "https://example.test");
  assert.equal(url.searchParams.get("q"), "Acme & Sons");
  assert.equal(url.searchParams.get("nextAction"), "overdue");
  assert.equal(url.searchParams.get("view"), "list");
  assert.equal(url.searchParams.get("after_qualified"), "cursor");
});
test("pipeline query rejects unknown states and saved views cannot store arbitrary SQL or destinations", () => {
  assert.deepEqual(
    parsePipelineFilters({
      stage: "won",
      nextAction: "sql",
      q: "x".repeat(121),
    }),
    pipelineFiltersSchema.parse({}),
  );
  assert.equal(
    pipelineFiltersSchema.safeParse({ sql: "delete from growth.prospects" })
      .success,
    false,
  );
});
