import { randomUUID } from "node:crypto";

import { readGrowthServerEnv } from "@/lib/growth/config/env";
import { getGrowthDb } from "@/lib/growth/db/client";
import { createSeoAuditClaimHandler } from "@/lib/growth/seo-audits/agent-route-handler";
import { vercelSeoAuditBlobStorage } from "@/lib/growth/seo-audits/blob";

export const runtime = "nodejs";

const AGENT_KEY_ID = "seo-audit-agent-v1";

export async function POST(request: Request): Promise<Response> {
  const environment = readGrowthServerEnv();
  const handler = createSeoAuditClaimHandler({
    db: getGrowthDb(),
    agentKeyId: AGENT_KEY_ID,
    agentHmacSecret: environment.agentHmacSecret ?? "",
    createCorrelationId: randomUUID,
    now: () => new Date(),
    blobStorage: vercelSeoAuditBlobStorage,
    reportUnexpectedError: ({ correlationId, error }) => {
      console.error("Growth OS SEO audit candidate claim failed.", {
        correlationId,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    },
  });
  return handler(request);
}
