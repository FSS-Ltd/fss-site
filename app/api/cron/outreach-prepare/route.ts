import { getGrowthDb } from "@/lib/growth/db/client";
import { createCronRouteHandler } from "@/lib/growth/http/cron-auth";
import { createLiveOutreachDueWorker } from "@/lib/growth/campaigns/outreach-due-worker";
import { observeLiveGmailDueContext } from "@/lib/growth/campaigns/gmail-due-context";
import {
  isLondonPreparationSlot,
  isOutreachPreparationEnabled,
} from "@/lib/growth/campaigns/london-preparation-slot";
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
      if (
        !isOutreachPreparationEnabled(
          process.env.GROWTH_OS_OUTREACH_PREPARATION_ENABLED,
        )
      )
        return { skipped: "outreach_preparation_disabled" };
      if (!isLondonPreparationSlot(new Date()))
        return { skipped: "outside_preparation_slot" };
      const db = getGrowthDb();
      const bound = await createCronGmailClient(db, env);
      const context = await observeLiveGmailDueContext(db, {
        bound,
        founderEmail: env.ownerEmail,
      });
      return createLiveOutreachDueWorker({
        context,
        founderEmail: env.ownerEmail,
      })(db);
    },
  );
  return handler(request);
}
