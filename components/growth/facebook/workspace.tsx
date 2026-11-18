"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useGrowthEvents } from "@/lib/growth/client/use-growth-events";
import { FacebookAuthFailureContext } from "./command-form";
import { DestinationRow } from "./destination-row";
import { readWorkspace } from "./read-workspace";
import { DestinationCapture } from "./destination-forms";
import { useRulesExpiry } from "./use-rules-expiry";
import type { Destination, ReadyWorkspace } from "./types";
import styles from "./facebook.module.css";

export function FacebookWorkspace() {
  const [workspace, setWorkspace] = useState<ReadyWorkspace | null>(null);
  const [retained, setRetained] = useState<Destination[]>([]);
  const retainedRef = useRef<Destination[]>([]);
  const [resetKeys, setResetKeys] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Destination | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("selectedId"),
  );
  const [error, setError] = useState("");
  const generation = useRef(0);
  const pageAbort = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const terminalAuth = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pageAbort.current?.abort();
    };
  }, []);
  const establishAuthFailure = useCallback((stop: () => void) => {
    if (!mounted.current || terminalAuth.current) return;
    terminalAuth.current = true;
    generation.current++;
    pageAbort.current?.abort();
    stop();
    setError("Session expired. Sign in again.");
  }, []);
  const refresh = useCallback(
    async (
      signal: AbortSignal,
      stop: () => void,
    ): Promise<"ok" | "error" | "auth-failed" | "superseded"> => {
      const current = ++generation.current;
      const onAuthFailure = () => establishAuthFailure(stop);
      try {
        const ids = [
          ...new Set([
            ...retainedRef.current.map((item) => item.id),
            ...(selectedId ? [selectedId] : []),
          ]),
        ];
        const [page, ...selections] = await Promise.all([
          readWorkspace("", signal, onAuthFailure),
          ...ids.map((id) =>
            readWorkspace(
              `?selectedId=${encodeURIComponent(id)}`,
              signal,
              onAuthFailure,
            ),
          ),
        ]);
        const checked = new Set(ids);
        const found = [
          ...selections.flatMap((selection) => selection.destinations),
          ...page.destinations,
        ];
        // A form can become active while the snapshot is in flight. Fetch any
        // newly retained off-page rows before applying the snapshot.
        while (true) {
          if (signal.aborted || current !== generation.current)
            return "superseded";
          const missing = retainedRef.current
            .map((item) => item.id)
            .filter(
              (id) => !checked.has(id) && !found.some((item) => item.id === id),
            );
          if (missing.length === 0) break;
          missing.forEach((id) => checked.add(id));
          const additional = await Promise.all(
            missing.map((id) =>
              readWorkspace(
                `?selectedId=${encodeURIComponent(id)}`,
                signal,
                onAuthFailure,
              ),
            ),
          );
          found.push(
            ...additional.flatMap((selection) => selection.destinations),
          );
        }
        if (signal.aborted || current !== generation.current)
          return "superseded";
        setWorkspace(page);
        setSelected(found.find((item) => item.id === selectedId) ?? null);
        const updated = retainedRef.current.map(
          (item) => found.find((latest) => latest.id === item.id) ?? item,
        );
        retainedRef.current = updated;
        setRetained(updated);
        setError("");
        return "ok";
      } catch (e) {
        if (!signal.aborted && current === generation.current)
          setError(
            e instanceof Error && e.message === "auth"
              ? "Session expired. Sign in again."
              : "Workspace could not load. Try refresh.",
          );
        if (signal.aborted || current !== generation.current)
          return "superseded";
        return e instanceof Error && e.message === "auth"
          ? "auth-failed"
          : "error";
      }
    },
    [selectedId, establishAuthFailure],
  );
  const {
    state: live,
    invalidate: manualRefresh,
    stopForAuth,
  } = useGrowthEvents(refresh);
  const authFailed = () => establishAuthFailure(stopForAuth);
  const saved = (id: string) => {
    if (selectedId === id) manualRefresh();
    else setSelectedId(id);
  };
  const retain = (item: Destination) => {
    if (retainedRef.current.some((existing) => existing.id === item.id)) return;
    retainedRef.current = [...retainedRef.current, item];
    setRetained(retainedRef.current);
  };
  const release = (id: string) => {
    retainedRef.current = retainedRef.current.filter((item) => item.id !== id);
    setRetained(retainedRef.current);
  };
  const discard = (id: string) => {
    retainedRef.current = retainedRef.current.filter((item) => item.id !== id);
    setRetained(retainedRef.current);
    setResetKeys((keys) => ({ ...keys, [id]: (keys[id] ?? 0) + 1 }));
  };
  const pageRows = workspace
    ? [
        ...retained.filter(
          (item) => !workspace.destinations.some((d) => d.id === item.id),
        ),
        ...(selected &&
        !retained.some((d) => d.id === selected.id) &&
        !workspace.destinations.some((d) => d.id === selected.id)
          ? [selected]
          : []),
        ...workspace.destinations,
      ]
    : [];
  const rows = pageRows.map(
    (item) => retained.find((entry) => entry.id === item.id) ?? item,
  );
  const now = useRulesExpiry(rows, manualRefresh);
  return (
    <FacebookAuthFailureContext.Provider value={authFailed}>
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1>Facebook</h1>
            <p className={styles.subtitle}>
              Public discovery and manual activity. Record actions after you
              perform them.
            </p>
          </div>
          <details>
            <summary id="add-destination" className={styles.primary}>
              Add destination
            </summary>
            <DestinationCapture saved={saved} />
          </details>
        </header>
        <p role="status">
          Live updates:{" "}
          {live === "ready"
            ? "connected"
            : live === "unconfigured"
              ? "unavailable; use refresh"
              : live === "auth-failed"
                ? "session expired"
                : live}
          .{" "}
          <button
            type="button"
            className={styles.secondary}
            onClick={manualRefresh}
            disabled={live === "auth-failed"}
          >
            Refresh
          </button>
        </p>
        {error && (
          <p role="alert">
            {error}{" "}
            {live === "auth-failed" && <a href="/growth/login">Sign in</a>}
          </p>
        )}
        {!workspace && !error && <p>Loading destinations…</p>}
        {workspace && (
          <>
            <section className={styles.pilot}>
              <h2>Private pilots</h2>
              <p>
                {workspace.pilots.used} of {workspace.pilots.total} lifetime
                allocations used · {workspace.pilots.remaining} remaining.
              </p>
              <details>
                <summary>Allocation terms and recipients</summary>
                <p>
                  Each allocation is for a private one-page preview and one
                  accepted revision request. Allocation does not prove a preview
                  is complete or accessible. No payment is required; domain
                  ownership stays with the client.
                </p>
                <ul>
                  {workspace.pilots.allocations.map((a) => (
                    <li key={a.slot}>
                      <a href={`/growth/prospects/${a.prospectId}`}>{a.name}</a>{" "}
                      · slot {a.slot}
                    </li>
                  ))}
                </ul>
              </details>
            </section>
            <section aria-label="Destination directory">
              {rows.length === 0 && (
                <p>
                  No destinations recorded.{" "}
                  <a href="#add-destination">Add a destination</a> to begin.
                </p>
              )}
              {rows.map((item) => (
                <DestinationRow
                  key={`${item.id}:${resetKeys[item.id] ?? 0}`}
                  item={item}
                  saved={saved}
                  pilots={workspace.pilots}
                  retain={retain}
                  discard={discard}
                  release={release}
                  retained={retained.some((entry) => entry.id === item.id)}
                  refresh={manualRefresh}
                  keepVisible={(item) => {
                    setSelected(item);
                    setSelectedId(item.id);
                  }}
                  expiryPending={
                    item.postReadiness === "allowed" &&
                    !!item.review &&
                    Date.parse(item.review.expiresAt) <= now
                  }
                />
              ))}
              {workspace.nextCursor && (
                <button
                  type="button"
                  disabled={live === "auth-failed"}
                  onClick={async () => {
                    if (terminalAuth.current) return;
                    const current = ++generation.current;
                    pageAbort.current?.abort();
                    const abort = new AbortController();
                    pageAbort.current = abort;
                    try {
                      const next = await readWorkspace(
                        `?cursor=${encodeURIComponent(workspace.nextCursor ?? "")}`,
                        abort.signal,
                        authFailed,
                      );
                      if (
                        !abort.signal.aborted &&
                        current === generation.current
                      )
                        setWorkspace(next);
                    } catch (error) {
                      if (
                        !abort.signal.aborted &&
                        current === generation.current &&
                        !(error instanceof Error && error.name === "AbortError")
                      ) {
                        setError("Next page could not load. Try again.");
                      }
                    }
                  }}
                >
                  Next directory page
                </button>
              )}
            </section>
          </>
        )}
      </div>
    </FacebookAuthFailureContext.Provider>
  );
}
