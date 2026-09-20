import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { SCREEN_COVERAGE_CSV_HEADER } from "../lib/operations/design/screen-coverage";
import { verifyFssStudioScreenCoverage } from "./verify-fss-studio-screen-coverage";

test("rejects a repository package that does not contain all 88 screens", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "fss-screen-coverage-"));
  const designDirectory = join(workspace, "docs/design/fss-studio-experience");

  try {
    await mkdir(designDirectory, { recursive: true });
    await writeFile(
      join(designDirectory, "screen-manifest.json"),
      JSON.stringify([
        {
          id: "C01",
          role: "Client",
          nav: "Home",
          title: "Overview",
          primary: "New request",
          route: "/portal",
        },
      ]),
    );
    await writeFile(
      join(designDirectory, "screen-coverage.csv"),
      [
        SCREEN_COVERAGE_CSV_HEADER,
        "C01,client,client-overview,docs/design/fss-studio-experience/wireframes/C01.svg,/portal,authorised overview,ClientOverview,loadClientOverview,create request,portal.request.create,client overview desktop matches C01,client overview mobile matches M01,components/portal/overview/client-overview.test.tsx,1,planned",
      ].join("\n"),
    );

    assert.deepEqual(await verifyFssStudioScreenCoverage(workspace), [
      "FSS Studio screen manifest must contain 88 screens.",
    ]);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
