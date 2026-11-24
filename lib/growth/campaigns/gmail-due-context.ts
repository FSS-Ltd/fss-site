import { z } from "zod";
import type { GrowthDb } from "../db/types";
import type { BoundGmailClient } from "../integrations/gmail/live-client";
import { refreshGmailUsage } from "../integrations/gmail/usage-service";
import {
  createGmailReplySync,
  type GmailSyncSummary,
} from "../sequences/gmail-sync";
import { postgresGmailSyncRepository } from "../sequences/gmail-sync-repository";

const contextBrand: unique symbol = Symbol("gmail-due-context");
type Usage = Awaited<ReturnType<typeof refreshGmailUsage>>;
export type GmailDueContext = {
  readonly [contextBrand]: true;
  readonly bound: BoundGmailClient;
  readonly coverageId: string | null;
  readonly usage: Usage;
  readonly syncSummary: Omit<GmailSyncSummary, "coverageId">;
};
export function parseCommittedCoverageId(value: unknown): string | null {
  return z.uuid().nullable().parse(value);
}
export async function observeLiveGmailDueContext(
  db: GrowthDb,
  input: { bound: BoundGmailClient; founderEmail: string },
): Promise<GmailDueContext> {
  const sync = await createGmailReplySync({
    repository: postgresGmailSyncRepository,
    gmailClient: input.bound.client,
    binding: input.bound.binding,
    founderEmail: input.founderEmail,
  })(db);
  const { coverageId: rawCoverageId, ...syncSummary } = sync;
  const coverageId = parseCommittedCoverageId(rawCoverageId);
  const usage = await refreshGmailUsage(db, {
    ...input.bound,
    subjectEmail: input.founderEmail,
  });
  return {
    [contextBrand]: true,
    bound: input.bound,
    coverageId,
    usage,
    syncSummary,
  };
}
