import { randomBytes } from "node:crypto";

import { z } from "zod";

const GOOGLE_AUTHORIZATION_ENDPOINT =
  "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT =
  "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_REVOCATION_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const GOOGLE_REQUEST_TIMEOUT_MS = 10_000;

export const GMAIL_AUTOMATION_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.modify",
] as const;

const googleTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  refresh_token: z.string().min(1).optional(),
  scope: z.string().min(1),
  token_type: z.literal("Bearer"),
});

const googleIdentityResponseSchema = z.object({
  sub: z.string().min(1).max(255),
  email: z.string().email(),
  email_verified: z.boolean(),
});

export type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type GoogleOAuthTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresInSeconds: number;
  grantedScopes: string[];
  tokenType: "Bearer";
};

export type GoogleIdentity = {
  subject: string;
  email: string;
  emailVerified: boolean;
};

export type GoogleOAuthErrorCode =
  | "TOKEN_EXCHANGE_FAILED"
  | "INVALID_TOKEN_RESPONSE"
  | "IDENTITY_FETCH_FAILED"
  | "INVALID_IDENTITY_RESPONSE";

export class GoogleOAuthError extends Error {
  constructor(
    public readonly code: GoogleOAuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "GoogleOAuthError";
  }
}

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

function requireNonBlank(value: string, label: string): string {
  if (value.trim().length === 0) {
    throw new Error(`${label} must not be blank.`);
  }

  return value;
}

function validateConfig(config: GoogleOAuthConfig): GoogleOAuthConfig {
  requireNonBlank(config.clientId, "Google OAuth client ID");
  requireNonBlank(config.clientSecret, "Google OAuth client secret");
  requireNonBlank(config.redirectUri, "Google OAuth redirect URI");
  return config;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function generateGoogleOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

export function buildGoogleAuthorizationUrl(
  config: GoogleOAuthConfig,
  state: string,
): string {
  const validatedConfig = validateConfig(config);
  requireNonBlank(state, "OAuth state");

  const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  url.search = new URLSearchParams({
    client_id: validatedConfig.clientId,
    redirect_uri: validatedConfig.redirectUri,
    response_type: "code",
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    scope: GMAIL_AUTOMATION_SCOPES.join(" "),
    state,
  }).toString();

  return url.toString();
}

export async function exchangeGoogleAuthorizationCode(
  config: GoogleOAuthConfig,
  code: string,
  fetchImpl: FetchLike = fetch,
): Promise<GoogleOAuthTokens> {
  const validatedConfig = validateConfig(config);
  requireNonBlank(code, "Authorization code");

  let response: Response;
  try {
    response = await fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: new URLSearchParams({
        client_id: validatedConfig.clientId,
        client_secret: validatedConfig.clientSecret,
        code,
        redirect_uri: validatedConfig.redirectUri,
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    });
  } catch {
    throw new GoogleOAuthError(
      "TOKEN_EXCHANGE_FAILED",
      "Google token exchange failed.",
    );
  }

  if (!response.ok) {
    throw new GoogleOAuthError(
      "TOKEN_EXCHANGE_FAILED",
      "Google token exchange failed.",
    );
  }

  const parsed = googleTokenResponseSchema.safeParse(await readJson(response));
  if (!parsed.success) {
    throw new GoogleOAuthError(
      "INVALID_TOKEN_RESPONSE",
      "Google returned an invalid token response.",
    );
  }

  const grantedScopes = parsed.data.scope.split(/\s+/).filter(Boolean);
  const grantedScopeSet = new Set(grantedScopes);
  if (!GMAIL_AUTOMATION_SCOPES.every((scope) => grantedScopeSet.has(scope))) {
    throw new GoogleOAuthError(
      "INVALID_TOKEN_RESPONSE",
      "Google returned an invalid token response.",
    );
  }

  return {
    accessToken: parsed.data.access_token,
    ...(parsed.data.refresh_token
      ? { refreshToken: parsed.data.refresh_token }
      : {}),
    expiresInSeconds: parsed.data.expires_in,
    grantedScopes,
    tokenType: parsed.data.token_type,
  };
}

export async function fetchGoogleIdentity(
  accessToken: string,
  fetchImpl: FetchLike = fetch,
): Promise<GoogleIdentity> {
  requireNonBlank(accessToken, "Access token");

  let response: Response;
  try {
    response = await fetchImpl(GOOGLE_USERINFO_ENDPOINT, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });
  } catch {
    throw new GoogleOAuthError(
      "IDENTITY_FETCH_FAILED",
      "Google identity lookup failed.",
    );
  }

  if (!response.ok) {
    throw new GoogleOAuthError(
      "IDENTITY_FETCH_FAILED",
      "Google identity lookup failed.",
    );
  }

  const parsed = googleIdentityResponseSchema.safeParse(
    await readJson(response),
  );
  if (!parsed.success) {
    throw new GoogleOAuthError(
      "INVALID_IDENTITY_RESPONSE",
      "Google returned an invalid identity response.",
    );
  }

  return {
    subject: parsed.data.sub,
    email: parsed.data.email,
    emailVerified: parsed.data.email_verified,
  };
}

export async function revokeGoogleOAuthToken(
  refreshToken: string,
  fetchImpl: FetchLike = fetch,
): Promise<boolean> {
  requireNonBlank(refreshToken, "Refresh token");

  try {
    const response = await fetchImpl(GOOGLE_REVOCATION_ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: new URLSearchParams({ token: refreshToken }),
      cache: "no-store",
      signal: AbortSignal.timeout(GOOGLE_REQUEST_TIMEOUT_MS),
    });

    return response.ok;
  } catch {
    return false;
  }
}
