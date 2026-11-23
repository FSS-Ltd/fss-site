import { getGrowthDb } from "@/lib/growth/db/client";
import { createLiveOutreachDispatcher } from "@/lib/growth/sequences/dispatcher";
import { postgresSequenceDispatchRepository } from "@/lib/growth/sequences/dispatcher-repository";
import { createGmailReplySync } from "@/lib/growth/sequences/gmail-sync";
import { postgresGmailSyncRepository } from "@/lib/growth/sequences/gmail-sync-repository";
import { createCronRouteHandler } from "@/lib/growth/http/cron-auth";
import { isOutreachPreparationEnabled } from "@/lib/growth/campaigns/london-preparation-slot";
import { observeLiveGmailDueContext } from "@/lib/growth/campaigns/gmail-due-context";
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
        console.error("Growth OS outreach-dispatch cron failed.", report),
    },
    async () => {
      const db = getGrowthDb();
      const bound = await createCronGmailClient(db, env);
      if (
        isOutreachPreparationEnabled(
          process.env.GROWTH_OS_OUTREACH_PREPARATION_ENABLED,
        )
      ) {
        const context = await observeLiveGmailDueContext(db, {
          bound,
          founderEmail: env.ownerEmail,
        });
        const preparation = await createLiveOutreachDueWorker({
          context,
          founderEmail: env.ownerEmail,
        })(db);
        const dispatch = createLiveOutreachDispatcher({
          repository: postgresSequenceDispatchRepository,
          context,
          founderEmail: env.ownerEmail,
        });
        const dispatchSummary = await dispatch(
          db,
          new Date(),
          undefined,
          context.coverageId,
        );
        return {
          sync: context.syncSummary,
          preparation,
          dispatch: dispatchSummary,
        };
      }
      const { client: gmailClient, binding } = bound;

      const sync = createGmailReplySync({
        repository: postgresGmailSyncRepository,
        gmailClient,
        binding,
        founderEmail: env.ownerEmail,
      });
      const { coverageId, ...syncSummary } = await sync(db);

      const dispatch = createLiveOutreachDispatcher({
        repository: postgresSequenceDispatchRepository,
        bound,
        founderEmail: env.ownerEmail,
      });
      const dispatchSummary = await dispatch(
        db,
        new Date(),
        undefined,
        coverageId,
      );

      return { sync: syncSummary, dispatch: dispatchSummary };
    },
  );

  return handler(request);
}
