"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type GrowthEventState =
  | "connecting"
  | "ready"
  | "unconfigured"
  | "error"
  | "auth-failed";
export type GrowthRefresh = (
  signal: AbortSignal,
  onAuthFailure: () => void,
) => Promise<"ok" | "auth-failed" | "error" | "superseded">;

/** Keep refresh stable with useCallback; change it when the current view changes. */
export function useGrowthEvents(refresh: GrowthRefresh): {
  state: GrowthEventState;
  invalidate: () => void;
  stopForAuth: () => void;
} {
  const [state, setState] = useState<GrowthEventState>("connecting");
  const terminalAuth = useRef(false);
  const invalidateRef = useRef<() => void>(() => {});
  const stopRef = useRef<() => void>(() => {});
  const invalidate = useCallback(() => invalidateRef.current(), []);
  const stopForAuth = useCallback(() => stopRef.current(), []);
  useEffect(() => {
    if (terminalAuth.current) return;
    const abort = new AbortController();
    let source: EventSource;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let backoff = 1000,
      running = false,
      dirty = false,
      stopped = false,
      connected = false,
      unconfigured = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      terminalAuth.current = true;
      abort.abort();
      source.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      setState("auth-failed");
    };
    const run = async () => {
      dirty = true;
      if (running || stopped) return;
      running = true;
      while (dirty && !stopped) {
        dirty = false;
        let result: Awaited<ReturnType<GrowthRefresh>>;
        try {
          result = await refresh(abort.signal, stopForAuth);
        } catch {
          result = "error";
        }
        if (stopped) break;
        if (result === "auth-failed") stop();
        else if (result === "error") setState("error");
        else if (result === "ok")
          setState(
            unconfigured ? "unconfigured" : connected ? "ready" : "connecting",
          );
      }
      running = false;
    };
    invalidateRef.current = () => {
      void run();
    };
    stopRef.current = stop;
    const connect = () => {
      if (stopped) return;
      source = new EventSource("/api/growth/events");
      source.addEventListener("ready", () => {
        connected = true;
        backoff = 1000;
        void run();
      });
      source.addEventListener("change", () => {
        void run();
      });
      source.addEventListener("unconfigured", () => {
        source.close();
        connected = false;
        unconfigured = true;
        setState("unconfigured");
        void run();
      });
      source.onerror = () => {
        if (stopped || unconfigured) return;
        source.close();
        connected = false;
        setState("connecting");
        void run();
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
      invalidateRef.current = () => {};
      stopRef.current = () => {};
    };
  }, [refresh, stopForAuth]);
  return { state, invalidate, stopForAuth };
}
