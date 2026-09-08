import { z } from "zod";

import type { FounderSession } from "../auth/require-founder";
import { renderClientThankYouSnapshot } from "../clients/client-thank-you";
import type { GrowthDb } from "../db/types";
import { postgresEngagementTransitionRepository } from "./engagement-repository";
import {
  COMMERCIAL_STAGES,
  COMMERCIAL_STAGES_THAT_STOP_OUTREACH,
  DELIVERY_STATUSES,
  isPermittedCommercialTransition,
  isPermittedDeliveryTransition,
  type CommercialStage,
  type DeliveryStatus,
} from "./stages";

const ENGAGEMENT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FOUNDER_ACTOR_ID_PATTERN = /^[0-9a-f]{64}$/;
const CORRELATION_ID_MAX_LENGTH = 200;

const reasonCodeSchema = z.string().trim().min(1).max(200);
const moneyPenceSchema = z.number().int().min(0);

const commercialTransitionInputSchema = z.object({
  dimension: z.literal("commercial"),
  engagementId: z.string().regex(ENGAGEMENT_ID_PATTERN),
  expectedVersion: z.number().int().positive(),
  toStage: z.enum(COMMERCIAL_STAGES),
  reasonCode: reasonCodeSchema.optional(),
  oneOffValuePence: moneyPenceSchema.optional(),
  monthlyValuePence: moneyPenceSchema.optional(),
});

const deliveryTransitionInputSchema = z.object({
  dimension: z.literal("delivery"),
  engagementId: z.string().regex(ENGAGEMENT_ID_PATTERN),
  expectedVersion: z.number().int().positive(),
  toStatus: z.enum(DELIVERY_STATUSES),
  reasonCode: reasonCodeSchema.optional(),
  // Only consulted when toStatus is "complete", and only on the first such
  // transition for the engagement (see hasClientThankYou below). Ignored
  // otherwise.
  includeNewsletterInvite: z.boolean().optional(),
});

export const transitionEngagementInputSchema = z
  .discriminatedUnion("dimension", [
    commercialTransitionInputSchema,
    deliveryTransitionInputSchema,
  ])
  .superRefine((input, ctx) => {
    if (input.dimension === "commercial") {
      if (
        input.toStage === "won" &&
        (input.oneOffValuePence ?? 0) + (input.monthlyValuePence ?? 0) <= 0
      ) {
        ctx.addIssue({
          code: "custom",
          message: "A won stage requires a one-off or monthly value.",
          path: ["oneOffValuePence"],
        });
      }
      if (input.toStage === "lost" && !input.reasonCode) {
        ctx.addIssue({
          code: "custom",
          message: "A lost stage requires a reason.",
          path: ["reasonCode"],
        });
      }
      return;
    }

    if (input.toStatus === "cancelled" && !input.reasonCode) {
      ctx.addIssue({
        code: "custom",
        message: "A cancelled delivery requires a reason.",
        path: ["reasonCode"],
      });
    }
  });

export type TransitionEngagementInput = z.infer<
  typeof transitionEngagementInputSchema
>;

export type TransitionEngagementContext = { correlationId: string } & (
  | { founder: FounderSession; system?: never }
  | { system: "operations-signing"; founder?: never }
);

export type LockedEngagement = {
  id: string;
  prospectId: string;
  version: number;
  stage: CommercialStage;
  deliveryStatus: DeliveryStatus;
};

export type ApplyCommercialTransitionInput = {
  engagementId: string;
  toStage: CommercialStage;
  wonAt: Date | null;
  lostAt: Date | null;
  lossReason: string | null;
  oneOffValuePence: number | null;
  monthlyValuePence: number | null;
};

export type ApplyDeliveryTransitionInput = {
  engagementId: string;
  toStatus: DeliveryStatus;
};

export type InsertStageEventInput = {
  engagementId: string;
  dimension: "commercial" | "delivery";
  fromState: string;
  toState: string;
  reasonCode: string | null;
  actorId: string;
  actorType?: "founder" | "system";
  correlationId: string;
};

export type StopActiveOutreachResult = { stoppedCount: number };

