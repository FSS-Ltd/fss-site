import { randomUUID } from "node:crypto";

import { getGrowthDb } from "@/lib/growth/db/client";
import { createSeoAuditApprovalHandler } from "@/lib/growth/seo-audits/approval-route-handler";

import {
  messageActionRouteUnavailable,
  readMessageActionRouteConfig,
} from "../../../runtime";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const handler = createSeoAuditApprovalHandler({
      db: getGrowthDb(),
      config: readMessageActionRouteConfig(),
      createCorrelationId: randomUUID,
      reportUnexpectedError: ({ correlationId, error }) => {
        console.error("Growth OS SEO audit approval failed.", {
          correlationId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
      },
    });
    return handler(request, context);
  } catch (error) {
    return messageActionRouteUnavailable(
      "seo-audit-approve",
      error,
      randomUUID(),
    );
  }
}
