import { randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { getOperationsDb } from "../lib/operations/db/client";
import { founderRequestCommandSchema } from "../lib/operations/requests/validation";
import { executeFounderRequestCommand } from "../lib/operations/requests/service";
import {
  parseMappingCommand,
  resolveMappingOperator,
} from "./map-operations-organisations";

export const reviewedRequestOperationSchema = z.strictObject({
  organisationId: z.uuid(),
  command: founderRequestCommandSchema,
});
export async function runRequestCommand(args: string[]): Promise<void> {
  const options = parseMappingCommand(args);
  if ((await stat(options.file)).size > 64 * 1024)
    throw new Error("The reviewed request operation exceeds 64 KB.");
  const operation = reviewedRequestOperationSchema.parse(
    JSON.parse(await readFile(options.file, "utf8")),
  );
  if (!options.apply) {
    console.log(
      `Validated request ${operation.command.action}. No changes made.`,
    );
    return;
  }
  const founder = resolveMappingOperator(options.reviewer, process.env);
  const db = getOperationsDb();
  try {
    const result = await executeFounderRequestCommand(
      db,
      founder,
      operation.organisationId,
      operation.command,
      randomUUID(),
    );
    console.log(`Saved request ${result.id} at version ${result.version}.`);
  } finally {
    await db.end();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runRequestCommand(process.argv.slice(2)).catch(() => {
    console.error(
      "Request operation failed. Check the reviewed file, current version, founder configuration and database access.",
    );
    process.exitCode = 1;
  });
}
