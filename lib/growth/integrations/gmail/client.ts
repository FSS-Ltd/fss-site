import { z } from "zod";

import { GmailClientError, type GmailClient, type GmailProfile } from "./types";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const REQUEST_TIMEOUT_MS = 10_000;
const ACCESS_TOKEN_EXPIRY_SKEW_SECONDS = 60;
const MAX_JSON_RESPONSE_BYTES = 256 * 1024;
const RETRYABLE_FORBIDDEN_REASONS = new Set([
  "rateLimitExceeded",
  "userRateLimitExceeded",
]);

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive().max(86_400),
  token_type: z.literal("Bearer"),
});

const profileResponseSchema = z.object({
  emailAddress: z.string().email().max(320),
  historyId: z.string().regex(/^\d+$/).max(32),
});

const providerErrorResponseSchema = z.object({
  error: z.object({
    errors: z
      .array(z.object({ reason: z.string().max(100) }))
      .max(20)
      .optional(),
  }),
});

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type GmailClientConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

export type GmailClientDependencies = {
  fetch?: FetchLike;
  nowEpochSeconds?: () => number;
};

type CachedAccessToken = {
  value: string;
  expiresAt: number;
};

function requireCredential(value: string, label: string): string {
  if (value.trim().length === 0) {
    throw new TypeError(`${label} must not be blank.`);
  }
  return value;
}

async function readJson(response: Response): Promise<unknown> {
  const contentLength = response.headers.get("content-length");
  if (
    contentLength !== null &&
    /^\d+$/.test(contentLength) &&
    Number(contentLength) > MAX_JSON_RESPONSE_BYTES
  ) {
    await discardBody(response);
    throw new GmailClientError("INVALID_PROVIDER_RESPONSE");
  }

  if (!response.body) {
    throw new GmailClientError("INVALID_PROVIDER_RESPONSE");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      byteLength += result.value.byteLength;
      if (byteLength > MAX_JSON_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new GmailClientError("INVALID_PROVIDER_RESPONSE");
      }
      chunks.push(result.value);
    }
  } catch (error) {
    if (error instanceof GmailClientError) throw error;
    throw new GmailClientError("RETRYABLE_PROVIDER_ERROR");
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new GmailClientError("INVALID_PROVIDER_RESPONSE");
  }
}

async function discardBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Provider error bodies are intentionally ignored.
  }
}

async function providerError(response: Response): Promise<GmailClientError> {
  if (response.status === 429 || response.status >= 500) {
    await discardBody(response);
    return new GmailClientError("RETRYABLE_PROVIDER_ERROR");
  }
  if (response.status === 403) {
    let payload: unknown;
    try {
      payload = await readJson(response);
    } catch (error) {
      if (
        error instanceof GmailClientError &&
        error.code === "RETRYABLE_PROVIDER_ERROR"
      ) {
        throw error;
      }
      return new GmailClientError("PERMANENT_PROVIDER_ERROR");
    }
    const parsed = providerErrorResponseSchema.safeParse(payload);
    if (
      parsed.success &&
      parsed.data.error.errors?.some(({ reason }) =>
        RETRYABLE_FORBIDDEN_REASONS.has(reason),
      )
    ) {
      return new GmailClientError("RETRYABLE_PROVIDER_ERROR");
    }
    return new GmailClientError("PERMANENT_PROVIDER_ERROR");
  }
  await discardBody(response);
  return new GmailClientError("PERMANENT_PROVIDER_ERROR");
}

class GoogleGmailClient implements GmailClient {
  private accessToken?: CachedAccessToken;
  private refreshPromise?: Promise<CachedAccessToken>;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => number;

  constructor(
    private readonly config: GmailClientConfig,
    dependencies: GmailClientDependencies,
  ) {
    this.fetchImpl = dependencies.fetch ?? fetch;
    this.now = dependencies.nowEpochSeconds ?? (() => Date.now() / 1000);
  }

  private async fetchProvider(
    input: string | URL,
    init: RequestInit,
  ): Promise<Response> {
    try {
      return await this.fetchImpl(input, {
        ...init,
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new GmailClientError("RETRYABLE_PROVIDER_ERROR");
    }
  }

  private async refreshAccessToken(): Promise<CachedAccessToken> {
    requireCredential(this.config.clientId, "Gmail OAuth client ID");
    requireCredential(this.config.clientSecret, "Gmail OAuth client secret");
    requireCredential(this.config.refreshToken, "Gmail refresh token");

    const response = await this.fetchProvider(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: "refresh_token",
        refresh_token: this.config.refreshToken,
      }),
    });
    const tokenIssuedAt = this.now();

    if (!response.ok) {
      await discardBody(response);
      if (response.status === 429 || response.status >= 500) {
        throw new GmailClientError("RETRYABLE_PROVIDER_ERROR");
      }
      throw new GmailClientError("AUTHENTICATION_FAILED");
    }

    const parsed = tokenResponseSchema.safeParse(await readJson(response));
    if (!parsed.success) {
      throw new GmailClientError("INVALID_PROVIDER_RESPONSE");
    }

    return {
      value: parsed.data.access_token,
      expiresAt: tokenIssuedAt + parsed.data.expires_in,
    };
  }

  private getFreshAccessToken(): Promise<CachedAccessToken> {
    if (
      this.accessToken &&
      this.now() < this.accessToken.expiresAt - ACCESS_TOKEN_EXPIRY_SKEW_SECONDS
    ) {
      return Promise.resolve(this.accessToken);
    }
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = this.refreshAccessToken()
      .then((accessToken) => {
        this.accessToken = accessToken;
        return accessToken;
      })
      .finally(() => {
        this.refreshPromise = undefined;
      });
    return this.refreshPromise;
  }

  private async request(pathname: string): Promise<Response> {
    let accessToken = await this.getFreshAccessToken();
    let response = await this.fetchProvider(`${GMAIL_API_BASE}${pathname}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken.value}`,
      },
    });

    if (response.status === 401) {
      await discardBody(response);
      if (this.accessToken?.value === accessToken.value) {
        this.accessToken = undefined;
      }
      accessToken = await this.getFreshAccessToken();
      response = await this.fetchProvider(`${GMAIL_API_BASE}${pathname}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken.value}`,
        },
      });
      if (response.status === 401) {
        await discardBody(response);
        throw new GmailClientError("AUTHENTICATION_FAILED");
      }
    }

    if (!response.ok) {
      throw await providerError(response);
    }
    return response;
  }

  async getProfile(): Promise<GmailProfile> {
    const response = await this.request("/profile");
    const parsed = profileResponseSchema.safeParse(await readJson(response));
    if (!parsed.success) {
      throw new GmailClientError("INVALID_PROVIDER_RESPONSE");
    }
    return parsed.data;
  }
}

export function createGmailClient(
  config: GmailClientConfig,
  dependencies: GmailClientDependencies = {},
): GmailClient {
  return new GoogleGmailClient(config, dependencies);
}

export { GmailClientError } from "./types";
