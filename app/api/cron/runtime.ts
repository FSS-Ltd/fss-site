import {
  readGrowthServerEnv,
  requireGmailOAuthEnv,
  type GrowthServerEnv,
} from "@/lib/growth/config/env";
import type { GrowthDb } from "@/lib/growth/db/types";
import {
  createBoundLiveGmailClient,
  type BoundGmailClient,
} from "@/lib/growth/integrations/gmail/live-client";
import { parseTokenEncryptionKey } from "@/lib/growth/integrations/token-crypto";

export function readCronEnv(): GrowthServerEnv {
  return readGrowthServerEnv();
}

export async function createCronGmailClient(
  db: GrowthDb,
  env: GrowthServerEnv,
): Promise<BoundGmailClient> {
  const gmailEnv = requireGmailOAuthEnv(env);
  return createBoundLiveGmailClient(db, {
    clientId: gmailEnv.clientId,
    clientSecret: gmailEnv.clientSecret,
    subjectEmail: env.ownerEmail,
    decryptionKeys: {
      v1: parseTokenEncryptionKey(gmailEnv.tokenEncryptionKey),
    },
  });
}
