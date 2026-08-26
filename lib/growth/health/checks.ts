export type MigrationStatus = "current" | "mismatched" | "unknown";
export type ProviderConfigStatus = "configured" | "not_configured";

export type HealthCheckInput = {
  now: Date;
  databaseAvailable: boolean;
  migrationStatus: MigrationStatus;
  automationsEnabled: boolean;
  gmailConfigured: boolean;
  gmailConnected: boolean;
  resendConfigured: boolean;
  blobConfigured: boolean;
  codexConfigured: boolean;
  cronLastSyncedAt: Date | null;
  cronStaleAfterMinutes: number;
  codexLastRunAt: Date | null;
  codexStaleAfterHours: number;
};

export type ApplicationHealth = {
  status: "healthy" | "unavailable";
  reasons: readonly string[];
};

export type DependencyReadiness = {
  status: "ready" | "attention";
  gmail: ProviderConfigStatus;
  resend: ProviderConfigStatus;
  blob: ProviderConfigStatus;
  codex: ProviderConfigStatus;
  migrations: MigrationStatus;
  reasons: readonly string[];
};

export type AutomationReadiness = {
  status: "enabled" | "disabled" | "blocked";
  reasons: readonly string[];
};

export type GrowthReleaseHealth = {
  checkedAt: string;
  application: ApplicationHealth;
  dependencies: DependencyReadiness;
  automation: AutomationReadiness;
};

function isStale(
  lastAt: Date | null,
  now: Date,
  staleAfterMs: number,
): boolean {
  if (lastAt === null) return true;
  return now.getTime() - lastAt.getTime() > staleAfterMs;
}

/** Pure classification core: never receives a raw secret, connection
 * string, provider response body, or recipient address — only the
 * already-safe booleans, enums, and timestamps callers pass in. */
export function buildHealthReport(input: HealthCheckInput): GrowthReleaseHealth {
  const applicationReasons: string[] = [];
  if (!input.databaseAvailable) applicationReasons.push("database_unavailable");
  if (input.migrationStatus === "mismatched") {
    applicationReasons.push("migration_mismatch");
  }
  const application: ApplicationHealth = {
    status: applicationReasons.length === 0 ? "healthy" : "unavailable",
    reasons: applicationReasons,
  };

  const dependencyReasons: string[] = [];
  if (!input.gmailConfigured) dependencyReasons.push("gmail_not_configured");
  if (!input.resendConfigured) dependencyReasons.push("resend_not_configured");
  if (!input.blobConfigured) dependencyReasons.push("blob_not_configured");
  if (!input.codexConfigured) dependencyReasons.push("codex_not_configured");
  const dependencies: DependencyReadiness = {
    status: dependencyReasons.length === 0 ? "ready" : "attention",
    gmail: input.gmailConfigured ? "configured" : "not_configured",
    resend: input.resendConfigured ? "configured" : "not_configured",
    blob: input.blobConfigured ? "configured" : "not_configured",
    codex: input.codexConfigured ? "configured" : "not_configured",
    migrations: input.migrationStatus,
    reasons: dependencyReasons,
  };

  const automationReasons: string[] = [];
  let automationStatus: AutomationReadiness["status"] = "disabled";

  if (input.automationsEnabled) {
    if (application.status === "unavailable") {
      automationReasons.push(...applicationReasons);
    }
    if (dependencies.status === "attention") {
      automationReasons.push(...dependencyReasons);
    }
    if (!input.gmailConnected) automationReasons.push("gmail_disconnected");
    if (
      isStale(
        input.cronLastSyncedAt,
        input.now,
        input.cronStaleAfterMinutes * 60 * 1000,
      )
    ) {
      automationReasons.push("cron_stale");
    }

    automationStatus = automationReasons.length === 0 ? "enabled" : "blocked";
  }

  // The external research task is independent of the Vercel provider-cron
  // flag. Its freshness remains visible without changing provider-cron status.
  if (
    input.codexConfigured &&
    isStale(
      input.codexLastRunAt,
      input.now,
      input.codexStaleAfterHours * 60 * 60 * 1000,
    )
  ) {
    automationReasons.push("codex_stale");
  }

  return {
    checkedAt: input.now.toISOString(),
    application,
    dependencies,
    automation: { status: automationStatus, reasons: automationReasons },
  };
}
