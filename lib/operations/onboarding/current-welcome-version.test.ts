import assert from "node:assert/strict";
import test from "node:test";
import type { OperationsTransaction } from "../db/client";
import { JourneyConflict } from "./command-types";
import { assertCurrentDesignedWelcomeVersion } from "./current-welcome-version";
import { createDesignedWelcomePack } from "./packet-editions";

const versionId = "23c9f3cb-77f7-4c05-b859-f319c88b14a0";

function transaction(row: unknown): OperationsTransaction {
  return (async () => (row ? [row] : [])) as unknown as OperationsTransaction;
}

test("accepts only the latest published designed edition", async () => {
  const content = createDesignedWelcomePack("website_build");
  const current = transaction({ packId: "website_build", content });
  await assert.doesNotReject(
    assertCurrentDesignedWelcomeVersion(current, versionId, "website_build"),
  );
  for (const [tx, edition] of [
    [transaction(null), "website_build"],
    [current, "website_seo"],
    [
      transaction({
        packId: "website_build",
        content: { ...content, rendererVersion: undefined },
      }),
      "website_build",
    ],
  ] as const) {
    await assert.rejects(
      assertCurrentDesignedWelcomeVersion(tx, versionId, edition),
      (error) =>
        error instanceof JourneyConflict && error.code === "stale_preview",
    );
  }
});
