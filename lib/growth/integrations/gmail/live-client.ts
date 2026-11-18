import {
  getConnectedGmailCredential,
  type StoredGmailCredential,
} from "../../db/repositories/integration-connections";
import type { GrowthQueryExecutor } from "../../db/types";
import { hasRequiredGmailScopes } from "../google-oauth";
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

  return clientFromCredential(credential, config);
}

function clientFromCredential(
  credential: StoredGmailCredential,
  config: LiveGmailClientConfig,
): GmailClient {
  const refreshToken = decryptRefreshToken(
    parseStoredToken(credential),
    config.decryptionKeys,
  );
  return createGmailClient({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    refreshToken,
  });
}

export type GmailGrantBinding = {
  connectionId: string;
  googleSubject: string;
  grantEpoch: number;
  grantedScopes: string[];
};

export type BoundGmailClient = {
  client: GmailClient;
  binding: GmailGrantBinding;
};

export async function createBoundLiveGmailClient(
  db: GrowthQueryExecutor,
  config: LiveGmailClientConfig,
): Promise<BoundGmailClient> {
  const credential = await getConnectedGmailCredential(db, config.subjectEmail);
  if (
    !credential ||
    !credential.connectionId ||
    !credential.googleSubject ||
    !Number.isSafeInteger(credential.grantEpoch) ||
    credential.grantEpoch <= 0 ||
    !Array.isArray(credential.grantedScopes) ||
    !hasRequiredGmailScopes(credential.grantedScopes)
  )
    throw new GmailNotConnectedError();
  return {
    client: clientFromCredential(credential, config),
    binding: {
      connectionId: credential.connectionId,
      googleSubject: credential.googleSubject,
      grantEpoch: credential.grantEpoch,
      grantedScopes: credential.grantedScopes,
    },
  };
}
