import { spawnSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants,
  fstatSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import { buildWeekdayExternalRunId } from "../research/scheduled-agent-runner";
import { facebookDiscoveryBatchSchema } from "./contracts";

const endpoint = "https://faithfulsoftware.dev/api/agent/facebook-discovery";
const resultSchema = z
  .object({
    count: z.number().int().min(0).max(10),
    alreadyExisted: z.boolean(),
  })
  .strict();
const researchSchema = z
  .object({
    succeeded: z.boolean(),
    observations: z.array(z.unknown()).max(10),
  })
  .strict();
type Research = z.infer<typeof researchSchema>;
type Report =
  | { ok: true; count: number; alreadyExisted: boolean; attempts: number }
  | {
      ok: false;
      reason:
        | "research_failed"
        | "local_setup_failed"
        | "invalid_credential"
        | "http_error"
        | "transport_error"
        | "invalid_response";
      httpStatus: number | null;
      attempts: number;
    };
type Options = {
  now?: Date;
  repositoryRoot: string;
  stateDirectory: string;
  research?: () => unknown;
  secret: () => string;
  request?: typeof fetch;
  wait?: (milliseconds: number) => Promise<void>;
};

export function buildFacebookRunId(date: Date): string {
  return buildWeekdayExternalRunId(date)
    .replace(/^weekday-/, "facebook-")
    .replace("-0600-", "-0730-");
}

function researchPublicDestinations(repositoryRoot: string): Research {
  const workspace = mkdtempSync(join(tmpdir(), "fss-facebook-research-"));
  chmodSync(workspace, 0o700);
  try {
    const schemaPath = join(workspace, "schema.json");
    const outputPath = join(workspace, "output.json");
    const text = { type: "string" };
    const nullableText = { type: ["string", "null"] };
    const observation = {
      type: "object",
      additionalProperties: false,
      required: ["sourceUrl", "summary", "observedAt"],
      properties: { sourceUrl: text, summary: text, observedAt: text },
    };
    const destination = {
      type: "object",
      additionalProperties: false,
      required: [
        "url",
        "name",
        "kind",
        "locality",
        "websiteUrl",
        "observation",
      ],
      properties: {
        url: text,
        name: text,
        kind: { type: "string", enum: ["page", "group"] },
        locality: nullableText,
        websiteUrl: nullableText,
        observation,
      },
    };
    writeFileSync(
      schemaPath,
      JSON.stringify({
        type: "object",
        additionalProperties: false,
        required: ["succeeded", "observations"],
        properties: {
          succeeded: { type: "boolean" },
          observations: { type: "array", maxItems: 10, items: destination },
        },
      }),
      { mode: 0o600 },
    );
    const prompt =
      "Find up to ten active public Facebook pages or groups relevant to UK local business owners for a founder to review for manual follow or join. Make at most ten public searches and use public evidence only; include only destinations supported by evidence of activity and business relevance. Return destination name, type, Facebook URL, locality and website when known, plus public source URL, factual activity summary and observed timestamp for each. Use ISO 8601 timestamps with timezone. Never access private groups, bypass login, join, follow, post, review posting rules, submit data, read credentials or inspect local user files. Return succeeded=false if search or evidence gathering fails; a successful search may return zero observations. Return only schema-conformant JSON.";
    const child = spawnSync(
      "codex",
      [
        "--search",
        "exec",
        "--ephemeral",
        "--ignore-user-config",
        "--ignore-rules",
        "--sandbox",
        "read-only",
        "--skip-git-repo-check",
        "--color",
        "never",
        "--model",
        "gpt-5.6-sol",
        "--config",
        'model_reasoning_effort="high"',
        "--cd",
        repositoryRoot,
        "--output-schema",
        schemaPath,
        "--output-last-message",
        outputPath,
        prompt,
      ],
      { cwd: repositoryRoot, stdio: "ignore", timeout: 45 * 60 * 1000 },
    );
    if (child.error || child.status !== 0) throw new Error("research failed");
    const file = lstatSync(outputPath);
    if (!file.isFile() || file.size > 256 * 1024)
      throw new Error("invalid output");
    return researchSchema.parse(JSON.parse(readFileSync(outputPath, "utf8")));
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

function ensurePrivateDirectory(path: string): void {
  try {
    mkdirSync(path, { mode: 0o700 });
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST"))
      throw error;
  }
  const stat = lstatSync(path);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    (stat.mode & 0o077) !== 0 ||
    (process.getuid && stat.uid !== process.getuid())
  )
    throw new Error("unsafe state directory");
}

function readPrivateFile(path: string): string | null {
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
      stat.size > 256 * 1024
    )
      throw new Error("unsafe state file");
    return readFileSync(fd, "utf8");
  } finally {
    closeSync(fd);
  }
}

