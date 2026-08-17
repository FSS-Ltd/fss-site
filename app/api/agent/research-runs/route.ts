import { randomUUID } from "node:crypto";

import { readGrowthServerEnv } from "@/lib/growth/config/env";
import { getGrowthDb } from "@/lib/growth/db/client";
import { verifyAgentRequest } from "@/lib/growth/integrations/agent-signature";
import { ingestResearchRun } from "@/lib/growth/research/ingest";
import { createResearchRunPostHandler } from "@/lib/growth/research/route-handler";

export const runtime = "nodejs";

const AGENT_KEY_ID = "weekday-agent-v1";

export async function POST(request: Request): Promise<Response> {
  const environment = readGrowthServerEnv();
  const db = getGrowthDb();
  const handler = createResearchRunPostHandler({
    agentKeyId: AGENT_KEY_ID,
    agentHmacSecret: environment.agentHmacSecret ?? "",
    createCorrelationId: randomUUID,
    now: () => new Date(),
    verifyRequest: verifyAgentRequest,
    ingest: (input) => ingestResearchRun(db, input),
    reportUnexpectedError: ({ correlationId, error }) => {
      console.error("Growth OS research ingestion failed.", {
        correlationId,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    },
  });

  return handler(request);
}
