import Stripe from "stripe";
import type { OperationsDb } from "../db/client";
import { BILLING_STRIPE_API_VERSION } from "../billing/client";
import { readBillingConfiguration } from "../billing/configuration";
import { readOnboardingConfiguration } from "./configuration";
import { createOnboardingResendSender } from "./resend-provider";
import {
  createOnboardingAccessProvider,
  requireCurrentEffect,
  resolveOnboardingAccess,
} from "./access-provider";
import { createOnboardingBillingProvider } from "./billing-provider";
import type { OnboardingEffects } from "./types";
export function onboardingEffects(db: OperationsDb): OnboardingEffects {
  const config = readOnboardingConfiguration();
  if (!config.enabled) throw new Error("Onboarding is disabled.");
  const send = createOnboardingResendSender(config.resendKey);
  const access = createOnboardingAccessProvider(
    db,
    config.inviteKey,
    config.portalOrigin,
  );
  return {
    ensureProposalAccess: access,
    ensureInvitation: access,
    async createInvoice(lease) {
      const billing = readBillingConfiguration();
      if (!billing.enabled)
        return {
          status: "failed",
          code: "configuration",
          retryable: false,
          uncertain: false,
        };
      const stripe = new Stripe(billing.secretKey, {
        apiVersion: BILLING_STRIPE_API_VERSION,
        timeout: 10000,
        maxNetworkRetries: 0,
        telemetry: false,
      });
      return createOnboardingBillingProvider(db, stripe, {
        ...billing,
        portalOrigin: config.portalOrigin,
      })(lease);
    },
    async sendEmail(input) {
      const lease = input.lease;
      if (
        input.email.to !== lease.recipient ||
        (lease.proposal &&
          new URL(lease.proposal.portalUrl).origin !== config.portalOrigin)
      )
        return {
          status: "failed",
          code: "invalid_contract",
          retryable: false,
          uncertain: false,
        };
      const [row] = await db<
        { suppressed: boolean }[]
      >`select operations.onboarding_recipient_suppressed(${lease.jobId},${lease.leaseToken},${lease.generation}) as suppressed`;
      if (row.suppressed)
        return {
          status: "failed",
          code: "invalid_recipient",
          retryable: false,
          uncertain: false,
        };
      const email =
        lease.step === "welcome"
          ? input.email
          : await resolveOnboardingAccess(
              db,
              lease,
              input.email,
              config.inviteKey,
              config.portalOrigin,
            );
      await requireCurrentEffect(db, lease);
      return send({ ...input, email });
    },
  };
}
