import { createCronRouteHandler } from "@/lib/growth/http/cron-auth";
import {
  onboardingEnabled,
  getOnboardingWorkerDb,
} from "@/lib/operations/onboarding/worker-db";
import { onboardingStore } from "@/lib/operations/onboarding/outbox";
import { onboardingEffects } from "@/lib/operations/onboarding/effects";
import { runOnboardingWorker } from "@/lib/operations/onboarding/worker";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(request: Request): Promise<Response> {
  return createCronRouteHandler(
    {
      cronSecret: process.env.CRON_SECRET,
      automationsEnabled: onboardingEnabled(),
      disabledReason: "operations_onboarding_disabled",
      reportUnexpectedError: () =>
        console.error("Operations onboarding dispatch failed."),
    },
    async () => {
      const db = getOnboardingWorkerDb();
      return runOnboardingWorker(onboardingStore(db), onboardingEffects(db), {
        limit: 5,
      });
    },
  )(request);
}
