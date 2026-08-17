import { randomUUID } from "node:crypto";

import type { NextRequest } from "next/server";

import { requireFounder } from "@/lib/growth/auth/require-founder";
import {
  createGmailConnectHandler,
  type GmailConnectRouteDependencies,
} from "@/lib/growth/integrations/gmail-oauth-route-handler";
import {
  buildGoogleAuthorizationUrl,
  generateGoogleOAuthState,
} from "@/lib/growth/integrations/google-oauth";

import { gmailRouteUnavailable, readGmailOAuthRouteConfig } from "../runtime";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const dependencies: GmailConnectRouteDependencies = {
      config: readGmailOAuthRouteConfig(),
      authorizeFounder: requireFounder,
      generateState: generateGoogleOAuthState,
      buildAuthorizationUrl: buildGoogleAuthorizationUrl,
      createCorrelationId: randomUUID,
      reportUnexpectedError: ({ correlationId, error }) => {
        console.error("Growth OS Gmail OAuth connect failed.", {
          correlationId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
      },
    };

    return createGmailConnectHandler(dependencies)(request);
  } catch (error) {
    return gmailRouteUnavailable("connect", error, randomUUID());
  }
}
