import { randomUUID } from "node:crypto";
import { requireFounder } from "@/lib/growth/auth/require-founder";
import { readGrowthServerEnv } from "@/lib/growth/config/env";
import { getMessageReview } from "@/lib/growth/dashboard/message-review";
import { createMessageReviewHandler } from "@/lib/growth/dashboard/message-review-route";
import { readMessageActionRouteConfig } from "../../../runtime";

export const runtime = "nodejs";

export const GET = createMessageReviewHandler({
  authorizeFounder: requireFounder,
  loadReview: (draftTaskId) =>
    getMessageReview(
      draftTaskId,
      readGrowthServerEnv().ownerEmail,
      readMessageActionRouteConfig().origin,
    ),
  createCorrelationId: randomUUID,
  reportUnexpectedError: ({ correlationId, error }) => {
    console.error("Growth OS message review failed.", {
      correlationId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  },
});
