import { randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { globalResearchRunSchema } from "./global-schema";
import { MAX_RESEARCH_BUNDLE_BYTES } from "./limits";
import {
  submitGlobalResearch,
  type SubmissionReport,
} from "./submission-client";
import {
  runRestrictedResearchChild,
  type RestrictedResearchExecutor,
} from "./restricted-research-child";

const childResultSchema = z
  .object({
    succeeded: z.boolean(),
    prospects: z.array(z.unknown()).max(10),
    rejections: z.array(z.unknown()).max(100),
  })
  .strict();
type DailyReport =
  | {
      ok: true;
      accepted: number;
      duplicates: number;
      rejected: number;
      attempts: number;
    }
  | { ok: false; reason: string; attempts: number };
type Options = {
  stateDirectory: string;
  now?: Date;
  research: () => unknown;
  secret: () => string;
  submit?: typeof submitGlobalResearch;
};

export function researchDailyProspects(
  execute?: RestrictedResearchExecutor,
): unknown {
  const schema = z
    .object({
      succeeded: z.boolean(),
      prospects: globalResearchRunSchema.shape.prospects,
      rejections: globalResearchRunSchema.shape.rejections,
    })
    .strict();
  return runRestrictedResearchChild({
    schema: z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }),
    model: "gpt-6.1-sol",
    execute,
    prompt: [
      "Research up to ten public business prospects using at most ten searches. Return succeeded=false when search or evidence gathering fails; a complete search may return no results.",
      "Use only first-party or official registry evidence for factual observations, contact provenance and actual observation timestamps. Google Maps may be used only as a discovery reference; do not copy reviews, ratings, descriptions or photos.",
      "Use null for unknown names, company number or region. Do not collect personal names unless actually necessary. Never infer consent, permission, owner identity, an absent website, results, deliverability, or completed work from public data.",
      "Prepare truthful review-only copy with a direct opt-out. Ask permission before offering a plan. Do not claim an approved service, price, preview or expiry without evidence. Private product feedback is not a rewarded public review. Do not invent rejection records.",
      "Never include proof or campaign authority. Never send, sign, submit, create previews, access local files or credentials. Return only the requested JSON.",
    ].join(" "),
  });
}

export function buildDailyResearchRunId(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (name: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === name)?.value;
  return `daily-${part("year")}-${part("month")}-${part("day")}-0700-europe-london-v2`;
}

function readPrivate(path: string): string | null {
  let fd: number;
  try {
    fd = openSync(
      path,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return null;
    throw error;
  }
  try {
    const stat = fstatSync(fd);
    if (
      !stat.isFile() ||
      (stat.mode & 0o077) !== 0 ||
      (process.getuid && stat.uid !== process.getuid()) ||
      stat.size > MAX_RESEARCH_BUNDLE_BYTES
    )
      throw Error("unsafe state");
    return readFileSync(fd, "utf8");
  } finally {
    closeSync(fd);
  }
}

function publish(directory: string, path: string, body: string): void {
  const temporary = join(directory, `.${randomUUID()}.tmp`);
  try {
    writeFileSync(temporary, body, { mode: 0o600, flag: "wx" });
    try {
      linkSync(temporary, path);
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "EEXIST")
      )
        throw error;
    }
  } finally {
    rmSync(temporary, { force: true });
  }
}

export async function runDailyResearch(input: Options): Promise<DailyReport> {
  const fail = (reason: string, attempts = 0): DailyReport => ({
    ok: false,
    reason,
    attempts,
  });
  const now = input.now ?? new Date();
  const runId = buildDailyResearchRunId(now);
  const runDate = runId.slice(6, 16);
  const bodyPath = join(input.stateDirectory, `${runId}.json`);
  let body: string;
  try {
    try {
      mkdirSync(input.stateDirectory, { mode: 0o700 });
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "EEXIST")
      )
        throw error;
    }
    const directory = lstatSync(input.stateDirectory);
    if (
      !directory.isDirectory() ||
      directory.isSymbolicLink() ||
      (directory.mode & 0o077) !== 0 ||
      (process.getuid && directory.uid !== process.getuid())
    )
      throw Error("unsafe directory");
    let stored = readPrivate(bodyPath);
    if (stored === null) {
      const research = childResultSchema.parse(input.research());
      if (!research.succeeded) return fail("research_failed");
      const parsed = globalResearchRunSchema.parse({
        schemaVersion: "2.0",
        externalRunId: runId,
        runDate,
        timezone: "Europe/London",
        promptVersion: "daily-research-v2",
        prospects: research.prospects,
        rejections: research.rejections,
        ...(research.prospects.length === 0 && research.rejections.length === 0
          ? { outcome: "no_results" }
          : {}),
      });
      if (parsed.prospects.some((candidate) => candidate.proof))
        return fail("invalid_research");
      const verifiedBy = input.now?.getTime() ?? Date.now();
      if (
        parsed.prospects.some((candidate) =>
          [
            candidate.business.verifiedAt,
            candidate.contact.emailVerifiedAt,
            ...candidate.evidence.flatMap((item) => [
              item.observedAt,
              item.verifiedAt,
            ]),
          ].some((value) => Date.parse(value) > verifiedBy),
        )
      )
        return fail("invalid_research");
      publish(input.stateDirectory, bodyPath, JSON.stringify(parsed));
      stored = readPrivate(bodyPath);
    }
    if (stored === null) throw Error("missing state");
    const parsed = globalResearchRunSchema.parse(JSON.parse(stored));
    if (
      parsed.externalRunId !== runId ||
      parsed.runDate !== runDate ||
      parsed.prospects.some((candidate) => candidate.proof)
    )
      throw Error("invalid state");
    body = stored;
  } catch {
    return fail("invalid_research");
  }
  let secret: string;
  try {
    secret = input.secret();
  } catch {
    return fail("local_setup_failed");
  }
  let submitted: SubmissionReport;
  try {
    submitted = await (input.submit ?? submitGlobalResearch)({
      rawBody: body,
      secret,
    });
  } catch {
    return fail("local_setup_failed");
  }
  if (!submitted.ok) return fail(submitted.reason, submitted.attempts);
  return {
    ok: true,
    accepted: submitted.result.accepted,
    duplicates: submitted.result.duplicates,
    rejected: submitted.result.rejected,
    attempts: submitted.attempts,
  };
}
