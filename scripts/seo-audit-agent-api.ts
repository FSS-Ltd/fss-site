import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

import { z } from "zod";

import { postSignedSeoAuditRequest } from "../lib/growth/seo-audits/local-agent-client";

const MAX_REQUEST_BYTES = 128 * 1024;
const CLAIM_LEDGER_PATH_ENV = "GROWTH_OS_SEO_AUDIT_CLAIM_LEDGER_PATH";
const uuidSchema = z.string().uuid();
const claimResponseSchema = z
  .object({
    ok: z.literal(true),
    candidates: z.array(z.object({ auditId: uuidSchema }).passthrough()),
  })
  .passthrough();
const releaseResponseSchema = z
  .object({
    ok: z.literal(true),
    releasedCount: z.number().int().nonnegative(),
  })
  .passthrough();
const ledgerSchema = z
  .object({ auditIds: z.array(uuidSchema).max(5) })
  .strict();

function readAgentSecret(): string {
  const secret = execFileSync(
    "/usr/bin/security",
    [
      "find-generic-password",
      "-s",
      "dev.faithfulsoftware.growth-os.agent-hmac",
      "-a",
      "growth-os-daily-seo-audit",
      "-w",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  ).trim();
  if (secret.replace(/\s/g, "").length < 32) {
    throw new Error("SEO audit signing secret is invalid.");
  }
  return secret;
}

function writeResult(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function writeClaimLedger(auditIds: readonly string[]): void {
  const path = process.env[CLAIM_LEDGER_PATH_ENV];
  if (!path) return;
  writeFileSync(path, JSON.stringify({ auditIds }), { mode: 0o600 });
}

function readClaimLedger(path: string): readonly string[] {
  return ledgerSchema.parse(JSON.parse(readFileSync(path, "utf8")) as unknown)
    .auditIds;
}

async function post(
  path: Parameters<typeof postSignedSeoAuditRequest>[0]["path"],
  rawBody: Buffer,
): Promise<unknown> {
  if (rawBody.byteLength > MAX_REQUEST_BYTES) {
    throw new Error("SEO audit request is too large.");
  }
  const response = await postSignedSeoAuditRequest({
    path,
    secret: readAgentSecret(),
    rawBody,
  });
  if (!response.ok) {
    writeResult({ ok: false, status: response.status });
    process.exitCode = 1;
    return null;
  }
  return response.json() as Promise<unknown>;
}

async function claim(): Promise<void> {
  const response = await post(
    "/api/agent/seo-audits/claim",
    Buffer.from('{"limit":3}', "utf8"),
  );
  if (response === null) return;

  const parsed = claimResponseSchema.parse(response);
  writeClaimLedger(parsed.candidates.map((candidate) => candidate.auditId));
  writeResult(parsed);
}

async function submit(filePath: string | undefined): Promise<void> {
  if (!filePath) throw new Error("SEO audit submission file is required.");
  const response = await post("/api/agent/seo-audits", readFileSync(filePath));
  if (response !== null) writeResult(response);
}

async function release(ledgerPath: string | undefined): Promise<void> {
  if (!ledgerPath) throw new Error("SEO audit claim ledger is required.");
  const auditIds = readClaimLedger(ledgerPath);
  if (auditIds.length === 0) {
    writeResult({ ok: true, releasedCount: 0 });
    return;
  }

  const response = await post(
    "/api/agent/seo-audits/release",
    Buffer.from(JSON.stringify({ auditIds }), "utf8"),
  );
  if (response === null) return;
  writeResult(releaseResponseSchema.parse(response));
}

async function main(): Promise<void> {
  const [command, argument] = process.argv.slice(2);
  if (command === "claim") return claim();
  if (command === "submit") return submit(argument);
  if (command === "release") return release(argument);
  throw new Error("SEO audit agent command is invalid.");
}

void main().catch(() => {
  process.stderr.write("SEO audit agent API request failed.\n");
  process.exitCode = 1;
});
