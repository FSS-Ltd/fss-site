import { readBillingConfiguration } from "../billing/configuration";
import { readOnboardingConfiguration } from "./configuration";
import type { JourneyCommandOptions } from "./commands";
import { JourneyConflict } from "./command-types";
export function journeyCommandOptions(
  env: Record<string, string | undefined> = process.env,
): JourneyCommandOptions {
  function previewConfiguration() {
    try {
      const config = readOnboardingConfiguration(env);
      if (config.enabled) return config;
    } catch {
      /* Return a safe typed error without provider details. */
    }
    throw new JourneyConflict(
      "configuration",
      "Journey preview is not configured. Check the onboarding configuration before preparing or approving messages.",
    );
  }
  // Stopping or reconciling work must not depend on healthy provider credentials.
  return {
    get previewKey() {
      return previewConfiguration().inviteKey;
    },
    get portalOrigin() {
      return previewConfiguration().portalOrigin;
    },
    get billing() {
      try {
        const billing = readBillingConfiguration(env);
        return billing.enabled
          ? { accountId: billing.accountId, livemode: billing.mode === "live" }
          : null;
      } catch {
        throw new JourneyConflict(
          "configuration",
          "Billing configuration is unavailable. Review it before approving a welcome journey.",
        );
      }
    },
  };
}
