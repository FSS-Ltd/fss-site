"use client";

import { useEffect, useState } from "react";

export type GrowthEventState =
  | "connecting"
  | "ready"
  | "unconfigured"
  | "error"
  | "auth-failed";
export type GrowthRefresh = (
  signal: AbortSignal,
) => Promise<"ok" | "auth-failed" | "error">;

/** Keep refresh stable with useCallback; change it when the current view changes. */
export function useGrowthEvents(refresh: GrowthRefresh): GrowthEventState {
  const [state, setState] = useState<GrowthEventState>("connecting");
  useEffect(() => {
    const abort = new AbortController();
    let source: EventSource;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let backoff = 1000;
    let running = false;
    let dirty = false;
    let stopped = false;
    let connected = false;
    let unconfigured = false;
    const invalidate = async () => {
      dirty = true;
      if (running || stopped) return;
      running = true;
      while (dirty && !stopped) {
        dirty = false;
        let result: Awaited<ReturnType<GrowthRefresh>>;
        try {
          result = await refresh(abort.signal);
        } catch {
          result = "error";
        }
        if (stopped) break;
        if (result === "auth-failed") {
          stopped = true;
          source.close();
          if (reconnectTimer) clearTimeout(reconnectTimer);
          setState("auth-failed");
        } else if (result === "error") setState("error");
        else
          setState(
            unconfigured ? "unconfigured" : connected ? "ready" : "connecting",
          );
      }
      running = false;
    };
    const connect = () => {
      if (stopped) return;
      source = new EventSource("/api/growth/events");
      source.addEventListener("ready", () => {
        connected = true;
        backoff = 1000;
        void invalidate();
      });
      source.addEventListener("change", () => {
        void invalidate();
      });
      source.addEventListener("unconfigured", () => {
        source.close();
        connected = false;
        unconfigured = true;
        setState("unconfigured");
        void invalidate();
      });
      source.onerror = () => {
        if (stopped || unconfigured) return;
        source.close();
        connected = false;
        setState("connecting");
        void invalidate();
        const delay = backoff + Math.random() * backoff;
        backoff = Math.min(backoff * 2, 30000);
        reconnectTimer = setTimeout(connect, delay);
      };
    };
    connect();
    return () => {
      stopped = true;
      abort.abort();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      source.close();
    };
  }, [refresh]);
  return state;
}
