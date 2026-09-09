import { z } from "zod";
import { getOperationsDb } from "../lib/operations/db/client";
import { runMetricExport } from "../lib/operations/metrics/export-repository";
import { resolveMappingOperator } from "./map-operations-organisations";
async function main(): Promise<void> {
  const [id, flag, reviewer] = process.argv.slice(2);
  z.uuid().parse(id);
  if (flag !== "--reviewed-by" || !reviewer)
    throw new Error(
      "Supply an export UUID and --reviewed-by configured founder email.",
    );
  const founder = resolveMappingOperator(reviewer, process.env),
    db = getOperationsDb();
  try {
    await runMetricExport(db, founder, id);
  } finally {
    await db.end();
  }
}
main().catch(() => {
  process.stderr.write(
    "Metric export did not complete. Check the queued job and retry the reviewed command.\n",
  );
  process.exitCode = 1;
});
