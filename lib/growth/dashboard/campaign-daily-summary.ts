import type { FounderSession } from "../auth/require-founder";
import { requireCampaignFounder } from "../campaigns/authorization";
import {
  readLatestDailyOutreachSummary,
  type DailyOutreachSummary,
} from "../campaigns/daily-summary";
import { getGrowthDb } from "../db/client";
import type { GrowthDb } from "../db/types";
import { formatGrowthCalendarDate, formatGrowthDateTime } from "./formatters";

export type CampaignDailySummaryResult =
  | { status: "ready"; summary: DailyOutreachSummary }
  | { status: "empty" }
  | { status: "unavailable" };

export async function getCampaignDailySummary(
  founder: FounderSession,
  db?: GrowthDb,
): Promise<CampaignDailySummaryResult> {
  requireCampaignFounder(founder);
  try {
    const summary = await readLatestDailyOutreachSummary(db ?? getGrowthDb());
    if (!summary) return { status: "empty" };
    formatGrowthCalendarDate(summary.londonDay);
    formatGrowthDateTime(summary.generatedAt);
    return { status: "ready", summary };
  } catch {
    return { status: "unavailable" };
  }
}
