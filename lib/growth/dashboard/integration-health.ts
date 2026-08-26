import { readGrowthServerEnv } from "../config/env";
import { getGrowthDb } from "../db/client";
import {
  listIntegrationConnectionHealth,
  type IntegrationConnectionHealth,
  type IntegrationConnectionStatus,
} from "../db/repositories/integration-connections";
import type {
  IntegrationHealth,
  IntegrationProvider,
  IntegrationStatus,
} from "./view-models";

type IntegrationSummaryInput = {
  automationsEnabled: boolean;
  checkedAt: Date;
  codexConfigured: boolean;
  connections: readonly IntegrationConnectionHealth[];
  databaseAvailable: boolean;
  resendConfigured: boolean;
};

const connectionStatusMap: Record<
  IntegrationConnectionStatus,
  IntegrationStatus
> = {
  connected: "healthy",
  degraded: "attention",
  disconnected: "disconnected",
  error: "attention",
  revoked: "disconnected",
};

const connectionMessages: Record<IntegrationStatus, string> = {
  healthy: "Connected",
  attention: "Needs attention",
  disconnected: "Not connected",
  disabled: "Not configured",
};

function connectionHealth(
  provider: "gmail",
  connections: readonly IntegrationConnectionHealth[],
  checkedAt: Date,
): IntegrationHealth {
  const connection = connections.find((item) => item.provider === provider);
  const status = connection
    ? connectionStatusMap[connection.status]
    : "disconnected";

  return {
    provider,
    status,
    checkedAt: (connection?.lastSyncedAt ?? checkedAt).toISOString(),
    message: `Gmail ${connectionMessages[status].toLowerCase()}`,
  };
}

function health(
  provider: IntegrationProvider,
  status: IntegrationStatus,
  checkedAt: Date,
  message: string,
): IntegrationHealth {
  return { provider, status, checkedAt: checkedAt.toISOString(), message };
}

export function buildIntegrationHealthSummary({
  automationsEnabled,
  checkedAt,
  codexConfigured,
  connections,
  databaseAvailable,
  resendConfigured,
}: IntegrationSummaryInput): readonly IntegrationHealth[] {
  const gmailHealth = databaseAvailable
    ? connectionHealth("gmail", connections, checkedAt)
    : health("gmail", "attention", checkedAt, "Gmail status unavailable");
  const resendHealth = health(
    "resend",
    resendConfigured ? "healthy" : "disabled",
    checkedAt,
    resendConfigured ? "Resend configured" : "Resend not configured",
  );

  return [
    health(
      "database",
      databaseAvailable ? "healthy" : "attention",
      checkedAt,
      databaseAvailable ? "Database available" : "Database needs attention",
    ),
    gmailHealth,
    resendHealth,
    health(
      "codex",
      codexConfigured ? "healthy" : "disabled",
      checkedAt,
      codexConfigured
        ? "Signed research ingestion configured"
        : "Signed research ingestion not configured",
    ),
    health(
      "cron",
      automationsEnabled ? "healthy" : "disabled",
      checkedAt,
      automationsEnabled ? "Automations enabled" : "Automations disabled",
    ),
  ];
}

export async function getIntegrationHealthSummary(): Promise<
  readonly IntegrationHealth[]
> {
  const checkedAt = new Date();
  const {
    agentHmacSecret,
    automationsEnabled,
    ownerEmail,
    resendApiKey,
    resendFromEmail,
    resendReplyToEmail,
  } = readGrowthServerEnv();
  let connections: readonly IntegrationConnectionHealth[] = [];
  let databaseAvailable = true;

  try {
    connections = await listIntegrationConnectionHealth(
      getGrowthDb(),
      ownerEmail,
    );
  } catch {
    databaseAvailable = false;
  }

  return buildIntegrationHealthSummary({
    automationsEnabled,
    checkedAt,
    codexConfigured: Boolean(agentHmacSecret),
    connections,
    databaseAvailable,
    resendConfigured: Boolean(
      resendApiKey && resendFromEmail && resendReplyToEmail,
    ),
  });
}