function removePendingBody(path: string): void {
  try {
    unlinkSync(path);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
      throw error;
  }
}

function publishPrivateFile(
  directory: string,
  path: string,
  content: string,
): void {
  const temporary = join(directory, `.${randomUUID()}.tmp`);
  try {
    writeFileSync(temporary, content, { mode: 0o600, flag: "wx" });
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

export async function runFacebookDiscovery(input: Options): Promise<Report> {
  const fail = (
    reason: Extract<Report, { ok: false }>["reason"],
    httpStatus: number | null = null,
    attempts = 0,
  ): Report => ({ ok: false, reason, httpStatus, attempts });
  const date = input.now ?? new Date();
  const runId = buildFacebookRunId(date);
  const bodyPath = join(input.stateDirectory, `${runId}.json`);
  const receiptPath = join(input.stateDirectory, `${runId}.receipt.json`);
  let body: string;
  let count: number;
  try {
    ensurePrivateDirectory(input.stateDirectory);
    const receipt = readPrivateFile(receiptPath);
    if (receipt !== null) {
      const result = resultSchema.parse(JSON.parse(receipt));
      removePendingBody(bodyPath);
      return { ok: true, ...result, attempts: 0 };
    }
    let stored = readPrivateFile(bodyPath);
    if (stored === null) {
      let research: Research;
      try {
        research = researchSchema.parse(
          (
            input.research ??
            (() => researchPublicDestinations(input.repositoryRoot))
          )(),
        );
      } catch {
        return fail("research_failed");
      }
      if (!research.succeeded) return fail("research_failed");
      const batch = facebookDiscoveryBatchSchema.parse({
        version: 1,
        purpose: "facebook_public_discovery",
        externalRunId: runId,
        observedAt: date.toISOString(),
        observations: research.observations,
      });
      publishPrivateFile(input.stateDirectory, bodyPath, JSON.stringify(batch));
      const completed = readPrivateFile(receiptPath);
      if (completed !== null) {
        const result = resultSchema.parse(JSON.parse(completed));
        removePendingBody(bodyPath);
        return { ok: true, ...result, attempts: 0 };
      }
      stored = readPrivateFile(bodyPath);
    }
    if (stored === null) throw new Error("missing state");
    const parsed = facebookDiscoveryBatchSchema.parse(JSON.parse(stored));
    if (parsed.externalRunId !== runId) throw new Error("incorrect state");
    body = stored;
    count = parsed.observations.length;
  } catch {
    return fail("local_setup_failed");
  }
  let secret: string;
  try {
    secret = input.secret();
  } catch {
    return fail("local_setup_failed");
  }
  if (secret.trim().length < 32) return fail("invalid_credential");
  const request = input.request ?? fetch;
  const wait = input.wait ?? delay;
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (attempt > 1) await wait(attempt === 2 ? 30_000 : 120_000);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${body}`)
      .digest("hex");
    let response: Response;
    try {
      response = await request(endpoint, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(60_000),
        headers: {
          "Content-Type": "application/json",
          "X-FSS-Key-Id": "weekday-agent-v1",
          "X-FSS-Timestamp": timestamp,
          "X-FSS-Signature": signature,
        },
        body,
      });
    } catch {
      if (attempt < 3) continue;
      return fail("transport_error", null, attempt);
    }
    if (!response.ok) {
      if ((response.status === 429 || response.status >= 500) && attempt < 3)
        continue;
      return fail("http_error", response.status, attempt);
    }
    try {
      const result = resultSchema.parse(await response.json());
      if (result.count !== count) throw new Error("inconsistent count");
      publishPrivateFile(
        input.stateDirectory,
        receiptPath,
        JSON.stringify(result),
      );
      removePendingBody(bodyPath);
      return { ok: true, ...result, attempts: attempt };
    } catch {
      return fail("invalid_response", response.status, attempt);
    }
  }
  return fail("transport_error", null, 3);
}
