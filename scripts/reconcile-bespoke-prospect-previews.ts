import { readGrowthServerEnv } from "../lib/growth/config/env";
import { createGrowthDb } from "../lib/growth/db/client";
import {
  createPostgresBespokePreviewReconciliationRepository,
  reconcileBespokeProspectPreviews,
} from "../lib/growth/prospect-previews/bespoke-reconciliation";

type ReconciliationCommand = {
  apply: boolean;
  branch: string;
  pullRequestNumber: number;
};

function readCommand(argumentsList: readonly string[]): ReconciliationCommand {
  const apply = argumentsList.includes("--apply");
  const values = argumentsList.filter((value) => value !== "--apply");
  if (
    values.length !== 4 ||
    values[0] !== "--pr-number" ||
    values[2] !== "--branch"
  ) {
    throw new Error(
      "Usage: pnpm growth:previews:reconcile-bespoke -- --pr-number <number> --branch fix/<name> [--apply]",
    );
  }

  const pullRequestNumber = Number(values[1]);
  const branch = values[3];
  if (
    !Number.isInteger(pullRequestNumber) ||
    pullRequestNumber < 1 ||
    !branch
  ) {
    throw new Error("Bespoke preview reconciliation command is invalid.");
  }

  return { apply, branch, pullRequestNumber };
}

async function main(): Promise<void> {
  const command = readCommand(process.argv.slice(2));
  const environment = readGrowthServerEnv();
  const db = createGrowthDb(environment.databaseUrl);

  try {
    const result = await reconcileBespokeProspectPreviews({
      apply: command.apply,
      release: {
        branch: command.branch,
        generatedAt: new Date(),
        pullRequestNumber: command.pullRequestNumber,
      },
      repository: createPostgresBespokePreviewReconciliationRepository(db),
    });
    process.stdout.write(
      `${JSON.stringify({
        status: result.status,
        slugs: result.previews.map((preview) => preview.slug),
      })}\n`,
    );
  } finally {
    await db.end({ timeout: 5 });
  }
}

void main().catch(() => {
  process.stderr.write("Bespoke preview reconciliation failed.\n");
  process.exitCode = 1;
});
