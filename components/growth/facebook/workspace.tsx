"use client";
import { useCallback, useRef, useState } from "react";
import { useGrowthEvents } from "@/lib/growth/client/use-growth-events";
import { DestinationRow } from "./destination-row";
import { readWorkspace } from "./read-workspace";
import { DestinationCapture } from "./destination-forms";
import type { Destination, ReadyWorkspace } from "./types";
import styles from "./facebook.module.css";

export function FacebookWorkspace() {
  const [workspace, setWorkspace] = useState<ReadyWorkspace | null>(null);
  const [selected, setSelected] = useState<Destination | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("selectedId"),
  );
  const [error, setError] = useState("");
  const generation = useRef(0);
  const refresh = useCallback(
    async (signal: AbortSignal): Promise<"ok" | "error" | "auth-failed"> => {
      const current = ++generation.current;
      try {
        const [page, selection] = await Promise.all([
          readWorkspace("", signal),
          selectedId
            ? readWorkspace(
                `?selectedId=${encodeURIComponent(selectedId)}`,
                signal,
              )
            : Promise.resolve(null),
        ]);
        if (signal.aborted || current !== generation.current) return "error";
        if (!page) throw new Error("read");
        setWorkspace(page);
        setSelected(selection?.destinations[0] ?? null);
        setError("");
        return "ok";
      } catch (e) {
        if (!signal.aborted && current === generation.current)
          setError(
            e instanceof Error && e.message === "auth"
              ? "Session expired. Sign in again."
              : "Workspace could not load. Try refresh.",
          );
        return e instanceof Error && e.message === "auth"
          ? "auth-failed"
          : "error";
      }
    },
    [selectedId],
  );
  const live = useGrowthEvents(refresh);
  const manualRefresh = () => {
    void refresh(new AbortController().signal);
  };
  const saved = (id: string) => {
    if (selectedId === id) manualRefresh();
    else setSelectedId(id);
  };
  const rows = workspace
    ? [
        ...(selected &&
        !workspace.destinations.some((d) => d.id === selected.id)
          ? [selected]
          : []),
        ...workspace.destinations,
      ]
    : [];
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Facebook</h1>
          <p className={styles.subtitle}>
            Public discovery and manual activity. Record actions after you
            perform them.
          </p>
        </div>
        <details>
          <summary>Add destination</summary>
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
        <button type="button" onClick={manualRefresh}>
          Refresh
        </button>
      </p>
      {error && <p role="alert">{error}</p>}
      {!workspace && !error && <p>Loading destinations…</p>}
      {workspace && (
        <>
          <section className={styles.pilot}>
            <h2>Private pilots</h2>
            <p>
              {workspace.pilots.used} of {workspace.pilots.total} lifetime
              allocations used · {workspace.pilots.remaining} remaining.
            </p>
            <p>
              Each allocation is for a private one-page preview and one accepted
              revision request. Allocation does not prove a preview is complete
              or accessible. No payment is required; domain ownership stays with
              the client.
            </p>
            <ul>
              {workspace.pilots.allocations.map((a) => (
                <li key={a.slot}>
                  <a href={`/growth/prospects/${a.prospectId}`}>{a.name}</a> ·
                  slot {a.slot}
                </li>
              ))}
            </ul>
          </section>
          <section aria-label="Destination directory">
            {rows.length === 0 && (
              <p>No destinations recorded. Add a destination to begin.</p>
            )}
            {rows.map((item) => (
              <DestinationRow
                key={item.id}
                item={item}
                saved={saved}
                pilots={workspace.pilots}
                select={setSelectedId}
              />
            ))}
            {workspace.nextCursor && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    const current = ++generation.current;
                    const next = await readWorkspace(
                      `?cursor=${encodeURIComponent(workspace.nextCursor ?? "")}`,
                      new AbortController().signal,
                    );
                    if (next && current === generation.current)
                      setWorkspace(next);
                  } catch {
                    setError("Next page could not load. Try again.");
                  }
                }}
              >
                Next directory page
              </button>
            )}
          </section>
        </>
      )}
    </main>
  );
}
