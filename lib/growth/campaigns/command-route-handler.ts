import { z } from "zod";
import { campaignPolicyDefinitionSchema } from "./schemas";
import { readEditableCampaignPolicy } from "./campaign-policy-editor";
import { requireCampaignFounder } from "./authorization";
import {
  websiteServiceOffers,
  isWebsiteServiceOffer,
} from "./website-service-offers";
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
const evidence = z.strictObject({
  summary: z.string().trim().min(1).max(2000),
  reference: z.discriminatedUnion("kind", [
    z.strictObject({
      kind: z.literal("private"),
      value: z.string().trim().min(1).max(500),
    }),
    z.strictObject({ kind: z.literal("public"), value: z.url() }),
  ]),
  observedAt: z.iso.datetime({ offset: true }),
  expiresAt: z.iso.datetime({ offset: true }),
});
const editor = z
  .strictObject({
    offer: z.enum([
      "review",
      "website_preview",
      "lead_review_essentials_v1",
      "booking_recovery_v1",
      "ai_front_desk_v1",
    ]),
    provider: z.enum(["gmail", "resend"]),
    accountSelection: z
      .union([z.literal("keep"), z.literal("unbound"), z.uuid()])
      .default("keep"),
    jurisdiction: z.string().length(2),
    permissionRequirement: z.enum(["consent", "requested_service"]),
    effectiveAt: z.iso.datetime({ offset: true }),
    expiresAt: z.iso.datetime({ offset: true }),
    ctaA: z.string().trim().min(1).max(500).regex(/\?$/),
    ctaB: z.string().trim().min(1).max(500).regex(/\?$/),
    capability: evidence,
    providerEvidence: evidence,
    providerConfirmed: z.literal(true),
    hardBounces: z.number().int().nonnegative(),
    complaints: z.number().int().nonnegative(),
  })
  .refine((value) => value.ctaA !== value.ctaB);
const lifecycleCommand = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("approve"), ...fields }),
  z.strictObject({ type: z.literal("pause"), ...fields }),
  z.strictObject({ type: z.literal("resume"), ...fields }),
  z.strictObject({
    type: z.literal("create"),
    requestId: z.uuid(),
    name: z.string().trim().min(1).max(200),
    editor,
  }),
  z.strictObject({ type: z.literal("revise"), ...fields, editor }),
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
    action: async ({ body, founder, correlationId }) => {
      const execute = dependencies.execute ?? executeCampaignCommand;
      if (body.type !== "create" && body.type !== "revise")
        return execute(dependencies.db, body, founder, correlationId);
      requireCampaignFounder(founder);
      let previous: z.infer<typeof campaignPolicyDefinitionSchema> | null =
        null;
      if (body.type === "revise") {
        const [row] = await dependencies.db<{ policy: unknown }[]>`
          select policy from growth.campaigns where id=${body.campaignId} and version=${body.policyVersion}
        `;
        if (!row) throw new Error("policy_version_changed");
        const editable = readEditableCampaignPolicy(row.policy);
        if (!editable) throw new Error("unsupported_stored_policy");
        previous = editable.policy;
        if (
          previous.accountConnectionId &&
          previous.provider !== body.editor.provider &&
          body.editor.accountSelection === "keep"
        )
          throw new Error("bound_provider_changed");
      }
      const input = body.editor;
      const variantVersion =
        previous?.variants.length === 2
          ? Math.max(
              previous.variants[0]!.version,
              previous.variants[1]!.version,
            ) +
            (previous.variants[0]!.cta === input.ctaA &&
            previous.variants[1]!.cta === input.ctaB
              ? 0
              : 1)
          : 1;
      const policyResult = campaignPolicyDefinitionSchema.safeParse({
        ...previous,
        version: body.type === "create" ? 1 : body.policyVersion + 1,
        status: "paused",
        approvedAt: null,
        approverId: null,
        accountConnectionId:
          input.accountSelection === "keep"
            ? (previous?.accountConnectionId ?? null)
            : input.accountSelection === "unbound"
              ? null
              : input.accountSelection,
        offer: input.offer,
        commercialTerms: isWebsiteServiceOffer(input.offer)
          ? websiteServiceOffers[input.offer]
          : undefined,
        provider: input.provider,
        jurisdiction: input.jurisdiction,
        permissionRequirement: input.permissionRequirement,
        effectiveAt: input.effectiveAt,
        expiresAt: input.expiresAt,
        capabilityEvidence: input.capability.reference.value,
        capabilityAttestation: input.capability,
        providerAttestation: {
          ...input.providerEvidence,
          provider: input.provider,
          jurisdiction: input.jurisdiction,
          confirmed: input.providerConfirmed,
        },
        haltThresholds: {
          hardBounces: input.hardBounces,
          complaints: input.complaints,
        },
        cadenceFamily: input.offer === "review" ? "review" : "website",
        variants: [
          {
            id: previous?.variants[0]?.id ?? "a",
            version: variantVersion,
            cta: input.ctaA,
          },
          {
            id:
              previous?.variants[1]?.id ??
              (previous?.variants[0]?.id === "b" ? "a" : "b"),
            version: variantVersion,
            cta: input.ctaB,
          },
        ],
      });
      if (!policyResult.success) throw new Error("invalid_policy_definition");
      const policy = policyResult.data;
      return body.type === "create"
        ? execute(
            dependencies.db,
            {
              type: "create",
              requestId: body.requestId,
              name: body.name,
              policy,
            },
            founder,
            correlationId,
          )
        : execute(
            dependencies.db,
            {
              type: "revise",
              requestId: body.requestId,
              campaignId: body.campaignId,
              policyVersion: body.policyVersion,
              policy,
            },
            founder,
            correlationId,
          );
    },
    mapActionError: (error) => {
      if (!(error instanceof Error)) return null;
      const known = new Set([
        "unsupported_stored_policy",
        "bound_provider_changed",
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
