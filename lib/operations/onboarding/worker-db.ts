import postgres from "postgres";
import { operationsEnabled, type OperationsDb } from "../db/client";
let sharedDb: OperationsDb | undefined;
export function onboardingEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return operationsEnabled(env) && env.OPERATIONS_ONBOARDING_ENABLED === "true";
}
export function getOnboardingWorkerDb(): OperationsDb {
  if (!onboardingEnabled()) throw new Error("Onboarding is disabled.");
  const url = process.env.OPERATIONS_ONBOARDING_DATABASE_URL;
  if (!url) throw new Error("Onboarding worker is not configured.");
  sharedDb ??= postgres(url, {
    prepare: false,
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
    connection: { options: "-c role=operations_onboarding_worker" },
  });
  return sharedDb;
}
