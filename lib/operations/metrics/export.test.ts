import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell, receivablesCsv } from "./export";
import { createMetricExportHandler } from "./export-handler";
const founder = { actorId: "a".repeat(64) },
  id = "00000000-0000-4000-8000-000000000001";
test("CSV neutralizes formulas after whitespace and quotes commas/newlines", () => {
  for (const value of ['=HYPERLINK("bad")', "+1", "-1", "@SUM(A1)", " \t=1"])
    assert.ok(csvCell(value).startsWith("\"'"));
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.match(
    receivablesCsv([], "2026-09-08T12:00:00Z", "v1"),
    /"Definition version","v1"/,
  );
});
test("export is founder-only, same-origin, bounded JSON and private download", async () => {
  let writes = 0;
  const deps = {
    enabled: true,
    origin: "https://example.test",
    founder: async () => founder,
    enqueue: async () => {
      writes++;
      return id;
    },
    read: async () => ({ state: "complete", failure: null, csv: "safe" }),
  };
  const run = createMetricExportHandler(deps),
    url = "https://example.test/api/export";
  const post = (origin: string) =>
    new Request(url, {
      method: "POST",
      headers: { origin, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "request", filters: {} }),
    });
  assert.equal((await run(post("https://evil.test"))).status, 403);
  assert.equal(writes, 0);
  assert.equal(
    (
      await createMetricExportHandler({
        ...deps,
        founder: async () => {
          throw new Error();
        },
      })(post(deps.origin))
    ).status,
    403,
  );
  assert.equal((await run(post(deps.origin))).status, 202);
  assert.equal(writes, 1);
  const download = await run(new Request(`${url}?id=${id}&download=1`));
  assert.equal(download.status, 200);
  assert.match(download.headers.get("cache-control") ?? "", /no-store/);
  assert.equal(download.headers.get("referrer-policy"), "no-referrer");
  assert.equal(await download.text(), "safe");
  assert.equal((await run(new Request(`${url}?id=bad`))).status, 400);
});
