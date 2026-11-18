import { randomUUID } from "node:crypto";
import { readGrowthServerEnv } from "@/lib/growth/config/env";
import { getGrowthDb } from "@/lib/growth/db/client";
import { verifyAgentRequest } from "@/lib/growth/integrations/agent-signature";
import { createFacebookDiscoveryHandler } from "@/lib/growth/facebook/discovery-route-handler";
import { ingestFacebookDiscovery } from "@/lib/growth/facebook/service";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  const environment = readGrowthServerEnv();
  return createFacebookDiscoveryHandler({
    agentKeyId: "weekday-agent-v1",
    agentHmacSecret: environment.agentHmacSecret ?? "",
    now: () => new Date(),
    createCorrelationId: randomUUID,
    verifyRequest: verifyAgentRequest,
    ingest: (batch, principal, correlationId) =>
      ingestFacebookDiscovery(getGrowthDb(), batch, principal, correlationId),
    reportUnexpectedError: ({ correlationId, error }) =>
      console.error("Facebook discovery ingestion failed.", {
        correlationId,
        errorName: error instanceof Error ? error.name : "UnknownError",
      }),
  })(request);
}
