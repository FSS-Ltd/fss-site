import { readGrowthServerEnv } from "@/lib/growth/config/env";
import { getGrowthDb } from "@/lib/growth/db/client";
import { createNewsletterSubscriberRepository } from "@/lib/growth/newsletter/subscribers-repository";

import {
  createUnsubscribeRouteHandler,
  htmlResponse,
  UNAVAILABLE_MESSAGE,
} from "./handler";

export const runtime = "nodejs";

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
