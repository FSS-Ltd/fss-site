import { getConnectedGmailCredential } from "../../db/repositories/integration-connections";
import type { GrowthQueryExecutor } from "../../db/types";
import { parseStoredToken } from "../gmail-disconnect";
import { decryptRefreshToken, type TokenDecryptionKeys } from "../token-crypto";
import { createGmailClient } from "./client";
import type { GmailClient } from "./types";

export class GmailNotConnectedError extends Error {
  constructor() {
    super("The founder Gmail connection is not active.");
    this.name = "GmailNotConnectedError";
  }
}

export type LiveGmailClientConfig = {
  clientId: string;
  clientSecret: string;
  subjectEmail: string;
  decryptionKeys: TokenDecryptionKeys;
};

export async function createLiveGmailClient(
  db: GrowthQueryExecutor,
  config: LiveGmailClientConfig,
): Promise<GmailClient> {
  const credential = await getConnectedGmailCredential(db, config.subjectEmail);
  if (!credential) {
    throw new GmailNotConnectedError();
  }

  const encryptedToken = parseStoredToken(credential);
  const refreshToken = decryptRefreshToken(
    encryptedToken,
    config.decryptionKeys,
  );

  return createGmailClient({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    refreshToken,
  });
}
