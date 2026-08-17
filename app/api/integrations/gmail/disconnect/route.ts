import { randomUUID } from "node:crypto";

import type { NextRequest } from "next/server";

import { requireFounder } from "@/lib/growth/auth/require-founder";
import { getGrowthDb } from "@/lib/growth/db/client";
import { disconnectGmail } from "@/lib/growth/integrations/gmail-disconnect";
import {
  createGmailDisconnectHandler,
  type GmailDisconnectRouteDependencies,
} from "@/lib/growth/integrations/gmail-disconnect-route-handler";

import {
  gmailRouteUnavailable,
  readGmailDisconnectRouteConfig,
} from "../runtime";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const config = readGmailDisconnectRouteConfig();
    const db = getGrowthDb();
    const dependencies: GmailDisconnectRouteDependencies = {
      config,
      authorizeFounder: requireFounder,
      disconnect: (input) => disconnectGmail(db, input),
      createCorrelationId: randomUUID,
      reportUnexpectedError: ({ correlationId, error }) => {
        console.error("Growth OS Gmail disconnect failed.", {
          correlationId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
      },
    };

    return createGmailDisconnectHandler(dependencies)(request);
  } catch (error) {
    return gmailRouteUnavailable("disconnect", error, randomUUID());
  }
}
