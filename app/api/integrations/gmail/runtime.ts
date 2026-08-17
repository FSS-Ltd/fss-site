import {
  readGrowthServerEnv,
  requireGmailOAuthEnv,
} from "@/lib/growth/config/env";
import { createApiErrorResponse } from "@/lib/growth/http/api-error";
import type { GmailOAuthRouteConfig } from "@/lib/growth/integrations/gmail-oauth-route-handler";
import { parseTokenEncryptionKey } from "@/lib/growth/integrations/token-crypto";

export function readGmailOAuthRouteConfig(): GmailOAuthRouteConfig {
  const environment = readGrowthServerEnv();
  const gmailEnvironment = requireGmailOAuthEnv(environment);

  return {
    oauthConfig: {
      clientId: gmailEnvironment.clientId,
      clientSecret: gmailEnvironment.clientSecret,
      redirectUri: gmailEnvironment.redirectUri,
    },
    expectedSubjectEmail: environment.ownerEmail,
    encryptionKey: parseTokenEncryptionKey(gmailEnvironment.tokenEncryptionKey),
  };
}

export function gmailRouteUnavailable(
  operation: "connect" | "callback",
  error: unknown,
  correlationId: string,
): Response {
  console.error(`Growth OS Gmail OAuth ${operation} route unavailable.`, {
    correlationId,
    errorName: error instanceof Error ? error.name : "UnknownError",
  });

  return createApiErrorResponse(
    503,
    "GMAIL_OAUTH_UNAVAILABLE",
    "The Gmail connection is temporarily unavailable.",
    correlationId,
  );
}
