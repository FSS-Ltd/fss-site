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
  connections: readonly IntegrationConnectionHealth[];
  databaseAvailable: boolean;
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
  provider: "gmail" | "resend",
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
    message: `${provider === "gmail" ? "Gmail" : "Resend"} ${connectionMessages[status].toLowerCase()}`,
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
  connections,
  databaseAvailable,
}: IntegrationSummaryInput): readonly IntegrationHealth[] {
  const providerHealth = databaseAvailable
    ? [
        connectionHealth("gmail", connections, checkedAt),
        connectionHealth("resend", connections, checkedAt),
      ]
    : [
        health("gmail", "attention", checkedAt, "Gmail status unavailable"),
        health("resend", "attention", checkedAt, "Resend status unavailable"),
      ];

  return [
    health(
      "database",
      databaseAvailable ? "healthy" : "attention",
      checkedAt,
      databaseAvailable ? "Database available" : "Database needs attention",
    ),
    ...providerHealth,
    health("codex", "disabled", checkedAt, "Codex not configured"),
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
  const { automationsEnabled, ownerEmail } = readGrowthServerEnv();
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
    connections,
    databaseAvailable,
  });
}
