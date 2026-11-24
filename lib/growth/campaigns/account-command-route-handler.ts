import { z } from "zod";
import { healthReviewSchema, limitsReviewSchema } from "./account-contracts";
import { requireFounder, type FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import {
  createMessageActionHandler,
  type MessageActionRouteConfig,
} from "../sequences/message-action-route";
import { requireCampaignFounder } from "./authorization";
import { executeAccountControlCommand } from "./account-control";
import { executeResendAccountCommand } from "./resend-account-control";
import { readResendOutreachRuntime } from "./resend-account-runtime";
import { resendBindingSchema } from "./resend-account-readiness";

const common = {
  provider: z.enum(["gmail", "resend"]),
  requestId: z.uuid(),
  expectedVersion: z.number().int().positive(),
};
const tier = z.union([
  z.literal(25),
  z.literal(50),
  z.literal(100),
  z.literal(150),
]);
const commandSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("activate"), ...common }),
  z.strictObject({
    action: z.literal("record_health"),
    ...common,
    evidence: healthReviewSchema,
  }),
  z.strictObject({
    action: z.literal("record_limits"),
    provider: z.literal("gmail"),
    requestId: z.uuid(),
    expectedVersion: z.number().int().positive(),
    evidence: limitsReviewSchema,
  }),
  z.strictObject({
    action: z.literal("revalidate_grant"),
    provider: z.literal("gmail"),
    requestId: z.uuid(),
    expectedVersion: z.number().int().positive(),
    expectedGrantVersion: z.number().int().positive(),
  }),
  z.strictObject({
    action: z.literal("halt"),
    ...common,
    reason: z.string().trim().min(1).max(500),
  }),
  z.strictObject({ action: z.literal("approve_ramp"), ...common, ramp: tier }),
  z.strictObject({ action: z.literal("reduce_ramp"), ...common, ramp: tier }),
  z.strictObject({
    action: z.literal("configure"),
    provider: z.literal("resend"),
    requestId: z.uuid(),
    expectedVersion: z.number().int().nonnegative(),
  }),
]);
export function createAccountCommandHandler(deps: {
  db: GrowthDb;
  config: MessageActionRouteConfig;
  authorizeFounder?: () => Promise<FounderSession>;
  createCorrelationId: () => string;
  reportUnexpectedError: (report: {
    correlationId: string;
    error: unknown;
  }) => void;
  executeGmail?: typeof executeAccountControlCommand;
  executeResend?: typeof executeResendAccountCommand;
  readRuntime?: typeof readResendOutreachRuntime;
}): (request: Request) => Promise<Response> {
  const handler = createMessageActionHandler({
    config: deps.config,
    authorizeFounder: deps.authorizeFounder ?? requireFounder,
    bodySchema: commandSchema,
    createCorrelationId: deps.createCorrelationId,
    reportUnexpectedError: deps.reportUnexpectedError,
    action: async ({ body, founder, correlationId }) => {
      requireCampaignFounder(founder);
      if (body.provider === "gmail") {
        const execute = deps.executeGmail ?? executeAccountControlCommand;
        const base = {
          requestId: body.requestId,
          expectedVersion: body.expectedVersion,
        };
        if (body.action === "record_limits")
          return execute(
            deps.db,
            { type: body.action, ...base, evidence: body.evidence },
            founder,
            correlationId,
          );
        if (body.action === "record_health")
          return execute(
            deps.db,
            { type: "record_health", ...base, evidence: body.evidence },
            founder,
            correlationId,
          );
        if (body.action === "revalidate_grant")
          return execute(
            deps.db,
            {
              type: "revalidate_grant",
              ...base,
              expectedGrantVersion: body.expectedGrantVersion,
            },
            founder,
            correlationId,
          );
        if (body.action === "activate")
          return execute(
            deps.db,
            { type: "activate", ...base },
            founder,
            correlationId,
          );
        if (body.action === "halt")
          return execute(
            deps.db,
            { type: "halt", ...base, reason: body.reason },
            founder,
            correlationId,
          );
        return execute(
          deps.db,
          { type: body.action, ...base, ramp: body.ramp },
          founder,
          correlationId,
        );
      }
      const runtime = (deps.readRuntime ?? readResendOutreachRuntime)();
      if (!runtime || runtime.binding.replyTo !== founder.email)
        throw new Error("runtime_binding_unknown");
      const [prior] = await deps.db<
        { connectionId: string; evidence: unknown }[]
      >`
        select connection_id as "connectionId",evidence from growth.outreach_account_reviews
        where request_id=${body.requestId} and actor_id=${founder.actorId}`;
      const execute = deps.executeResend ?? executeResendAccountCommand;
      if (body.action === "configure") {
        const priorBinding = z
          .object({ binding: resendBindingSchema })
          .safeParse(prior?.evidence);
        if (prior && !priorBinding.success) throw new Error("request_conflict");
        return execute(
          deps.db,
          {
            type: "resend_configure",
            requestId: body.requestId,
            expectedVersion: body.expectedVersion,
            binding: priorBinding.success
              ? priorBinding.data.binding
              : runtime.binding,
          },
          founder,
          correlationId,
          runtime,
        );
      }
      const [current] = prior
        ? []
        : await deps.db<{ id: string }[]>`
        select i.id from growth.integration_connections i join growth.outreach_account_controls c on c.connection_id=i.id and c.provider='resend'
        where i.provider='resend' and i.subject_email=${runtime.binding.sender} and c.resend_team=${runtime.binding.team} and c.resend_environment=${runtime.binding.environment} limit 1`;
      const connectionId = prior?.connectionId ?? current?.id;
      if (!connectionId) throw new Error("account_identity_unknown");
      const base = {
        requestId: body.requestId,
        expectedVersion: body.expectedVersion,
        connectionId,
      };
      if (body.action === "record_health")
        return execute(
          deps.db,
          { type: "record_health", ...base, evidence: body.evidence },
          founder,
          correlationId,
          runtime,
        );
      if (body.action === "activate")
        return execute(
          deps.db,
          { type: "activate", ...base },
          founder,
          correlationId,
          runtime,
        );
      if (body.action === "halt")
        return execute(
          deps.db,
          { type: "halt", ...base, reason: body.reason },
          founder,
          correlationId,
          runtime,
        );
      return execute(
        deps.db,
        { type: body.action, ...base, ramp: body.ramp },
        founder,
        correlationId,
        runtime,
      );
    },
    mapActionError: (error) => {
      if (!(error instanceof Error)) return null;
      const known = new Set([
        "account_version_changed",
        "account_identity_unknown",
        "account_identity_changed",
        "account_authority_changed",
        "account_not_activated",
        "account_not_active",
        "invalid_ramp_reduction",
        "invalid_ramp_step",
        "health_review_reused",
        "identity_or_grant_unknown",
        "identity_or_configuration_unknown",
        "identity_or_usage_unknown",
        "limits_unknown",
        "health_unknown",
        "usage_unknown",
        "visibility_unknown",
        "quota_exhausted",
        "runtime_binding_unknown",
        "request_conflict",
        "grant_version_changed",
        "invalid_limits_time",
        "invalid_visibility_time",
        "invalid_health_time",
        "invalid_health_review",
        "inconsistent_health_counts",
      ]);
      return known.has(error.message)
        ? {
            status: 409,
            code: error.message,
            message:
              "Account action could not be completed. Review the current account state and evidence.",
          }
        : null;
    },
  });
  return (request) =>
    handler(request, { params: Promise.resolve({ id: "accounts" }) });
}
