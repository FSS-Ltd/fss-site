import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import {
  FounderAuthorizationError,
  type FounderSession,
} from "../auth/require-founder";
import { createApiErrorResponse } from "../http/api-error";
import type { ConnectGmailInput, ConnectedGmail } from "./gmail-connection";
import { GmailConnectionError } from "./gmail-connection";
import { type GoogleOAuthConfig, GoogleOAuthError } from "./google-oauth";

export const GMAIL_OAUTH_STATE_COOKIE = "growth.gmail_oauth_state" as const;
export const GMAIL_OAUTH_CALLBACK_PATH =
  "/api/integrations/gmail/callback" as const;

const GMAIL_OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;
const GROWTH_HOME_PATH = "/growth";
const GROWTH_LOGIN_PATH = "/growth/login";

export type GmailOAuthRouteConfig = {
  oauthConfig: GoogleOAuthConfig;
  expectedSubjectEmail: string;
  encryptionKey: Buffer;
};

type GmailOAuthRouteBaseDependencies = {
  config: GmailOAuthRouteConfig;
  authorizeFounder: () => Promise<FounderSession>;
  createCorrelationId: () => string;
  reportUnexpectedError: (report: {
    correlationId: string;
    error: unknown;
  }) => void;
};

export type GmailConnectRouteDependencies = GmailOAuthRouteBaseDependencies & {
  generateState: () => string;
  buildAuthorizationUrl: (config: GoogleOAuthConfig, state: string) => string;
};

export type GmailCallbackRouteDependencies = GmailOAuthRouteBaseDependencies & {
  connect: (input: ConnectGmailInput) => Promise<ConnectedGmail>;
};

export type GmailOAuthRouteDependencies = GmailConnectRouteDependencies &
  GmailCallbackRouteDependencies;

type RouteHandler = (request: NextRequest) => Promise<NextResponse>;

function registeredOrigin(config: GmailOAuthRouteConfig): URL {
  return new URL(config.oauthConfig.redirectUri);
}

