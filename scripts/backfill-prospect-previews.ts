import { backfillProspectPreviews } from "../lib/growth/prospect-previews/backfill";
import { readGrowthServerEnv } from "../lib/growth/config/env";
import { createGrowthDb } from "../lib/growth/db/client";

async function main(): Promise<void> {
  const databaseUrl = readGrowthServerEnv().databaseUrl;
  const db = createGrowthDb(databaseUrl);

  try {
    const result = await backfillProspectPreviews(db);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await db.end({ timeout: 5 });
  }
}

void main().catch(() => {
  process.stderr.write("Prospect preview backfill failed.\n");
  process.exitCode = 1;
});
