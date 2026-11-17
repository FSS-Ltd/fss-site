"use client";
import { useRef, useState } from "react";
import { CommandForm } from "./command-form";
import {
  ActivityForm,
  LinkForm,
  RulesForm,
  SourceForm,
} from "./destination-forms";
import type { Destination, ReadyWorkspace } from "./types";
import styles from "./facebook.module.css";

const date = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString() : "Not recorded";
export function DestinationRow({
  item,
  saved,
  pilots,
  retain,
  discard,
  release,
  retained,
  refresh,
}: {
  item: Destination;
  saved: (id: string) => void;
  pilots: ReadyWorkspace["pilots"];
  retain: (item: Destination) => void;
  discard: (id: string) => void;
  release: (id: string) => void;
  retained: boolean;
  refresh: () => void;
}) {
  const [rulesVersion, setRulesVersion] = useState<number | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const last = item.activities[0];
  const dirtyForms = useRef(new Set<string>());
  const openPilots = useRef(new Set<string>());
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const activityRef = useRef<HTMLDetailsElement>(null);
  const completed = (label: string) => {
    dirtyForms.current.delete(label);
    if (dirtyForms.current.size === 0 && openPilots.current.size === 0)
      release(item.id);
    saved(item.id);
  };
  const openNext = () => {
    if (detailsRef.current) detailsRef.current.open = true;
    if (item.nextManualAction === "review_rules") {
      if (rulesVersion === null) setRulesVersion(item.version);
      setRulesOpen(true);
    } else if (activityRef.current) activityRef.current.open = true;
  };
  return (
    <article
      className={styles.row}
      id={item.id}
      onInputCapture={(event) => {
        if (event.target instanceof Element) {
          const label = event.target.closest("form")?.dataset.command;
          if (label) {
            dirtyForms.current.add(label);
            retain(item);
          }
        }
      }}
    >
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
            <br />
            <button
              type="button"
              className={styles.secondary}
              onClick={openNext}
            >
              {item.nextManualAction === "review_rules"
                ? "Review rules"
                : item.nextManualAction === "follow"
                  ? "Record completed follow"
                  : item.nextManualAction === "join"
                    ? "Record completed join"
                    : "Record completed activity"}
            </button>
          </dd>
        </div>
      </dl>
      <details className={styles.details} ref={detailsRef}>
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
              onConflict={refresh}
              saved={() => {
                setRulesVersion(null);
                setRulesOpen(false);
                completed("Save rules review");
              }}
            />
            {item.version !== rulesVersion && (
              <p>
                Current version {item.version} is shown above. Review the
                evidence, then{" "}
                <button
                  type="button"
                  onClick={() => setRulesVersion(item.version)}
                >
                  Use current version
                </button>{" "}
                to keep these entries and submit a new review.
              </p>
            )}
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
        <details ref={activityRef}>
          <summary>Record completed activity</summary>
          <ActivityForm
            destination={item}
            saved={() => completed("Record completed activity")}
          />
        </details>
        <h3>Linked prospects</h3>
        <ul>
          {item.prospects.map((p) => (
            <li key={p.prospectId}>
              <a href={`/growth/prospects/${p.prospectId}`}>{p.name}</a>{" "}
              <PilotAllocation
                prospect={p}
                available={
                  pilots.remaining > 0 &&
                  !pilots.allocations.some((a) => a.prospectId === p.prospectId)
                }
                opened={() => {
                  openPilots.current.add(p.prospectId);
                  retain(item);
                }}
                closed={() => {
                  openPilots.current.delete(p.prospectId);
                  if (
                    openPilots.current.size === 0 &&
                    dirtyForms.current.size === 0
                  )
                    release(item.id);
                }}
                saved={() => saved(item.id)}
              />
            </li>
          ))}
        </ul>
        {item.prospectsHaveMore && (
          <p>Showing the first 20 linked prospects.</p>
        )}
        <details>
          <summary>Link existing prospect</summary>
          <LinkForm
            destination={item}
            saved={() => completed("Link prospect")}
          />
        </details>
        <details>
          <summary>Add prospect</summary>
          <SourceForm
            destination={item}
            saved={() => completed("Save prospect")}
          />
        </details>
      </details>
      {retained && (
        <button type="button" onClick={() => discard(item.id)}>
          Discard unsaved entries
        </button>
      )}
    </article>
  );
}
function PilotAllocation({
  prospect,
  saved,
  available,
  opened,
  closed,
}: {
  prospect: Destination["prospects"][number];
  saved: () => void;
  available: boolean;
  opened: () => void;
  closed: () => void;
}) {
  const [version, setVersion] = useState<number | null>(null);
  return version === null ? (
    available && (
      <button
        type="button"
        onClick={() => {
          setVersion(prospect.version);
          opened();
        }}
      >
        Allocate private pilot
      </button>
    )
  ) : (
    <div>
      <p>
        Lifetime allocation for a private one-page preview and one accepted
        revision request. No payment is required. Domain ownership remains with
        the client. Prospect version {version}.
      </p>
      <CommandForm
        label="Confirm allocation"
        onSuccess={() => {
          setVersion(null);
          closed();
          saved();
        }}
        build={() => ({
          type: "allocate_pilot",
          prospectId: prospect.prospectId,
          expectedVersion: version,
        })}
      />
      <button
        type="button"
        onClick={() => {
          setVersion(null);
          closed();
        }}
      >
        Close allocation
      </button>
    </div>
  );
}
