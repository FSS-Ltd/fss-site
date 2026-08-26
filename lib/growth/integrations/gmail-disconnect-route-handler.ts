import { NextRequest, NextResponse } from "next/server";

import {
  FounderAuthorizationError,
  type FounderSession,
} from "../auth/require-founder";
import { createApiErrorResponse } from "../http/api-error";
import type { DisconnectGmailInput, disconnectGmail } from "./gmail-disconnect";

const GROWTH_HOME_PATH = "/growth/settings";
const GROWTH_LOGIN_PATH = "/growth/login";

type DisconnectResult = Awaited<ReturnType<typeof disconnectGmail>>;

export type GmailDisconnectRouteConfig = {
  origin: string;
  subjectEmail: string;
  encryptionKey: Buffer;
};

export type GmailDisconnectRouteDependencies = {
  config: GmailDisconnectRouteConfig;
  authorizeFounder: () => Promise<FounderSession>;
  disconnect: (input: DisconnectGmailInput) => Promise<DisconnectResult>;
  createCorrelationId: () => string;
  reportUnexpectedError: (report: {
    correlationId: string;
    error: unknown;
  }) => void;
};

type RouteHandler = (request: NextRequest) => Promise<NextResponse>;

function createRedirect(
  config: GmailDisconnectRouteConfig,
  pathname: string,
  gmailStatus?: string,
): NextResponse {
  const url = new URL(pathname, config.origin);
  if (gmailStatus) url.searchParams.set("gmail", gmailStatus);

  const response = NextResponse.redirect(url, 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
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

function requestHasRegisteredOrigin(
  request: NextRequest,
  config: GmailDisconnectRouteConfig,
): boolean {
  const expectedOrigin = config.origin;
  return (
    new URL(request.url).origin === expectedOrigin &&
    request.headers.get("origin") === expectedOrigin
  );
}

export function createGmailDisconnectHandler(
  dependencies: GmailDisconnectRouteDependencies,
): RouteHandler {
  return async (request) => {
    const correlationId = dependencies.createCorrelationId();

    if (!requestHasRegisteredOrigin(request, dependencies.config)) {
      const error = new Error("Invalid Gmail disconnect origin.");
      dependencies.reportUnexpectedError({ correlationId, error });
      return createNextApiErrorResponse(
        400,
        "INVALID_DISCONNECT_ORIGIN",
        "The Gmail disconnect origin is invalid.",
        correlationId,
      );
    }

    let founder: FounderSession;
    try {
      founder = await dependencies.authorizeFounder();
    } catch (error) {
      if (error instanceof FounderAuthorizationError) {
        return createRedirect(dependencies.config, GROWTH_LOGIN_PATH);
      }

      dependencies.reportUnexpectedError({ correlationId, error });
      return createRedirect(
        dependencies.config,
        GROWTH_HOME_PATH,
        "unexpected_error",
      );
    }

    try {
      const result = await dependencies.disconnect({
        subjectEmail: dependencies.config.subjectEmail,
        encryptionKeys: { v1: dependencies.config.encryptionKey },
        correlationId,
        actorId: founder.actorId,
      });
      const status =
        result.providerRevocation === "unconfirmed"
          ? "revocation_unconfirmed"
          : "disconnected";

      return createRedirect(dependencies.config, GROWTH_HOME_PATH, status);
    } catch (error) {
      dependencies.reportUnexpectedError({ correlationId, error });
      return createRedirect(
        dependencies.config,
        GROWTH_HOME_PATH,
        "unexpected_error",
      );
    }
  };
}
