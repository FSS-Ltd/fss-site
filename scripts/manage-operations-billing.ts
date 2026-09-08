import { randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { getOperationsDb } from "../lib/operations/db/client";
import { readBillingConfiguration } from "../lib/operations/billing/configuration";
import { createOperationsBillingClient } from "../lib/operations/billing/client";
import { createBillingSchedule } from "../lib/operations/billing/schedules";
import { executeBillingObligation } from "../lib/operations/billing/invoice-service";
import { previewBillingAmendment } from "../lib/operations/billing/amendments";
import {
  parseMappingCommand,
  resolveMappingOperator,
} from "./map-operations-organisations";

export const billingOperationSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("schedule"),
    organisationId: z.uuid(),
    agreementId: z.uuid(),
    revision: z.number().int().positive(),
  }),
  z.strictObject({
    action: z.literal("issue"),
    organisationId: z.uuid(),
    scheduleId: z.uuid(),
    commandKey: z.uuid(),
  }),
  z.strictObject({
    action: z.literal("preview-amendment"),
    organisationId: z.uuid(),
    scheduleId: z.uuid(),
    agreementId: z.uuid(),
    revision: z.number().int().positive(),
    lineNumber: z.number().int().positive(),
    effectiveAt: z.iso.datetime(),
  }),
]);
export async function runBillingCommand(args: string[]): Promise<void> {
  const options = parseMappingCommand(args);
  if ((await stat(options.file)).size > 16 * 1024)
    throw new Error("The reviewed billing operation exceeds 16 KB.");
  const operation = billingOperationSchema.parse(
    JSON.parse(await readFile(options.file, "utf8")),
  );
  if (!options.apply) {
    console.log(
      `Validated billing ${operation.action} input. No database or provider changes made.`,
    );
    return;
  }
  const founder = resolveMappingOperator(options.reviewer, process.env);
  const configuration = readBillingConfiguration();
  if (!configuration.enabled)
    throw new Error("Operations billing is disabled.");
  const scope = {
    organisationId: operation.organisationId,
    accountId: configuration.accountId,
    mode: configuration.mode,
  };
  const db = getOperationsDb();
  const correlationId = randomUUID();
  try {
    if (operation.action === "schedule") {
      const ids = await createBillingSchedule(
        db,
        founder,
        scope,
        operation.agreementId,
        operation.revision,
        correlationId,
      );
      console.log(JSON.stringify({ scheduleIds: ids, correlationId }));
      return;
    }
    const stripe = await createOperationsBillingClient();
    if (!stripe) throw new Error("Operations billing is disabled.");
    if (operation.action === "issue") {
      const result = await executeBillingObligation(
        db,
        founder,
        scope,
        operation.scheduleId,
        operation.commandKey,
        stripe,
        correlationId,
      );
      console.log(
        JSON.stringify({ providerReference: result.providerId, correlationId }),
      );
    } else {
      const input = {
        scheduleId: operation.scheduleId,
        agreementId: operation.agreementId,
        revision: operation.revision,
        lineNumber: operation.lineNumber,
        effectiveAt: operation.effectiveAt,
      };
      const result = await previewBillingAmendment(
        db,
        founder,
        scope,
        input,
        stripe,
        correlationId,
      );
      console.log(JSON.stringify({ ...result, correlationId }));
    }
  } finally {
    await db.end();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runBillingCommand(process.argv.slice(2)).catch(() => {
    console.error(
      "Billing operation failed. Check the reviewed command, signed agreement, billing configuration and provider reconciliation before retrying.",
    );
    process.exitCode = 1;
  });
}
