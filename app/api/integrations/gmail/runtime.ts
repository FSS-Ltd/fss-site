import {
  type GrowthServerEnv,
  readGrowthServerEnv,
  requireGmailOAuthEnv,
} from "@/lib/growth/config/env";
import { resolveSiteUrl } from "@/lib/config/site-url";
import { createApiErrorResponse } from "@/lib/growth/http/api-error";
import type { GmailDisconnectRouteConfig } from "@/lib/growth/integrations/gmail-disconnect-route-handler";
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

export function createGmailDisconnectRouteConfig(
  environment: GrowthServerEnv,
  siteUrl: string,
): GmailDisconnectRouteConfig {
  const url = new URL(siteUrl);
  const isSecure = url.protocol === "https:";
  const isLoopbackHttp =
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (!isSecure && !isLoopbackHttp) {
    throw new Error("Gmail disconnect origin must use HTTPS or loopback HTTP.");
  }
  if (url.username || url.password) {
    throw new Error("Gmail disconnect origin must not contain credentials.");
  }

  return {
    origin: url.origin,
    subjectEmail: environment.ownerEmail,
    encryptionKey: parseTokenEncryptionKey(environment.tokenEncryptionKey),
  };
}

export function readGmailDisconnectRouteConfig(): GmailDisconnectRouteConfig {
  return createGmailDisconnectRouteConfig(
    readGrowthServerEnv(),
    resolveSiteUrl(),
  );
}

export function gmailRouteUnavailable(
  operation: "connect" | "callback" | "disconnect",
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
