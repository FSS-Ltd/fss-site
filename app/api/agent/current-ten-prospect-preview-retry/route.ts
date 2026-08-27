import { randomUUID } from "node:crypto";

import { readGrowthServerEnv } from "@/lib/growth/config/env";
import { getGrowthDb } from "@/lib/growth/db/client";
import { verifyAgentRequest } from "@/lib/growth/integrations/agent-signature";
import { requeueCurrentTenUnavailablePreviewCompositions } from "@/lib/growth/prospect-previews/composition-repository";
import { createCurrentTenPreviewRetryPostHandler } from "@/lib/growth/prospect-previews/generation/current-ten-retry-route-handler";

export const runtime = "nodejs";

const AGENT_KEY_ID = "weekday-agent-v1";

export async function POST(request: Request): Promise<Response> {
  const environment = readGrowthServerEnv();
  const handler = createCurrentTenPreviewRetryPostHandler({
    agentKeyId: AGENT_KEY_ID,
    agentHmacSecret: environment.agentHmacSecret ?? "",
    enabled: process.env.VERCEL_ENV === "production",
    createCorrelationId: randomUUID,
    now: () => new Date(),
    verifyRequest: verifyAgentRequest,
    run: () => requeueCurrentTenUnavailablePreviewCompositions(getGrowthDb()),
    reportUnexpectedError: ({ correlationId, error }) => {
      console.error("Current-ten prospect preview retry failed.", {
        correlationId,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    },
  });

  return handler(request);
}