export type AppendTransitionAuditInput = {
  correlationId: string;
  actorId: string;
  actorType?: "founder" | "system";
  engagementId: string;
  dimension: "commercial" | "delivery";
  toState: string;
};

export type WonRecipientForThankYou = {
  contactId: string;
  firstName: string;
  engagementName: string;
  alreadySubscribed: boolean;
};

export type CreateClientThankYouInput = {
  engagementId: string;
  recipientContactId: string;
  includedNewsletterInvite: boolean;
  subjectSnapshot: string;
  htmlSnapshot: string;
  textSnapshot: string;
  checksum: string;
  createdBy: string;
};

export interface EngagementTransitionTransaction {
  lockEngagement(engagementId: string): Promise<LockedEngagement | null>;
  applyCommercialTransition(
    input: ApplyCommercialTransitionInput,
  ): Promise<void>;
  applyDeliveryTransition(input: ApplyDeliveryTransitionInput): Promise<void>;
  insertStageEvent(input: InsertStageEventInput): Promise<void>;
  stopActiveOutreachForProspect(
    prospectId: string,
  ): Promise<StopActiveOutreachResult>;
  appendTransitionAudit(input: AppendTransitionAuditInput): Promise<void>;
  hasClientThankYou(engagementId: string): Promise<boolean>;
  getWonRecipientForThankYou(
    engagementId: string,
  ): Promise<WonRecipientForThankYou | null>;
  createClientThankYou(input: CreateClientThankYouInput): Promise<void>;
}

export interface EngagementTransitionRepository {
  withTransaction<T>(
    db: GrowthDb,
    operation: (transaction: EngagementTransitionTransaction) => Promise<T>,
  ): Promise<T>;
}

export type TransitionEngagementResult = {
  engagementId: string;
  dimension: "commercial" | "delivery";
  stage: CommercialStage;
  deliveryStatus: DeliveryStatus;
  alreadyApplied: boolean;
};

export type TransitionEngagementErrorCode =
  | "not_found"
  | "version_conflict"
  | "invalid_transition"
  | "delivery_requires_won";

export class TransitionEngagementError extends Error {
  constructor(readonly code: TransitionEngagementErrorCode) {
    super("The engagement could not be transitioned.");
    this.name = "TransitionEngagementError";
  }
}

function resolveActor(
  context: TransitionEngagementContext,
  input: TransitionEngagementInput,
): { actorId: string; actorType?: "system" } {
  if (
    !context.correlationId.trim() ||
    context.correlationId.length > CORRELATION_ID_MAX_LENGTH
  ) {
    throw new TypeError("Engagement transition context is invalid.");
  }
  if (context.system === "operations-signing" && !context.founder) {
    if (
      input.dimension !== "commercial" ||
      input.toStage !== "won" ||
      input.reasonCode !== "agreement_signed"
    ) {
      throw new TypeError(
        "Signing may only complete a signed commercial agreement.",
      );
    }
    return { actorId: "operations-signing", actorType: "system" };
  }
  if (
    !context.founder ||
    context.system ||
    !FOUNDER_ACTOR_ID_PATTERN.test(context.founder.actorId)
  ) {
    throw new TypeError("Engagement transition context is invalid.");
  }
  return { actorId: context.founder.actorId };
}

type EngagementTransitionerDependencies = {
  repository: EngagementTransitionRepository;
  now?: () => Date;
};

