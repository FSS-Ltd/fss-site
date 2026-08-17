import type { GrowthDb } from "../db/types";
import {
  storeConnectedGmailConnection,
  type StoreConnectedGmailConnectionInput,
} from "../db/repositories/integration-connections";
import {
  exchangeGoogleAuthorizationCode,
  fetchGoogleIdentity,
  type GoogleOAuthConfig,
} from "./google-oauth";
import {
  encryptRefreshToken,
  type EncryptedToken,
  type TokenEncryptionConfig,
} from "./token-crypto";

export type GmailConnectionErrorCode =
  | "MISSING_REFRESH_TOKEN"
  | "UNAUTHORIZED_GOOGLE_IDENTITY";

export class GmailConnectionError extends Error {
  constructor(
    public readonly code: GmailConnectionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "GmailConnectionError";
  }
}

export type ConnectGmailInput = {
  authorizationCode: string;
  oauthConfig: GoogleOAuthConfig;
  expectedSubjectEmail: string;
  encryptionKey: Buffer;
  correlationId: string;
  actorId: string;
};

export type ConnectedGmail = {
  connectionId: string;
  subjectEmail: string;
};

export type GmailConnectionDependencies = {
  exchangeAuthorizationCode: typeof exchangeGoogleAuthorizationCode;
  fetchIdentity: typeof fetchGoogleIdentity;
  encryptToken: (
    refreshToken: string,
    config: TokenEncryptionConfig,
  ) => EncryptedToken;
  storeConnection: (
    db: GrowthDb,
    input: StoreConnectedGmailConnectionInput,
  ) => Promise<string>;
  now: () => Date;
};

const defaultDependencies: GmailConnectionDependencies = {
  exchangeAuthorizationCode: exchangeGoogleAuthorizationCode,
  fetchIdentity: fetchGoogleIdentity,
  encryptToken: encryptRefreshToken,
  storeConnection: storeConnectedGmailConnection,
  now: () => new Date(),
};

function requireNonBlank(value: string, label: string): string {
  const normalised = value.trim();
  if (!normalised) {
    throw new TypeError(`${label} must not be blank.`);
  }

  return normalised;
}

function calculateAccessTokenExpiry(now: Date, expiresInSeconds: number): Date {
  const expiresAt = new Date(now.getTime() + expiresInSeconds * 1_000);
  if (!Number.isFinite(expiresAt.getTime())) {
    throw new TypeError("Google access token expiry is invalid.");
  }

  return expiresAt;
}

export async function connectGmail(
  db: GrowthDb,
  input: ConnectGmailInput,
  dependencies: GmailConnectionDependencies = defaultDependencies,
): Promise<ConnectedGmail> {
  const expectedSubjectEmail = requireNonBlank(
    input.expectedSubjectEmail,
    "Expected Gmail subject email",
  ).toLowerCase();
  const correlationId = requireNonBlank(input.correlationId, "Correlation ID");
  const actorId = requireNonBlank(input.actorId, "Actor ID");
  const tokens = await dependencies.exchangeAuthorizationCode(
    input.oauthConfig,
    input.authorizationCode,
  );
  const tokenIssuedAt = dependencies.now();

  if (!tokens.refreshToken) {
    throw new GmailConnectionError(
      "MISSING_REFRESH_TOKEN",
      "Google did not issue a Gmail refresh token.",
    );
  }

  const identity = await dependencies.fetchIdentity(tokens.accessToken);
  const subjectEmail = identity.email.trim().toLowerCase();

  if (!identity.emailVerified || subjectEmail !== expectedSubjectEmail) {
    throw new GmailConnectionError(
      "UNAUTHORIZED_GOOGLE_IDENTITY",
      "The authorised Google account cannot be connected.",
    );
  }

  const encryptedToken = dependencies.encryptToken(tokens.refreshToken, {
    version: "v1",
    key: input.encryptionKey,
  });
  const connectionId = await dependencies.storeConnection(db, {
    subjectEmail,
    encryptedRefreshToken: encryptedToken,
    grantedScopes: tokens.grantedScopes,
    accessTokenExpiresAt: calculateAccessTokenExpiry(
      tokenIssuedAt,
      tokens.expiresInSeconds,
    ),
    correlationId,
    actorId,
  });

  return { connectionId, subjectEmail };
}
