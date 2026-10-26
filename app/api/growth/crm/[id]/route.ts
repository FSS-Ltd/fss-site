import { randomUUID } from "node:crypto";
import { getGrowthDb } from "@/lib/growth/db/client";
import { createCrmCommandHandler } from "@/lib/growth/crm/route-handler";
import {
  messageActionRouteUnavailable,
  readMessageActionRouteConfig,
} from "../../runtime";

export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    return await createCrmCommandHandler({
      db: getGrowthDb(),
      config: readMessageActionRouteConfig(),
      createCorrelationId: randomUUID,
      reportUnexpectedError: ({ correlationId, error }) => {
        console.error("Growth CRM command failed.", {
          correlationId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
      },
    })(request, context);
  } catch (error) {
    return messageActionRouteUnavailable("crm", error, randomUUID());
  }
}