export function createEngagementTransitioner({
  repository,
  now = () => new Date(),
}: EngagementTransitionerDependencies) {
  return async function transitionEngagement(
    db: GrowthDb,
    rawInput: unknown,
    context: TransitionEngagementContext,
  ): Promise<TransitionEngagementResult> {
    const input = transitionEngagementInputSchema.parse(rawInput);
    const actor = resolveActor(context, input);

    return repository.withTransaction(db, async (transaction) => {
      const engagement = await transaction.lockEngagement(input.engagementId);
      if (!engagement) throw new TransitionEngagementError("not_found");

      if (input.dimension === "commercial") {
        if (engagement.stage === input.toStage) {
          return {
            engagementId: engagement.id,
            dimension: "commercial",
            stage: engagement.stage,
            deliveryStatus: engagement.deliveryStatus,
            alreadyApplied: true,
          };
        }
        if (engagement.version !== input.expectedVersion) {
          throw new TransitionEngagementError("version_conflict");
        }
        if (!isPermittedCommercialTransition(engagement.stage, input.toStage)) {
          throw new TransitionEngagementError("invalid_transition");
        }

        const fromStage = engagement.stage;
        const transitionTime = now();
        await transaction.applyCommercialTransition({
          engagementId: engagement.id,
          toStage: input.toStage,
          wonAt: input.toStage === "won" ? transitionTime : null,
          lostAt: input.toStage === "lost" ? transitionTime : null,
          lossReason:
            input.toStage === "lost" ? (input.reasonCode ?? null) : null,
          oneOffValuePence: input.oneOffValuePence ?? null,
          monthlyValuePence: input.monthlyValuePence ?? null,
        });

        await transaction.insertStageEvent({
          engagementId: engagement.id,
          dimension: "commercial",
          fromState: fromStage,
          toState: input.toStage,
          reasonCode: input.reasonCode ?? null,
          ...actor,
          correlationId: context.correlationId,
        });

        if (COMMERCIAL_STAGES_THAT_STOP_OUTREACH.has(input.toStage)) {
          await transaction.stopActiveOutreachForProspect(
            engagement.prospectId,
          );
        }

        await transaction.appendTransitionAudit({
          correlationId: context.correlationId,
          ...actor,
          engagementId: engagement.id,
          dimension: "commercial",
          toState: input.toStage,
        });

        return {
          engagementId: engagement.id,
          dimension: "commercial",
          stage: input.toStage,
          deliveryStatus: engagement.deliveryStatus,
          alreadyApplied: false,
        };
      }

      if (engagement.deliveryStatus === input.toStatus) {
        return {
          engagementId: engagement.id,
          dimension: "delivery",
          stage: engagement.stage,
          deliveryStatus: engagement.deliveryStatus,
          alreadyApplied: true,
        };
      }
      if (engagement.version !== input.expectedVersion) {
        throw new TransitionEngagementError("version_conflict");
      }
      if (engagement.stage !== "won") {
        throw new TransitionEngagementError("delivery_requires_won");
      }
      if (
        !isPermittedDeliveryTransition(
          engagement.deliveryStatus,
          input.toStatus,
        )
      ) {
        throw new TransitionEngagementError("invalid_transition");
      }

      const fromStatus = engagement.deliveryStatus;
      await transaction.applyDeliveryTransition({
        engagementId: engagement.id,
        toStatus: input.toStatus,
      });

      await transaction.insertStageEvent({
        engagementId: engagement.id,
        dimension: "delivery",
        fromState: fromStatus,
        toState: input.toStatus,
        reasonCode: input.reasonCode ?? null,
        ...actor,
        correlationId: context.correlationId,
      });

      if (
        input.toStatus === "complete" &&
        !(await transaction.hasClientThankYou(engagement.id))
      ) {
        const recipient = await transaction.getWonRecipientForThankYou(
          engagement.id,
        );
        if (recipient) {
          const includeInvite =
            Boolean(input.includeNewsletterInvite) &&
            !recipient.alreadySubscribed;
          const snapshot = await renderClientThankYouSnapshot({
            firstName: recipient.firstName,
            engagementName: recipient.engagementName,
            includeNewsletterInvite: includeInvite,
          });
          await transaction.createClientThankYou({
            engagementId: engagement.id,
            recipientContactId: recipient.contactId,
            includedNewsletterInvite: includeInvite,
            subjectSnapshot: snapshot.subject,
            htmlSnapshot: snapshot.html,
            textSnapshot: snapshot.text,
            checksum: snapshot.checksum,
            createdBy: actor.actorId,
          });
        }
      }

      await transaction.appendTransitionAudit({
        correlationId: context.correlationId,
        ...actor,
        engagementId: engagement.id,
        dimension: "delivery",
        toState: input.toStatus,
      });

      return {
        engagementId: engagement.id,
        dimension: "delivery",
        stage: engagement.stage,
        deliveryStatus: input.toStatus,
        alreadyApplied: false,
      };
    });
  };
}

export const transitionEngagement = createEngagementTransitioner({
  repository: postgresEngagementTransitionRepository,
});
