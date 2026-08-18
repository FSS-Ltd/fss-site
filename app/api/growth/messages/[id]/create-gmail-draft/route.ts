import { randomUUID } from "node:crypto";

import { readGrowthServerEnv } from "@/lib/growth/config/env";
import { getGrowthDb } from "@/lib/growth/db/client";
import { createCreateGmailDraftHandler } from "@/lib/growth/sequences/create-gmail-draft-route-handler";

import {
  messageActionRouteUnavailable,
  readGmailDraftRouteExtras,
  readMessageActionRouteConfig,
} from "../../../runtime";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const config = readMessageActionRouteConfig();
    const extras = readGmailDraftRouteExtras();
    const handler = createCreateGmailDraftHandler({
      db: getGrowthDb(),
      config,
      founderEmail: readGrowthServerEnv().ownerEmail,
      siteOrigin: config.origin,
      gmailClientId: extras.gmailClientId,
      gmailClientSecret: extras.gmailClientSecret,
      decryptionKeys: extras.decryptionKeys,
      createCorrelationId: randomUUID,
      reportUnexpectedError: ({ correlationId, error }) => {
        console.error("Growth OS create-gmail-draft action failed.", {
          correlationId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
      },
    });
    return handler(request, context);
  } catch (error) {
    return messageActionRouteUnavailable(
      "create-gmail-draft",
      error,
      randomUUID(),
    );
  }
}
