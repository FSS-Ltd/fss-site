import { getGrowthDb } from "@/lib/growth/db/client";
import { createCronRouteHandler } from "@/lib/growth/http/cron-auth";
import { createLiveResendOutreachWorker } from "@/lib/growth/campaigns/resend-outreach-worker";
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
      const preparation = await createLiveOutreachDueWorker({
        context,
        founderEmail: env.ownerEmail,
      })(db);
      if (process.env.GROWTH_OS_RESEND_OUTREACH_ENABLED !== "true")
        return preparation;
      const resend = await createLiveResendOutreachWorker({
        context,
        prepareOnly: true,
      })(db);
      return { preparation, resend };
    },
  );
  return handler(request);
}
