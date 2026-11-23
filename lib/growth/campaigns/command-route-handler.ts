import { z } from "zod";
import { requireFounder, type FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import {
  createMessageActionHandler,
  type MessageActionRouteConfig,
} from "../sequences/message-action-route";
import { executeCampaignCommand } from "./commands";

const fields = {
  requestId: z.uuid(),
  campaignId: z.uuid(),
  policyVersion: z.number().int().positive(),
};
const lifecycleCommand = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("approve"), ...fields }),
  z.strictObject({ type: z.literal("pause"), ...fields }),
  z.strictObject({ type: z.literal("resume"), ...fields }),
]);

export function createCampaignCommandHandler(dependencies: {
  db: GrowthDb;
  config: MessageActionRouteConfig;
  authorizeFounder?: () => Promise<FounderSession>;
  createCorrelationId: () => string;
  reportUnexpectedError: (report: {
    correlationId: string;
    error: unknown;
  }) => void;
  execute?: typeof executeCampaignCommand;
}): (request: Request) => Promise<Response> {
  const handler = createMessageActionHandler({
    ...dependencies,
    authorizeFounder: dependencies.authorizeFounder ?? requireFounder,
    bodySchema: lifecycleCommand,
    action: ({ body, founder, correlationId }) =>
      (dependencies.execute ?? executeCampaignCommand)(
        dependencies.db,
        body,
        founder,
        correlationId,
      ),
    mapActionError: (error) => {
      if (!(error instanceof Error)) return null;
      const known = new Set([
        "policy_version_changed",
        "policy_revoked",
        "already_approved",
        "policy_not_approved",
        "provider_health_unknown",
        "account_not_active",
        "identity_or_configuration_unknown",
        "request_conflict",
        "policy_not_approvable",
        "policy_attestation_mismatch",
        "policy_attestation_expired",
        "identity_or_grant_unknown",
        "limits_unknown",
        "health_unknown",
        "usage_unknown",
        "quota_exhausted",
        "identity_or_usage_unknown",
        "invalid_policy_definition",
        "invalid_commercial_terms",
        "provider_unknown",
        "provider_halted",
        "usage_stale",
        "invalid_account_binding",
      ]);
      if (!known.has(error.message)) return null;
      return {
        status: 409,
        code: error.message,
        message:
          "The campaign could not be updated. Review its current policy and account readiness.",
      };
    },
  });
  return (request) =>
    handler(request, { params: Promise.resolve({ id: "campaigns" }) });
}