function createRedirect(
  config: GmailOAuthRouteConfig,
  pathname: string,
  gmailStatus?: string,
): NextResponse {
  const url = new URL(pathname, registeredOrigin(config));
  if (gmailStatus) url.searchParams.set("gmail", gmailStatus);

  const response = NextResponse.redirect(url, 307);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function stateCookieSecure(config: GmailOAuthRouteConfig): boolean {
  return registeredOrigin(config).protocol === "https:";
}

function setStateCookie(
  response: NextResponse,
  config: GmailOAuthRouteConfig,
  state: string,
): void {
  response.cookies.set({
    name: GMAIL_OAUTH_STATE_COOKIE,
    value: state,
    httpOnly: true,
    maxAge: GMAIL_OAUTH_STATE_MAX_AGE_SECONDS,
    path: GMAIL_OAUTH_CALLBACK_PATH,
    sameSite: "lax",
    secure: stateCookieSecure(config),
  });
}

function deleteStateCookie(
  response: NextResponse,
  config: GmailOAuthRouteConfig,
): void {
  response.cookies.set({
    name: GMAIL_OAUTH_STATE_COOKIE,
    value: "",
    expires: new Date(0),
    httpOnly: true,
    path: GMAIL_OAUTH_CALLBACK_PATH,
    sameSite: "lax",
    secure: stateCookieSecure(config),
  });
}

function singleQueryValue(
  url: URL,
  name: string,
  maxLength = 4_096,
): string | null {
  const values = url.searchParams.getAll(name);
  if (
    values.length !== 1 ||
    values[0].trim().length === 0 ||
    values[0].length > maxLength
  ) {
    return null;
  }
  return values[0];
}

function statesMatch(
  received: string | null,
  expected: string | undefined,
): boolean {
  if (
    !received ||
    !expected ||
    received.length > 256 ||
    expected.length > 256
  ) {
    return false;
  }

  const receivedBytes = Buffer.from(received, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return (
    receivedBytes.byteLength === expectedBytes.byteLength &&
    timingSafeEqual(receivedBytes, expectedBytes)
  );
}

function callbackRequestIsRegistered(
  requestUrl: URL,
  config: GmailOAuthRouteConfig,
): boolean {
  const registered = registeredOrigin(config);
  return (
    requestUrl.origin === registered.origin &&
    requestUrl.pathname === registered.pathname
  );
}

function callbackFailureStatus(error: unknown): string | null {
  if (error instanceof GmailConnectionError) {
    return error.code === "MISSING_REFRESH_TOKEN"
      ? "missing_refresh_token"
      : "identity_error";
  }

  if (error instanceof GoogleOAuthError) return "provider_error";
  return null;
}

function createNextApiErrorResponse(
  status: number,
  code: string,
  message: string,
  correlationId: string,
): NextResponse {
  const response = createApiErrorResponse(status, code, message, correlationId);
  return new NextResponse(response.body, {
    status: response.status,
    headers: response.headers,
  });
}

export function createGmailConnectHandler(
  dependencies: GmailConnectRouteDependencies,
): RouteHandler {
  return async () => {
    try {
      await dependencies.authorizeFounder();
    } catch (error) {
      if (error instanceof FounderAuthorizationError) {
        return createRedirect(dependencies.config, GROWTH_LOGIN_PATH);
      }

      const correlationId = dependencies.createCorrelationId();
      dependencies.reportUnexpectedError({ correlationId, error });
      return createRedirect(
        dependencies.config,
        GROWTH_HOME_PATH,
        "unexpected_error",
      );
    }

    const state = dependencies.generateState();
    const authorizationUrl = dependencies.buildAuthorizationUrl(
      dependencies.config.oauthConfig,
      state,
    );
    const response = NextResponse.redirect(authorizationUrl, 307);
    response.headers.set("Cache-Control", "no-store");
    setStateCookie(response, dependencies.config, state);
    return response;
  };
}

export function createGmailCallbackHandler(
  dependencies: GmailCallbackRouteDependencies,
): RouteHandler {
  return async (request) => {
    const requestUrl = new URL(request.url);
    if (!callbackRequestIsRegistered(requestUrl, dependencies.config)) {
      const correlationId = dependencies.createCorrelationId();
      const error = new Error("Invalid Gmail OAuth callback origin.");
      dependencies.reportUnexpectedError({ correlationId, error });
      const response = createNextApiErrorResponse(
        400,
        "INVALID_CALLBACK_ORIGIN",
        "The Gmail OAuth callback origin is invalid.",
        correlationId,
      );
      deleteStateCookie(response, dependencies.config);
      return response;
    }

    let founder: FounderSession;
    try {
      founder = await dependencies.authorizeFounder();
    } catch (error) {
      if (error instanceof FounderAuthorizationError) {
        const response = createRedirect(dependencies.config, GROWTH_LOGIN_PATH);
        deleteStateCookie(response, dependencies.config);
        return response;
      }

      const correlationId = dependencies.createCorrelationId();
      dependencies.reportUnexpectedError({ correlationId, error });
      const response = createRedirect(
        dependencies.config,
        GROWTH_HOME_PATH,
        "unexpected_error",
      );
      deleteStateCookie(response, dependencies.config);
      return response;
    }

    const state = singleQueryValue(requestUrl, "state", 256);
    const storedState = request.cookies.get(GMAIL_OAUTH_STATE_COOKIE)?.value;
    if (!statesMatch(state, storedState)) {
      const response = createRedirect(
        dependencies.config,
        GROWTH_HOME_PATH,
        "state_error",
      );
      deleteStateCookie(response, dependencies.config);
      return response;
    }

    if (requestUrl.searchParams.has("error")) {
      const response = createRedirect(
        dependencies.config,
        GROWTH_HOME_PATH,
        "provider_error",
      );
      deleteStateCookie(response, dependencies.config);
      return response;
    }

    const code = singleQueryValue(requestUrl, "code");
    if (!code) {
      const response = createRedirect(
        dependencies.config,
        GROWTH_HOME_PATH,
        "callback_error",
      );
      deleteStateCookie(response, dependencies.config);
      return response;
    }

    const correlationId = dependencies.createCorrelationId();
    try {
      await dependencies.connect({
        authorizationCode: code,
        oauthConfig: dependencies.config.oauthConfig,
        expectedSubjectEmail: dependencies.config.expectedSubjectEmail,
        encryptionKey: dependencies.config.encryptionKey,
        correlationId,
        actorId: founder.actorId,
      });

      const response = createRedirect(
        dependencies.config,
        GROWTH_HOME_PATH,
        "connected",
      );
      deleteStateCookie(response, dependencies.config);
      return response;
    } catch (error) {
      const knownStatus = callbackFailureStatus(error);
      if (!knownStatus) {
        dependencies.reportUnexpectedError({ correlationId, error });
      }

      const response = createRedirect(
        dependencies.config,
        GROWTH_HOME_PATH,
        knownStatus ?? "unexpected_error",
      );
      deleteStateCookie(response, dependencies.config);
      return response;
    }
  };
}
