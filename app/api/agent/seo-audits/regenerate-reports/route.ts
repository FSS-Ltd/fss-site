import { randomUUID } from "node:crypto";

import { readGrowthServerEnv } from "@/lib/growth/config/env";
import { getGrowthDb } from "@/lib/growth/db/client";
import { vercelSeoAuditBlobStorage } from "@/lib/growth/seo-audits/blob";
import { createSeoAuditReportRegenerationHandler } from "@/lib/growth/seo-audits/regeneration-route-handler";

export const runtime = "nodejs";

const AGENT_KEY_ID = "seo-audit-agent-v1";

export async function POST(request: Request): Promise<Response> {
  const environment = readGrowthServerEnv();
  const handler = createSeoAuditReportRegenerationHandler({
    db: getGrowthDb(),
    blobStorage: vercelSeoAuditBlobStorage,
    agentKeyId: AGENT_KEY_ID,
    agentHmacSecret: environment.agentHmacSecret ?? "",
    createCorrelationId: randomUUID,
    now: () => new Date(),
    reportUnexpectedError: ({ correlationId, error }) => {
      console.error("Growth OS SEO audit report regeneration failed.", {
        correlationId,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    },
  });
  return handler(request);
}
