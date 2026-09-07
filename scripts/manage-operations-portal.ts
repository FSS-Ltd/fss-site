import { open, readFile, stat, unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { resolveSiteUrl } from "../lib/config/site-url";
import { getOperationsDb } from "../lib/operations/db/client";
import {
  applyPortalOperation,
  portalOperationSchema,
} from "../lib/operations/auth/operator";
import { resolveMappingOperator } from "./map-operations-organisations";

export function parsePortalCommand(args: string[]): {
  file: string;
  apply: boolean;
  reviewer?: string;
  output?: string;
} {
  const [file, ...flags] = args;
  if (!file || file.startsWith("--"))
    throw new Error("A reviewed JSON file is required.");
  if (!flags.length) return { file, apply: false };
  if (
    (flags.length !== 3 && flags.length !== 5) ||
    flags[0] !== "--apply" ||
    flags[1] !== "--reviewed-by" ||
    (flags.length === 5 &&
      (flags[3] !== "--output" || !flags[4] || flags[4].startsWith("--")))
  )
    throw new Error(
      "Use --apply --reviewed-by <founder-email> [--output <new-private-file>].",
    );
  return {
    file,
    apply: true,
    reviewer: z.email().parse(flags[2]).toLowerCase(),
    output: flags[4],
  };
}

export async function runPortalCommand(args: string[]): Promise<void> {
  const options = parsePortalCommand(args);
  if ((await stat(options.file)).size > 8192)
    throw new Error("The operation file exceeds 8 KB.");
  const operation = portalOperationSchema.parse(
    JSON.parse(await readFile(options.file, "utf8")),
  );
  if (!options.apply) {
    console.log(`Validated ${operation.action}. No changes made.`);
    return;
  }
  const founder = resolveMappingOperator(options.reviewer, process.env);
  if ((operation.action === "issue_invite") !== Boolean(options.output))
    throw new Error(
      "Only invitation issuance requires --output pointing to a new private file.",
    );
  const origin = resolveSiteUrl();
  // Reserve the private output before creating an account or replacing an invite.
  const db = getOperationsDb();
  const output = options.output
    ? await open(options.output, "wx", 0o600)
    : null;
  let completed = false;
  try {
    const result = await applyPortalOperation(db, founder, operation, origin);
    if (output) {
      await output.writeFile(`${JSON.stringify(result, null, 2)}\n`, "utf8");
      await output.sync();
    }
    completed = true;
    if (result.action === "create_contact")
      console.log(`Created contact ${result.contactId}.`);
    else
      console.log(
        `Completed ${result.action}.${output ? " Invitation saved to the private output file." : ""}`,
      );
  } finally {
    await output?.close();
    if (!completed && output && options.output) await unlink(options.output);
    await db.end();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runPortalCommand(process.argv.slice(2)).catch(() => {
    console.error(
      "Portal operation failed. Check the reviewed file, founder configuration and service access. If invitation output failed after issuance, reissue to replace the inaccessible token.",
    );
    process.exitCode = 1;
  });
}
