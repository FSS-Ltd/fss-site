import { readGrowthServerEnv } from "@/lib/growth/config/env";
import {
  FounderAuthorizationError,
  requireFounder,
  type FounderSession,
} from "@/lib/growth/auth/require-founder";
import { getGrowthDb } from "@/lib/growth/db/client";
import { listIntegrationConnectionHealth } from "@/lib/growth/db/repositories/integration-connections";
import { buildHealthReport, type GrowthReleaseHealth } from "@/lib/growth/health/checks";

export const runtime = "nodejs";

const CRON_STALE_AFTER_MINUTES = 30;
// Codex research runs on its own external weekday schedule (see the
// release plan's Global Constraints) — wide enough to absorb a weekend.
const CODEX_STALE_AFTER_HOURS = 96;

export type HealthRouteDependencies = {
  authorizeFounder: () => Promise<FounderSession>;
  buildReport: () => Promise<GrowthReleaseHealth>;
  reportUnexpectedError?: (error: unknown) => void;
};

export function createHealthRouteHandler(
  dependencies: HealthRouteDependencies,
): (request: Request) => Promise<Response> {
  return async () => {
    try {
      await dependencies.authorizeFounder();
    } catch (error) {
      if (error instanceof FounderAuthorizationError) {
        return Response.json(
          { ok: false, code: "unauthorized" },
          { status: 401, headers: { "cache-control": "no-store" } },
        );
      }
      throw error;
    }

    try {
      const report = await dependencies.buildReport();
      return Response.json(
        { ok: true, report },
        { status: 200, headers: { "cache-control": "no-store" } },
      );
    } catch (error) {
      dependencies.reportUnexpectedError?.(error);
      return Response.json(
        { ok: false, code: "internal_error" },
        { status: 500, headers: { "cache-control": "no-store" } },
      );
    }
  };
}

async function getGrowthReleaseHealth(): Promise<GrowthReleaseHealth> {
  const env = readGrowthServerEnv();
  const now = new Date();

  let databaseAvailable = true;
  let gmailConnected = false;
  let cronLastSyncedAt: Date | null = null;
  let codexLastRunAt: Date | null = null;

  try {
    const db = getGrowthDb();
    const [connections, researchRuns] = await Promise.all([
      listIntegrationConnectionHealth(db, env.ownerEmail),
      db<Array<{ completedAt: Date | null }>>`
        select max(completed_at) as "completedAt"
        from growth.research_runs
        where status = 'completed'
      `,
    ]);

    const gmail = connections.find((c) => c.provider === "gmail");
    gmailConnected = gmail?.status === "connected" || gmail?.status === "degraded";
    cronLastSyncedAt = gmail?.lastSyncedAt ?? null;
    codexLastRunAt = researchRuns[0]?.completedAt ?? null;
  } catch {
    databaseAvailable = false;
  }

  return buildHealthReport({
    now,
    databaseAvailable,
    // Runtime request handling is not the place to diff on-disk migration
    // files against the applied schema version — see
    // scripts/verify-growth-release.ts for that check.
    migrationStatus: "unknown",
    automationsEnabled: env.automationsEnabled,
    gmailConfigured: Boolean(
      env.googleGmailClientId && env.googleGmailClientSecret && env.googleGmailRedirectUri,
    ),
    gmailConnected,
    resendConfigured: Boolean(
      env.resendApiKey && env.resendFromEmail && env.resendReplyToEmail,
    ),
    blobConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    codexConfigured: Boolean(env.agentHmacSecret),
    cronLastSyncedAt,
    cronStaleAfterMinutes: CRON_STALE_AFTER_MINUTES,
    codexLastRunAt,
    codexStaleAfterHours: CODEX_STALE_AFTER_HOURS,
  });
}

export async function GET(request: Request): Promise<Response> {
  const handler = createHealthRouteHandler({
    authorizeFounder: requireFounder,
    buildReport: getGrowthReleaseHealth,
    reportUnexpectedError: (error) => {
      console.error("Growth OS health route failed.", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    },
  });

  return handler(request);
}
