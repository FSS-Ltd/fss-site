import { getGrowthDb } from "@/lib/growth/db/client";
import { createCronRouteHandler } from "@/lib/growth/http/cron-auth";
import { createLiveOutreachDueWorker } from "@/lib/growth/campaigns/outreach-due-worker";
import { createCronGmailClient, readCronEnv } from "../runtime";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const env = readCronEnv();
  const handler = createCronRouteHandler(
    {
      cronSecret: env.cronSecret,
      automationsEnabled: env.automationsEnabled,
      reportUnexpectedError: (report) =>
        console.error("Growth OS outreach-prepare cron failed.", report),
    },
    async () => {
      const db = getGrowthDb();
      const bound = await createCronGmailClient(db, env);
      return createLiveOutreachDueWorker({
        bound,
        founderEmail: env.ownerEmail,
      })(db);
    },
  );
  return handler(request);
}
