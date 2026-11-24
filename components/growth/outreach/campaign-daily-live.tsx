"use client";
import { useCallback, useContext, useState, useSyncExternalStore } from "react";
import { dailySummaryResultSchema } from "@/lib/growth/campaigns/daily-summary-contract";
import { useGrowthEvents } from "@/lib/growth/client/use-growth-events";
import type { CampaignDailySummaryResult } from "@/lib/growth/dashboard/campaign-daily-summary";
import { CampaignDailySummary } from "./campaign-daily-summary";
import { OutreachVisibility } from "./outreach-visibility";

function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}
function documentVisible(): boolean {
  return document.visibilityState !== "hidden";
}
function serverVisible(): boolean {
  return true;
}

function DailySubscriber({
  onSummary,
}: {
  onSummary: (summary: CampaignDailySummaryResult) => void;
}) {
  const refresh = useCallback(
    async (
      signal: AbortSignal,
    ): Promise<"ok" | "error" | "auth-failed" | "superseded"> => {
      try {
        const response = await fetch("/api/growth/campaigns/daily-refresh", {
          cache: "no-store",
          signal,
        });
        if (response.status === 401) return "auth-failed";
        if (!response.ok) return "error";
        const payload: unknown = await response.json();
        const parsed = dailySummaryResultSchema.safeParse(payload);
        if (!parsed.success || parsed.data.status === "unavailable")
          return "error";
        if (signal.aborted) return "superseded";
        onSummary(parsed.data);
        return "ok";
      } catch {
        return signal.aborted ? "superseded" : "error";
      }
    },
    [onSummary],
  );
  const { state, invalidate } = useGrowthEvents(refresh, "daily-summary");
  return (
    <p role="status">
      Daily updates:{" "}
      {state === "ready"
        ? "connected"
        : state === "unconfigured"
          ? "unavailable"
          : state === "auth-failed"
            ? "session expired"
            : state}
      .{" "}
      {state === "auth-failed" ? (
        <a href="/growth/login">Sign in</a>
      ) : (
        <button type="button" onClick={invalidate}>
          Refresh
        </button>
      )}
    </p>
  );
}
export function CampaignDailyLive({
  initial,
}: {
  initial: CampaignDailySummaryResult;
}) {
  const visible = useContext(OutreachVisibility);
  const [summary, setSummary] = useState(initial);
  const documentIsVisible = useSyncExternalStore(
    subscribeVisibility,
    documentVisible,
    serverVisible,
  );
  return (
    <>
      {visible && documentIsVisible && (
        <DailySubscriber onSummary={setSummary} />
      )}
      <CampaignDailySummary result={summary} />
    </>
  );
}
