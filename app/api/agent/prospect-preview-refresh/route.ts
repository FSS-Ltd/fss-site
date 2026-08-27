import { randomUUID } from "node:crypto";

import { readGrowthServerEnv } from "@/lib/growth/config/env";
import { getGrowthDb } from "@/lib/growth/db/client";
import { verifyAgentRequest } from "@/lib/growth/integrations/agent-signature";
import { createProspectPreviewRefreshRepository } from "@/lib/growth/prospect-previews/refresh/repository";
import { createProspectPreviewRefreshPostHandler } from "@/lib/growth/prospect-previews/refresh/route-handler";
import { refreshEvidenceBackedPreviews } from "@/lib/growth/prospect-previews/refresh/service";

export const runtime = "nodejs";

const AGENT_KEY_ID = "weekday-agent-v1";

export async function POST(request: Request): Promise<Response> {
  const environment = readGrowthServerEnv();
  const repository = createProspectPreviewRefreshRepository(getGrowthDb());
  const handler = createProspectPreviewRefreshPostHandler({
    agentKeyId: AGENT_KEY_ID,
    agentHmacSecret: environment.agentHmacSecret ?? "",
    createCorrelationId: randomUUID,
    now: () => new Date(),
    verifyRequest: verifyAgentRequest,
    refresh: (updates) => refreshEvidenceBackedPreviews(updates, repository),
    reportUnexpectedError: ({ correlationId, error }) => {
      console.error("Prospect preview refresh failed.", {
        correlationId,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    },
  });
  return handler(request);
}
