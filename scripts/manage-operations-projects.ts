import { randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { getOperationsDb } from "../lib/operations/db/client";
import {
  projectCommandSchema,
  executeProjectCommand,
} from "../lib/operations/projects/service";
import { documentCommandSchema } from "../lib/operations/documents/validation";
import { executeDocumentCommand } from "../lib/operations/documents/service";
import {
  parseMappingCommand,
  resolveMappingOperator,
} from "./map-operations-organisations";

export const deliveryOperationSchema = z.discriminatedUnion("target", [
  z.strictObject({
    target: z.literal("project"),
    organisationId: z.uuid(),
    command: projectCommandSchema,
  }),
  z.strictObject({
    target: z.literal("document"),
    organisationId: z.uuid(),
    command: documentCommandSchema,
  }),
]);
export async function runDeliveryCommand(args: string[]): Promise<void> {
  const options = parseMappingCommand(args);
  if ((await stat(options.file)).size > 64 * 1024)
    throw new Error("The reviewed operation exceeds 64 KB.");
  const operation = deliveryOperationSchema.parse(
    JSON.parse(await readFile(options.file, "utf8")),
  );
  if (!options.apply) {
    console.log(
      `Validated ${operation.target} ${operation.command.action}. No changes made.`,
    );
    return;
  }
  const founder = resolveMappingOperator(options.reviewer, process.env);
  const db = getOperationsDb();
  try {
    const execute =
      operation.target === "project"
        ? executeProjectCommand
        : executeDocumentCommand;
    const result = await execute(
      db,
      founder,
      operation.organisationId,
      operation.command,
      randomUUID(),
    );
    console.log(
      `Saved ${operation.target} ${result.id} at version ${result.version}.`,
    );
  } finally {
    await db.end();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runDeliveryCommand(process.argv.slice(2)).catch(() => {
    console.error(
      "Delivery operation failed. Check the reviewed file, current version, founder configuration and database access.",
    );
    process.exitCode = 1;
  });
}
