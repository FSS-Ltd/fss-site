import { randomUUID } from "node:crypto";

import { z } from "zod";

import { requireFounder } from "@/lib/growth/auth/require-founder";
import { getGrowthDb } from "@/lib/growth/db/client";
import { createFounderActionHandler } from "@/lib/growth/settings/pause-automations-route-handler";
import { pauseAllActiveAutomations } from "@/lib/growth/settings/pause-automations";

import { messageActionRouteUnavailable, readMessageActionRouteConfig } from "../../runtime";

export const runtime = "nodejs";

const bodySchema = z.object({});

export async function POST(request: Request): Promise<Response> {
  try {
    const db = getGrowthDb();

    const handler = createFounderActionHandler({
      config: readMessageActionRouteConfig(),
      authorizeFounder: requireFounder,
      bodySchema,
      createCorrelationId: randomUUID,
      reportUnexpectedError: ({ correlationId, error }) => {
        console.error("Growth OS pause-automations action failed.", {
          correlationId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
      },
      action: ({ founder, correlationId }) =>
        pauseAllActiveAutomations(db, { founder, correlationId }),
      mapActionError: () => null,
    });

    return handler(request);
  } catch (error) {
    return messageActionRouteUnavailable(
      "pause-automations",
      error,
      randomUUID(),
    );
  }
}
