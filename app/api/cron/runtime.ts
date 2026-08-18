import {
  readGrowthServerEnv,
  requireGmailOAuthEnv,
  type GrowthServerEnv,
} from "@/lib/growth/config/env";
import type { GrowthDb } from "@/lib/growth/db/types";
import { createLiveGmailClient } from "@/lib/growth/integrations/gmail/live-client";
import type { GmailClient } from "@/lib/growth/integrations/gmail/types";
import { parseTokenEncryptionKey } from "@/lib/growth/integrations/token-crypto";

export function readCronEnv(): GrowthServerEnv {
  return readGrowthServerEnv();
}

export async function createCronGmailClient(
  db: GrowthDb,
  env: GrowthServerEnv,
): Promise<GmailClient> {
  const gmailEnv = requireGmailOAuthEnv(env);
  return createLiveGmailClient(db, {
    clientId: gmailEnv.clientId,
    clientSecret: gmailEnv.clientSecret,
    subjectEmail: env.ownerEmail,
    decryptionKeys: {
      v1: parseTokenEncryptionKey(gmailEnv.tokenEncryptionKey),
    },
  });
}
