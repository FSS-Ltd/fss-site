import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import {
  getOperationsDb,
  operationsEnabled,
} from "../lib/operations/db/client";
import { parseReviewedMapping } from "../lib/operations/organisations/link-engagement";
import { applyReviewedMapping } from "../lib/operations/organisations/repository";
import type { OperationsFounder } from "../lib/operations/organisations/types";

export function parseMappingCommand(args: string[]): {
  file: string;
  apply: boolean;
  reviewer?: string;
} {
  const [file, ...flags] = args;
  if (!file || file.startsWith("--"))
    throw new Error(
      "Usage: map-operations-organisations <reviewed.json> [--apply --reviewed-by <founder-email>]",
    );
  if (flags.length === 0) return { file, apply: false };
  if (
    flags.length === 3 &&
    flags[0] === "--apply" &&
    flags[1] === "--reviewed-by"
  ) {
    return {
      file,
      apply: true,
      reviewer: z.email().parse(flags[2]).toLowerCase(),
    };
  }
  throw new Error(
    "Use --apply --reviewed-by <founder-email> together after reviewing the file.",
  );
}

export function resolveMappingOperator(
  reviewer: string | undefined,
  env: Record<string, string | undefined>,
): OperationsFounder {
  const owner = z
    .email()
    .parse(env.GROWTH_OS_OWNER_EMAIL?.trim().toLowerCase());
  if (!reviewer || reviewer !== owner)
    throw new Error("Mapping must be reviewed by the configured founder.");
  if (!operationsEnabled(env)) throw new Error("Operations is disabled.");
  return { actorId: createHash("sha256").update(owner).digest("hex") };
}

export async function runMappingCommand(args: string[]): Promise<void> {
  const options = parseMappingCommand(args);
  if ((await stat(options.file)).size > 1024 * 1024)
    throw new Error("Mapping file exceeds 1 MB.");
  const mapping = parseReviewedMapping(
    JSON.parse(await readFile(options.file, "utf8")),
  );
  if (!options.apply) {
    console.log(
      `Validated ${mapping.organisations.length} organisations and ${mapping.organisations.reduce((sum, row) => sum + row.engagementIds.length, 0)} explicit engagement links. No database changes.`,
    );
    return;
  }
  const founder = resolveMappingOperator(options.reviewer, process.env);
  const db = getOperationsDb();
  try {
    const result = await applyReviewedMapping(db, founder, mapping);
    console.log(
      `Created ${result.organisationsCreated} organisations and ${result.engagementsLinked} engagement links.`,
    );
  } finally {
    await db.end();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runMappingCommand(process.argv.slice(2)).catch(() => {
    console.error(
      "Mapping failed. Check the reviewed file, founder configuration and database access. No partial mapping was committed.",
    );
    process.exitCode = 1;
  });
}
