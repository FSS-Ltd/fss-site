import {
  disconnectStoredGmailConnection,
  type DisconnectStoredGmailConnectionInput,
  type DisconnectStoredGmailConnectionResult,
  type ProviderRevocation,
  type StoredGmailCredential,
} from "../db/repositories/integration-connections";
import type { GrowthDb } from "../db/types";
import { revokeGoogleOAuthToken } from "./google-oauth";
import {
  decryptRefreshToken,
  type StoredEncryptedToken,
  type TokenDecryptionKeys,
} from "./token-crypto";

export type DisconnectGmailInput = {
  subjectEmail: string;
  encryptionKeys: TokenDecryptionKeys;
  correlationId: string;
  actorId: string;
};

export type GmailDisconnectDependencies = {
  decryptToken: typeof decryptRefreshToken;
  revokeToken: typeof revokeGoogleOAuthToken;
  disconnectStoredConnection: (
    db: GrowthDb,
    input: DisconnectStoredGmailConnectionInput,
  ) => Promise<DisconnectStoredGmailConnectionResult>;
};

const defaultDependencies: GmailDisconnectDependencies = {
  decryptToken: decryptRefreshToken,
  revokeToken: revokeGoogleOAuthToken,
  disconnectStoredConnection: disconnectStoredGmailConnection,
};

export function parseStoredToken(
  credential: StoredGmailCredential,
): StoredEncryptedToken {
  let value: unknown;
  try {
    value = JSON.parse(credential.encryptedRefreshToken);
  } catch {
    throw new Error("Stored Gmail refresh token is invalid.");
  }

  if (
    typeof value !== "object" ||
    value === null ||
    !("version" in value) ||
    !("iv" in value) ||
    !("ciphertext" in value) ||
    !("authTag" in value) ||
    typeof value.version !== "string" ||
    typeof value.iv !== "string" ||
    typeof value.ciphertext !== "string" ||
    typeof value.authTag !== "string" ||
    value.version !== credential.encryptionKeyVersion
  ) {
    throw new Error("Stored Gmail refresh token is invalid.");
  }

  return {
    version: value.version,
    iv: value.iv,
    ciphertext: value.ciphertext,
    authTag: value.authTag,
  };
}

export function disconnectGmail(
  db: GrowthDb,
  input: DisconnectGmailInput,
  dependencies: GmailDisconnectDependencies = defaultDependencies,
): Promise<DisconnectStoredGmailConnectionResult> {
  return dependencies.disconnectStoredConnection(db, {
    subjectEmail: input.subjectEmail,
    correlationId: input.correlationId,
    actorId: input.actorId,
    confirmProviderRevocation: async (
      credential,
    ): Promise<Exclude<ProviderRevocation, "not_required">> => {
      try {
        const encryptedToken = parseStoredToken(credential);
        const refreshToken = dependencies.decryptToken(
          encryptedToken,
          input.encryptionKeys,
        );
        return (await dependencies.revokeToken(refreshToken))
          ? "confirmed"
          : "unconfirmed";
      } catch {
        return "unconfirmed";
      }
    },
  });
}
