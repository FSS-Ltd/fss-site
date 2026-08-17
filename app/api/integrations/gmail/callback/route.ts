import { randomUUID } from "node:crypto";

import type { NextRequest } from "next/server";

import { requireFounder } from "@/lib/growth/auth/require-founder";
import { getGrowthDb } from "@/lib/growth/db/client";
import { connectGmail } from "@/lib/growth/integrations/gmail-connection";
import {
  createGmailCallbackHandler,
  type GmailCallbackRouteDependencies,
} from "@/lib/growth/integrations/gmail-oauth-route-handler";

import { gmailRouteUnavailable, readGmailOAuthRouteConfig } from "../runtime";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const config = readGmailOAuthRouteConfig();
    const db = getGrowthDb();
    const dependencies: GmailCallbackRouteDependencies = {
      config,
      authorizeFounder: requireFounder,
      connect: (input) => connectGmail(db, input),
      createCorrelationId: randomUUID,
      reportUnexpectedError: ({ correlationId, error }) => {
        console.error("Growth OS Gmail OAuth callback failed.", {
          correlationId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
      },
    };

    return createGmailCallbackHandler(dependencies)(request);
  } catch (error) {
    return gmailRouteUnavailable("callback", error, randomUUID());
  }
}
