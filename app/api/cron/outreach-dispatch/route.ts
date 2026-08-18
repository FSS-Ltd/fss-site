import { getGrowthDb } from "@/lib/growth/db/client";
import { createOutreachDispatcher } from "@/lib/growth/sequences/dispatcher";
import { postgresSequenceDispatchRepository } from "@/lib/growth/sequences/dispatcher-repository";
import { createGmailReplySync } from "@/lib/growth/sequences/gmail-sync";
import { postgresGmailSyncRepository } from "@/lib/growth/sequences/gmail-sync-repository";
import { createCronRouteHandler } from "@/lib/growth/http/cron-auth";

import { createCronGmailClient, readCronEnv } from "../runtime";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const env = readCronEnv();

  const handler = createCronRouteHandler(
    {
      cronSecret: env.cronSecret,
      automationsEnabled: env.automationsEnabled,
      reportUnexpectedError: (error) => {
        console.error("Growth OS outreach-dispatch cron failed.", {
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
      },
    },
    async () => {
      const db = getGrowthDb();
      const gmailClient = await createCronGmailClient(db, env);

      const sync = createGmailReplySync({
        repository: postgresGmailSyncRepository,
        gmailClient,
        founderEmail: env.ownerEmail,
      });
      const syncSummary = await sync(db);

      const dispatch = createOutreachDispatcher({
        repository: postgresSequenceDispatchRepository,
        gmailClient,
        founderEmail: env.ownerEmail,
      });
      const dispatchSummary = await dispatch(db, new Date());

      return { sync: syncSummary, dispatch: dispatchSummary };
    },
  );

  return handler(request);
}
