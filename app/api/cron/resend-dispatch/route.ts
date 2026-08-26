import { resolveSiteUrl } from "@/lib/config/site-url";
import {
  readGrowthServerEnv,
  requireNewsletterUnsubscribeTokenSecret,
  requireResendEnv,
} from "@/lib/growth/config/env";
import { getGrowthDb } from "@/lib/growth/db/client";
import { createResendClient } from "@/lib/growth/integrations/resend/client";
import { createNewsletterDispatcher } from "@/lib/growth/newsletter/dispatch";
import { postgresNewsletterDispatchRepository } from "@/lib/growth/newsletter/newsletter-dispatch-repository";

import { createResendDispatchRouteHandler } from "./handler";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const env = readGrowthServerEnv();

  const handler = createResendDispatchRouteHandler({
    db: getGrowthDb(),
    cronSecret: env.cronSecret,
    automationsEnabled: env.automationsEnabled,
    dispatch: (db) => {
      const resendEnv = requireResendEnv(env);
      const dispatch = createNewsletterDispatcher({
        repository: postgresNewsletterDispatchRepository,
        resend: createResendClient(resendEnv.apiKey),
        fromEmail: resendEnv.from,
        replyToEmail: resendEnv.replyTo,
        unsubscribeTokenSecret: requireNewsletterUnsubscribeTokenSecret(env),
        siteOrigin: resolveSiteUrl(),
      });
      return dispatch(db);
    },
    reportUnexpectedError: (error) => {
      console.error("Growth OS resend-dispatch cron failed.", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    },
  });

  return handler(request);
}
