import { resolveSiteUrl } from "@/lib/config/site-url";
import {
  readGrowthServerEnv,
  requireGmailOAuthEnv,
} from "@/lib/growth/config/env";
import { createApiErrorResponse } from "@/lib/growth/http/api-error";
import { parseTokenEncryptionKey } from "@/lib/growth/integrations/token-crypto";
import type { MessageActionRouteConfig } from "@/lib/growth/sequences/message-action-route";

export function readMessageActionRouteConfig(): MessageActionRouteConfig {
  const url = new URL(resolveSiteUrl());
  return { origin: url.origin };
}

export function readGmailDraftRouteExtras(): {
  gmailClientId: string;
  gmailClientSecret: string;
  decryptionKeys: Record<string, Buffer>;
} {
  const environment = readGrowthServerEnv();
  const gmailEnvironment = requireGmailOAuthEnv(environment);

  return {
    gmailClientId: gmailEnvironment.clientId,
    gmailClientSecret: gmailEnvironment.clientSecret,
    decryptionKeys: {
      v1: parseTokenEncryptionKey(gmailEnvironment.tokenEncryptionKey),
    },
  };
}

export function messageActionRouteUnavailable(
  operation: string,
  error: unknown,
  correlationId: string,
): Response {
  console.error(`Growth OS message action route unavailable: ${operation}.`, {
    correlationId,
    errorName: error instanceof Error ? error.name : "UnknownError",
  });

  return createApiErrorResponse(
    503,
    "MESSAGE_ACTION_UNAVAILABLE",
    "This action is temporarily unavailable.",
    correlationId,
  );
}
