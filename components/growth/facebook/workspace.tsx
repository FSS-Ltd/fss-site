"use client";
import { useCallback, useRef, useState } from "react";
import { useGrowthEvents } from "@/lib/growth/client/use-growth-events";
import { CommandForm } from "./command-form";
import { readWorkspace } from "./read-workspace";
import {
  ActivityForm,
  DestinationCapture,
  LinkForm,
  RulesForm,
  SourceForm,
} from "./destination-forms";
import type { Destination, ReadyWorkspace } from "./types";
import styles from "./facebook.module.css";

const date = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString() : "Not recorded";
function DestinationRow({
  item,
  saved,
  pilots,
  select,
}: {
  item: Destination;
  saved: (id: string) => void;
  pilots: ReadyWorkspace["pilots"];
  select: (id: string) => void;
}) {
  const [rulesVersion, setRulesVersion] = useState<number | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const last = item.activities[0];
  return (
    <article className={styles.row} id={item.id}>
      <h2>{item.name}</h2>
      <a href={item.url} target="_blank" rel="noopener noreferrer">
        {item.url}
      </a>
      <p>
        {item.kind === "page" ? "Page" : "Group"}
        {item.locality ? ` · ${item.locality}` : " · Locality unknown"}
      </p>
      <dl className={styles.facts}>
        <div>
          <dt>Public observation</dt>
          <dd>
            {item.latestObservation
              ? `${item.latestObservation.summary} · ${date(item.latestObservation.observedAt)}`
              : "None recorded"}
          </dd>
        </div>
        <div>
          <dt>Posting guidance</dt>
          <dd>
            {item.postReadiness}{" "}
            {item.review && `· expires ${date(item.review.expiresAt)}`}
          </dd>
        </div>
        <div>
          <dt>Last completed action</dt>
          <dd>
            {last
              ? `${last.activity} · ${date(last.occurredAt)}`
              : "None recorded"}
          </dd>
        </div>
        <div>
          <dt>Next action</dt>
          <dd>
            {item.nextManualAction === "review_rules"
              ? "Review rules"
              : item.nextManualAction === "post"
                ? "Post only after reviewing rules"
                : item.nextManualAction === "follow"
                  ? "Follow, then record"
                  : "Join, then record"}
          </dd>
        </div>
      </dl>
      <details
        className={styles.details}
        onToggle={(event) => {
          if (event.currentTarget.open) select(item.id);
        }}
      >
        <summary>Evidence, history and actions</summary>
        <h3>Rules evidence</h3>
        {item.review ? (
          <p>
            {item.review.decision}: {item.review.summary} · observed{" "}
            {date(item.review.observedAt)} · expires{" "}
            {date(item.review.expiresAt)} ·{" "}
            <a
              href={item.review.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Source
            </a>
          </p>
        ) : (
          <p>
            No rules review recorded. Unknown, stale or prohibited rules do not
            support future posting.
          </p>
        )}
        {!rulesOpen && (
          <button
            type="button"
            onClick={() => {
              if (rulesVersion === null) setRulesVersion(item.version);
              setRulesOpen(true);
            }}
          >
            Review rules
          </button>
        )}
        {rulesVersion !== null && (
          <div hidden={!rulesOpen}>
            <RulesForm
              destination={{ ...item, version: rulesVersion }}
              saved={() => {
                setRulesVersion(null);
                setRulesOpen(false);
                saved(item.id);
              }}
            />
            <button type="button" onClick={() => setRulesOpen(false)}>
              Close rules review
            </button>
          </div>
        )}
        <h3>Public observations</h3>
        <ul>
          {item.observations.map((o) => (
            <li key={o.id}>
              {o.summary} · {date(o.observedAt)} ·{" "}
              <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer">
                Source
              </a>
            </li>
          ))}
        </ul>
        {item.observationsHaveMore && (
          <p>Showing the latest 20 observations.</p>
        )}
        <h3>Manual activity</h3>
        <p>
          Record actions after completing them. Past posts can be recorded
          regardless of current rules.
        </p>
        <ul>
          {item.activities.map((a) => (
            <li key={a.id}>
              {a.activity} · {date(a.occurredAt)}{" "}
              {a.evidenceUrl && (
                <a
                  href={a.evidenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Evidence
                </a>
              )}
            </li>
          ))}
        </ul>
        {item.activitiesHaveMore && <p>Showing the latest 20 activities.</p>}
        <details>
          <summary>Record completed activity</summary>
          <ActivityForm destination={item} saved={() => saved(item.id)} />
        </details>
        <h3>Linked prospects</h3>
        <ul>
          {item.prospects.map((p) => (
            <li key={p.prospectId}>
              <a href={`/growth/prospects/${p.prospectId}`}>{p.name}</a>{" "}
              {pilots.remaining > 0 &&
                !pilots.allocations.some(
                  (a) => a.prospectId === p.prospectId,
                ) && (
                  <PilotAllocation prospect={p} saved={() => saved(item.id)} />
                )}
            </li>
          ))}
        </ul>
        {item.prospectsHaveMore && (
          <p>Showing the first 20 linked prospects.</p>
        )}
        <details>
          <summary>Link existing prospect</summary>
          <LinkForm destination={item} saved={() => saved(item.id)} />
        </details>
        <details>
          <summary>Add prospect</summary>
          <SourceForm destination={item} saved={() => saved(item.id)} />
        </details>
      </details>
    </article>
  );
}
function PilotAllocation({
  prospect,
  saved,
}: {
  prospect: Destination["prospects"][number];
  saved: () => void;
}) {
  const [version, setVersion] = useState<number | null>(null);
  return version === null ? (
    <button type="button" onClick={() => setVersion(prospect.version)}>
      Allocate private pilot
    </button>
  ) : (
    <div>
      <p>
        Lifetime allocation for a private one-page preview and one accepted
        revision request. No payment is required. Domain ownership remains with
        the client. Prospect version {version}.
      </p>
      <CommandForm
        label="Confirm allocation"
        onSuccess={saved}
        build={() => ({
          type: "allocate_pilot",
          prospectId: prospect.prospectId,
          expectedVersion: version,
        })}
      />
      <button type="button" onClick={() => setVersion(null)}>
        Close allocation
      </button>
    </div>
  );
}
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
