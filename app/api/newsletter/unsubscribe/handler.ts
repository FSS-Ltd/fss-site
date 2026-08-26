import { verifyUnsubscribeToken } from "@/lib/growth/email/suppression";
import {
  recordNewsletterUnsubscribe,
  type NewsletterSubscriberDependencies,
} from "@/lib/growth/newsletter/subscribers";

const INVALID_LINK_MESSAGE = "This unsubscribe link is no longer valid.";
const UNSUBSCRIBED_MESSAGE = "You have been unsubscribed from FSS Field Notes.";
export const UNAVAILABLE_MESSAGE =
  "Something went wrong. Please try again shortly.";

export function htmlResponse(status: number, message: string): Response {
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
      await recordNewsletterUnsubscribe(
        verified.normalisedEmail,
        dependencies.subscribers,
        now,
      );
    } catch (error) {
      dependencies.reportUnexpectedError?.(error);
      return htmlResponse(500, UNAVAILABLE_MESSAGE);
    }

    return htmlResponse(200, UNSUBSCRIBED_MESSAGE);
  };
}
