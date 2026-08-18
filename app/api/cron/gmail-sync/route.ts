import { getGrowthDb } from "@/lib/growth/db/client";
import { createCronRouteHandler } from "@/lib/growth/http/cron-auth";
import { createGmailReplySync } from "@/lib/growth/sequences/gmail-sync";
import { postgresGmailSyncRepository } from "@/lib/growth/sequences/gmail-sync-repository";

import { createCronGmailClient, readCronEnv } from "../runtime";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const env = readCronEnv();

  const handler = createCronRouteHandler(
    {
      cronSecret: env.cronSecret,
      automationsEnabled: env.automationsEnabled,
      reportUnexpectedError: (error) => {
        console.error("Growth OS gmail-sync cron failed.", {
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
      return sync(db);
    },
  );

  return handler(request);
}
