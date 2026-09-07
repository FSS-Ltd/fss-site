export const requestPriorities = ["low", "normal", "high", "urgent"] as const;
export type RequestPriority = (typeof requestPriorities)[number];
export const founderDeliveryOwnerId = "00000000-0000-4000-8000-000000000001";
export const requestStatuses = [
  "new",
  "acknowledged",
  "planned",
  "in_progress",
  "ready_for_review",
  "changes_requested",
  "done",
  "cancelled",
] as const;
export type RequestStatus = (typeof requestStatuses)[number];
export const requestScopes = [
  "included",
  "assessment_pending",
  "quote_required",
  "declined_with_reason",
] as const;
export type RequestScope = (typeof requestScopes)[number];
export class RequestConflict extends Error {
  constructor(message = "This request changed. Reload before trying again.") {
    super(message);
    this.name = "RequestConflict";
  }
}
export class RequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestValidationError";
  }
}
export type ClientRequest = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  type: "work" | "change" | "bug" | "help";
  desiredOutcome: string;
  desiredDate: string | null;
  impact: string;
  reproductionSteps: string;
  expectedBehaviour: string;
  actualBehaviour: string;
  status: RequestStatus;
  scope: RequestScope;
  scopeReason: string;
  ownerDisplay: string;
  nextAction: string;
  targetDate: string | null;
  version: number;
  reviewCycle: number;
  deliverableVersion: string | null;
  reviewInstructions: string;
  publicSummary: string;
  acknowledgementTarget: string;
  reviewReminderTarget: string | null;
  createdAt: string;
  blocked: {
    since: string;
    reason: string;
    responsibleParty: string;
    nextCheckDate: string;
  } | null;
  closureLabel: string | null;
};
export type RequestComment = {
  id: string;
  body: string;
  authorLabel: string;
  createdAt: string;
};
export type RequestReview = {
  documents: RequestDocument[];
  documentIds: string[];
  id: string;
  reviewCycle: number;
  deliverableVersion: string;
  decision: "requested" | "accepted" | "changes_requested";
  feedback: string;
  createdAt: string;
};
export type RequestDocument = import("../documents/types").ClientDocument;
export type RequestAllowance = {
  unit: "hours" | "tasks" | "milestones";
  total: number;
  adjustments: {
    id: string;
    amount: number;
    reason: string;
    approvalReference: string;
    createdAt: string;
  }[];
};
export type ClientRequestDetail = ClientRequest & {
  allowance: RequestAllowance | null;
  comments: RequestComment[];
  reviews: RequestReview[];
  documents: RequestDocument[];
  canReview: boolean;
};
export type RequestCommandResult = { id: string; version: number };
