import { readGrowthServerEnv } from "@/lib/growth/config/env";
import { getGrowthDb } from "@/lib/growth/db/client";
import type { GrowthQueryExecutor } from "@/lib/growth/db/types";
import { verifyUnsubscribeToken } from "@/lib/growth/email/suppression";
import {
  recordNewsletterUnsubscribe,
  type NewsletterSubscriberDependencies,
  type NewsletterSubscriberRecord,
} from "@/lib/growth/newsletter/subscribers";

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

function realSubscriberDependencies(db: GrowthQueryExecutor): NewsletterSubscriberDependencies {
  type Row = {
    id: string;
    normalisedEmail: string;
    status: NewsletterSubscriberRecord["status"];
    consentedAt: Date | null;
    unsubscribedAt: Date | null;
  };

  return {
    async findSubscriberByEmail(normalisedEmail) {
      const rows = await db<Row[]>`
        select
          id,
          normalised_email as "normalisedEmail",
          status,
          consented_at as "consentedAt",
          unsubscribed_at as "unsubscribedAt"
        from growth.newsletter_subscribers
        where normalised_email = ${normalisedEmail}
      `;
      return rows[0] ?? null;
    },
    async insertSubscriber(input) {
      const [row] = await db<Row[]>`
        insert into growth.newsletter_subscribers (
          email, first_name, business_name, status,
          consent_source, consent_text_version, consent_evidence,
          consent_ip_hash, consent_user_agent_hash, consented_at
        ) values (
          ${input.email}, ${input.firstName ?? null}, ${input.businessName ?? null}, 'subscribed',
          ${input.consentSource}, ${input.consentTextVersion}, ${input.consentEvidence},
          ${input.consentIpHash ?? null}, ${input.consentUserAgentHash ?? null}, ${input.consentedAt}
        )
        returning
          id,
          normalised_email as "normalisedEmail",
          status,
          consented_at as "consentedAt",
          unsubscribed_at as "unsubscribedAt"
      `;
      return row;
    },
    async updateSubscriberConsent(id, input) {
      const [row] = await db<Row[]>`
        update growth.newsletter_subscribers
        set status = 'subscribed',
            first_name = coalesce(${input.firstName ?? null}, first_name),
            business_name = coalesce(${input.businessName ?? null}, business_name),
            consent_source = ${input.consentSource},
            consent_text_version = ${input.consentTextVersion},
            consent_evidence = ${input.consentEvidence},
            consent_ip_hash = ${input.consentIpHash ?? null},
            consent_user_agent_hash = ${input.consentUserAgentHash ?? null},
            consented_at = ${input.consentedAt},
            unsubscribed_at = null,
            updated_at = now()
        where id = ${id}
        returning
          id,
          normalised_email as "normalisedEmail",
          status,
          consented_at as "consentedAt",
          unsubscribed_at as "unsubscribedAt"
      `;
      return row;
    },
    async updateSubscriberStatus(id, status, at) {
      const [row] = await db<Row[]>`
        update growth.newsletter_subscribers
        set status = ${status}, unsubscribed_at = ${at}, updated_at = now()
        where id = ${id}
        returning
          id,
          normalised_email as "normalisedEmail",
          status,
          consented_at as "consentedAt",
          unsubscribed_at as "unsubscribedAt"
      `;
      return row;
    },
  };
}

export async function GET(request: Request): Promise<Response> {
  try {
    const handler = createUnsubscribeRouteHandler({
      tokenSecret: readGrowthServerEnv().newsletterUnsubscribeTokenSecret,
      subscribers: realSubscriberDependencies(getGrowthDb()),
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
