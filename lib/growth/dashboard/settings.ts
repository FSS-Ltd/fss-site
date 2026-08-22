import { randomUUID } from "node:crypto";

import cronConfig from "@/vercel.json";

import { readGrowthServerEnv } from "../config/env";
import { getGrowthDb } from "../db/client";
import type { GrowthQueryExecutor } from "../db/types";

const CRON_LABELS: Record<string, string> = {
  "/api/cron/gmail-sync": "Gmail reply sync",
  "/api/cron/outreach-dispatch": "Outreach email dispatch",
  "/api/cron/resend-dispatch": "Newsletter dispatch",
  "/api/cron/maintenance": "Maintenance report",
};

const EVERY_N_MINUTES_PATTERN = /^\*\/(\d+) \* \* \* \*$/;

/** Only supports the "every N minutes" schedules this project actually uses
 * in vercel.json. Returns null for any schedule shape it can't compute. */
export function computeNextCronRun(schedule: string, now: Date): Date | null {
  const match = EVERY_N_MINUTES_PATTERN.exec(schedule);
  if (!match) return null;

  const intervalMinutes = Number(match[1]);
  if (!Number.isInteger(intervalMinutes) || intervalMinutes <= 0) return null;

  const next = new Date(now);
  next.setSeconds(0, 0);
  const currentMinutes = next.getMinutes();
  const minutesToAdd = intervalMinutes - (currentMinutes % intervalMinutes);
  next.setMinutes(currentMinutes + minutesToAdd);
  return next;
}

function describeSchedule(schedule: string): string {
  const match = EVERY_N_MINUTES_PATTERN.exec(schedule);
  if (!match) return schedule;
  const minutes = match[1];
  return minutes === "1" ? "Every minute" : `Every ${minutes} minutes`;
}

export type GmailConnectionStatus =
  | "disconnected"
  | "connected"
  | "degraded"
  | "error"
  | "revoked";

export type GmailIntegrationSummary = {
  configured: boolean;
  status: GmailConnectionStatus;
  accountIdentity: string | null;
  grantedScopes: readonly string[];
  lastSuccessAt: string | null;
  lastErrorCode: string | null;
};

export type ResendIntegrationSummary = {
  configured: boolean;
  fromEmail: string | null;
  replyToEmail: string | null;
};

export type CronJobSummary = {
  path: string;
  label: string;
  scheduleDescription: string;
  nextRunAt: string | null;
};

export type AutomationSummary = {
  automationsEnabled: boolean;
  activeSequenceCount: number;
  crons: readonly CronJobSummary[];
};

export type SettingsData = {
  databaseAvailable: boolean;
  gmail: GmailIntegrationSummary;
  resend: ResendIntegrationSummary;
  vercelBlobConfigured: boolean;
  codexConfigured: boolean;
  automation: AutomationSummary;
  checkedAt: string;
};

export type SettingsResult =
  | { status: "ready"; data: SettingsData }
  | { status: "error"; message: string; correlationId: string };

export type GmailConnectionRow = {
  status: GmailConnectionStatus;
  grantedScopes: readonly string[];
  lastSyncedAt: Date | null;
  lastErrorCode: string | null;
};

export type BuildSettingsViewInput = {
  now: Date;
  databaseAvailable: boolean;
  automationsEnabled: boolean;
  gmailConfigured: boolean;
  gmailConnection: GmailConnectionRow | null;
  ownerEmail: string;
  resendConfigured: boolean;
  resendFromEmail: string | null;
  resendReplyToEmail: string | null;
  vercelBlobConfigured: boolean;
  activeSequenceCount: number;
};

/** Pure redaction/assembly core: never receives a raw token, secret,
 * connection string, provider error message, or recipient data — only the
 * already-safe fields callers pass in. */
export function buildSettingsView(input: BuildSettingsViewInput): SettingsData {
  const crons: CronJobSummary[] = cronConfig.crons.map((job) => ({
    path: job.path,
    label: CRON_LABELS[job.path] ?? job.path,
    scheduleDescription: describeSchedule(job.schedule),
    nextRunAt: input.automationsEnabled
      ? (computeNextCronRun(job.schedule, input.now)?.toISOString() ?? null)
      : null,
  }));

  const gmailConnected =
    input.gmailConnection !== null &&
    input.gmailConnection.status !== "disconnected" &&
    input.gmailConnection.status !== "revoked";

  return {
    databaseAvailable: input.databaseAvailable,
    gmail: {
      configured: input.gmailConfigured,
      status: input.gmailConnection?.status ?? "disconnected",
      accountIdentity: gmailConnected ? input.ownerEmail : null,
      grantedScopes: input.gmailConnection?.grantedScopes ?? [],
      lastSuccessAt: input.gmailConnection?.lastSyncedAt?.toISOString() ?? null,
      lastErrorCode: input.gmailConnection?.lastErrorCode ?? null,
    },
    resend: {
      configured: input.resendConfigured,
      fromEmail: input.resendFromEmail,
      replyToEmail: input.resendReplyToEmail,
    },
    vercelBlobConfigured: input.vercelBlobConfigured,
    codexConfigured: false,
    automation: {
      automationsEnabled: input.automationsEnabled,
      activeSequenceCount: input.activeSequenceCount,
      crons,
    },
    checkedAt: input.now.toISOString(),
  };
}

async function fetchGmailConnection(
  db: GrowthQueryExecutor,
  ownerEmail: string,
): Promise<GmailConnectionRow | null> {
  const rows = await db<GmailConnectionRow[]>`
    select
      status,
      granted_scopes as "grantedScopes",
      last_synced_at as "lastSyncedAt",
      last_error_code as "lastErrorCode"
    from growth.integration_connections
    where provider = 'gmail' and subject_email = ${ownerEmail}
  `;
  return rows[0] ?? null;
}

async function fetchActiveSequenceCount(db: GrowthQueryExecutor): Promise<number> {
  const rows = await db<{ count: string }[]>`
    select count(*)::text as count
    from growth.sequence_enrollments
    where status = 'active'
  `;
  return Number(rows[0]?.count ?? 0);
}

export async function getSettings(
  db: GrowthQueryExecutor = getGrowthDb(),
  createCorrelationId: () => string = () => randomUUID(),
): Promise<SettingsResult> {
  try {
    const env = readGrowthServerEnv();
    const now = new Date();

    let databaseAvailable = true;
    let gmailConnection: GmailConnectionRow | null = null;
    let activeSequenceCount = 0;

    try {
      [gmailConnection, activeSequenceCount] = await Promise.all([
        fetchGmailConnection(db, env.ownerEmail),
        fetchActiveSequenceCount(db),
      ]);
    } catch {
      databaseAvailable = false;
    }

    return {
      status: "ready",
      data: buildSettingsView({
        now,
        databaseAvailable,
        automationsEnabled: env.automationsEnabled,
        gmailConfigured: Boolean(
          env.googleGmailClientId &&
            env.googleGmailClientSecret &&
            env.googleGmailRedirectUri,
        ),
        gmailConnection,
        ownerEmail: env.ownerEmail,
        resendConfigured: Boolean(
          env.resendApiKey && env.resendFromEmail && env.resendReplyToEmail,
        ),
        resendFromEmail: env.resendFromEmail ?? null,
        resendReplyToEmail: env.resendReplyToEmail ?? null,
        vercelBlobConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
        activeSequenceCount,
      }),
    };
  } catch {
    return {
      status: "error",
      message: "Settings could not load.",
      correlationId: createCorrelationId(),
    };
  }
}
