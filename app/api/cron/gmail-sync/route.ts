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
      reportUnexpectedError: (report) =>
        console.error("Growth OS gmail-sync cron failed.", report),
    },
    async () => {
      const db = getGrowthDb();
      const { client: gmailClient, binding } = await createCronGmailClient(
        db,
        env,
      );
      const sync = createGmailReplySync({
        repository: postgresGmailSyncRepository,
        gmailClient,
        binding,
        founderEmail: env.ownerEmail,
      });
      const { coverageId, ...summary } = await sync(db);
      void coverageId;
      return summary;
    },
  );

  return handler(request);
}
