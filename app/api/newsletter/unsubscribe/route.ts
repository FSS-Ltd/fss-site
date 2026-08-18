import { readGrowthServerEnv } from "@/lib/growth/config/env";
import { getGrowthDb } from "@/lib/growth/db/client";
import { verifyUnsubscribeToken } from "@/lib/growth/email/suppression";
import {
  recordNewsletterUnsubscribe,
  type NewsletterSubscriberDependencies,
} from "@/lib/growth/newsletter/subscribers";
import { createNewsletterSubscriberRepository } from "@/lib/growth/newsletter/subscribers-repository";

export const runtime = "nodejs";

const INVALID_LINK_MESSAGE = "This unsubscribe link is no longer valid.";
const UNSUBSCRIBED_MESSAGE = "You have been unsubscribed from FSS Field Notes.";
const UNAVAILABLE_MESSAGE = "Something went wrong. Please try again shortly.";

function htmlResponse(status: number, message: string): Response {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>FSS Field Notes</title></head><body><p>${message}</p></body></html>`;
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export type UnsubscribeRouteDependencies = {
  tokenSecret: string | undefined;
  subscribers: NewsletterSubscriberDependencies;
  now?: () => Date;
  reportUnexpectedError?: (error: unknown) => void;
};

export function createUnsubscribeRouteHandler(
  dependencies: UnsubscribeRouteDependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const token = new URL(request.url).searchParams.get("token");
    const secret = dependencies.tokenSecret;

    if (!token || !secret) {
      return htmlResponse(400, INVALID_LINK_MESSAGE);
    }

    const now = dependencies.now?.() ?? new Date();
    const verified = verifyUnsubscribeToken(token, secret, now);
    if (!verified.ok) {
      return htmlResponse(400, INVALID_LINK_MESSAGE);
    }

    try {
      await recordNewsletterUnsubscribe(verified.normalisedEmail, dependencies.subscribers, now);
    } catch (error) {
      dependencies.reportUnexpectedError?.(error);
      return htmlResponse(500, UNAVAILABLE_MESSAGE);
    }

    return htmlResponse(200, UNSUBSCRIBED_MESSAGE);
  };
}

export async function GET(request: Request): Promise<Response> {
  try {
    const handler = createUnsubscribeRouteHandler({
      tokenSecret: readGrowthServerEnv().newsletterUnsubscribeTokenSecret,
      subscribers: createNewsletterSubscriberRepository(getGrowthDb()),
      reportUnexpectedError: (error) => {
        console.error("Newsletter unsubscribe failed.", {
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
      },
    });
    return await handler(request);
  } catch (error) {
    console.error("Newsletter unsubscribe route unavailable.", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return htmlResponse(503, UNAVAILABLE_MESSAGE);
  }
}

export const POST = GET;
