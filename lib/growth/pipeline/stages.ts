export const COMMERCIAL_STAGES = [
  "new",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;
export type CommercialStage = (typeof COMMERCIAL_STAGES)[number];

export const DELIVERY_STATUSES = [
  "not_started",
  "discovery",
  "build",
  "review",
  "complete",
  "support",
  "cancelled",
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

// A prospect moves forward one stage at a time, or drops to lost from any
// open stage. Won and lost are dead ends: a later opportunity for the same
// business is a new prospect and engagement, not a reopened one.
export const COMMERCIAL_TRANSITIONS: Record<
  CommercialStage,
  readonly CommercialStage[]
> = {
  new: ["qualified", "lost"],
  qualified: ["proposal", "lost"],
  proposal: ["negotiation", "lost"],
  negotiation: ["won", "lost"],
  won: [],
  lost: [],
};

// Delivery only starts once the commercial stage is won (enforced by the
// schema's delivery_engagement_delivery_requires_won check, not here). A
// complete delivery can still advance into ongoing support; cancellation is
// only available from the documented in-progress states.
export const DELIVERY_TRANSITIONS: Record<
  DeliveryStatus,
  readonly DeliveryStatus[]
> = {
  not_started: ["discovery", "cancelled"],
  discovery: ["build", "cancelled"],
  build: ["review", "cancelled"],
  review: ["complete", "cancelled"],
  complete: ["support"],
  support: [],
  cancelled: [],
};

// The one side effect the commercial dimension has outside its own table:
// once a prospect leaves "new", active automated outreach stops. Every
// permitted commercial target lands in this set, since "new" only ever
// moves to "qualified" or "lost".
export const COMMERCIAL_STAGES_THAT_STOP_OUTREACH = new Set<CommercialStage>([
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
]);

export function isPermittedCommercialTransition(
  from: CommercialStage,
  to: CommercialStage,
): boolean {
  return COMMERCIAL_TRANSITIONS[from].includes(to);
}

export function isPermittedDeliveryTransition(
  from: DeliveryStatus,
  to: DeliveryStatus,
): boolean {
  return DELIVERY_TRANSITIONS[from].includes(to);
}

export function permittedCommercialTargets(
  from: CommercialStage,
): readonly CommercialStage[] {
  return COMMERCIAL_TRANSITIONS[from];
}

export function permittedDeliveryTargets(
  from: DeliveryStatus,
): readonly DeliveryStatus[] {
  return DELIVERY_TRANSITIONS[from];
}
