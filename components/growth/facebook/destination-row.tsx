"use client";
import { useEffect, useRef, useState } from "react";
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
  expiryPending,
  keepVisible,
}: {
  item: Destination;
  saved: (id: string) => void;
  pilots: ReadyWorkspace["pilots"];
  retain: (item: Destination) => void;
  discard: (id: string) => void;
  release: (id: string) => void;
  retained: boolean;
  refresh: () => void;
  expiryPending: boolean;
  keepVisible: (item: Destination) => void;
}) {
  const [rulesVersion, setRulesVersion] = useState<number | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [pilotMessage, setPilotMessage] = useState("");
  const last = item.activities[0];
  const dirtyForms = useRef(new Set<string>());
  const openPilots = useRef(new Set<string>());
  const rulesActive = useRef(false);
  const activityActive = useRef(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const activityRef = useRef<HTMLDetailsElement>(null);
  const prospectHeading = useRef<HTMLHeadingElement>(null);
  const rulesRef = useRef<HTMLDivElement>(null);
  const rulesTrigger = useRef<HTMLButtonElement>(null);
  const restoreRulesFocus = useRef(false);
  useEffect(() => {
    if (rulesOpen)
      rulesRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    else if (restoreRulesFocus.current) {
      rulesTrigger.current?.focus();
      restoreRulesFocus.current = false;
    }
  }, [rulesOpen]);
  const completed = (label: string) => {
    dirtyForms.current.delete(label);
    if (
      dirtyForms.current.size === 0 &&
      openPilots.current.size === 0 &&
      !rulesActive.current &&
      !activityActive.current
    )
      release(item.id);
    saved(item.id);
  };
  const openRules = () => {
    if (rulesVersion === null) setRulesVersion(item.version);
    rulesActive.current = true;
    retain(item);
    setRulesOpen(true);
  };
  const closeRules = () => {
    rulesActive.current = false;
    keepVisible(item);
    if (
      dirtyForms.current.size === 0 &&
      openPilots.current.size === 0 &&
      !activityActive.current
    )
      release(item.id);
    restoreRulesFocus.current = true;
    setRulesOpen(false);
  };
  const openNext = () => {
    if (detailsRef.current) detailsRef.current.open = true;
    if (expiryPending || item.nextManualAction === "review_rules") {
      openRules();
    } else if (activityRef.current) {
      activityRef.current.open = true;
      activityRef.current.querySelector<HTMLSelectElement>("select")?.focus();
    }
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
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open ${item.name} on Facebook`}
      >
        Open Facebook {item.kind}
      </a>
      <p>
        {item.kind === "page" ? "Page" : "Group"}
        {item.locality ? ` · ${item.locality}` : " · Locality unknown"}
      </p>
      <dl className={styles.facts}>
        <div>
          <dt>Posting guidance</dt>
          <dd>
            {expiryPending
              ? "Review expired; refresh required"
              : item.postReadiness === "allowed"
                ? "Posting allowed by current review"
                : item.postReadiness === "prohibited"
                  ? "Posting prohibited by current review"
                  : item.postReadiness === "stale"
                    ? "Review is stale; review rules before posting"
                    : "Posting guidance unknown; review rules before posting"}{" "}
            {item.review && `· expires ${date(item.review.expiresAt)}`}
          </dd>
        </div>
        <div>
          <dt>Next action</dt>
          <dd>
            {!expiryPending && item.nextManualAction !== "review_rules" && (
              <p className={styles.actionHint}>
                {item.nextManualAction === "post"
                  ? "Post only after reviewing rules"
                  : item.nextManualAction === "follow"
                    ? "Follow, then record"
                    : "Join, then record"}
              </p>
            )}
            <button
              type="button"
              className={styles.secondary}
              onClick={openNext}
            >
              {expiryPending || item.nextManualAction === "review_rules"
                ? "Review rules"
                : item.nextManualAction === "follow"
                  ? "Record completed follow"
                  : item.nextManualAction === "join"
                    ? "Record completed join"
                    : "Record completed activity"}
            </button>
          </dd>
        </div>
        <div>
          <dt>Public observation</dt>
          <dd>
            {item.latestObservation
              ? `${item.latestObservation.summary} · ${date(item.latestObservation.observedAt)}`
              : "None recorded"}
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
          <button type="button" ref={rulesTrigger} onClick={openRules}>
            Review rules
          </button>
        )}
        {rulesVersion !== null && (
          <div ref={rulesRef} hidden={!rulesOpen}>
            <RulesForm
              destination={{ ...item, version: rulesVersion }}
              onConflict={refresh}
              saved={() => {
                rulesActive.current = false;
                keepVisible(item);
                setRulesVersion(null);
                restoreRulesFocus.current = true;
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
                  onClick={() => {
                    setRulesVersion(item.version);
                    rulesRef.current
                      ?.querySelector<HTMLInputElement>("input")
                      ?.focus();
                  }}
                >
                  Use current version
                </button>{" "}
                to keep these entries and submit a new review.
              </p>
            )}
            <button type="button" onClick={closeRules}>
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
        <details
          ref={activityRef}
          onToggle={(event) => {
            if (event.currentTarget.open) {
              activityActive.current = true;
              retain(item);
            } else if (activityActive.current) {
              activityActive.current = false;
              keepVisible(item);
              if (
                !rulesActive.current &&
                dirtyForms.current.size === 0 &&
                openPilots.current.size === 0
              )
                release(item.id);
            }
          }}
        >
          <summary>Record completed activity</summary>
          <ActivityForm
            destination={item}
            saved={() => completed("Record completed activity")}
          />
        </details>
        <h3 ref={prospectHeading} tabIndex={-1}>
          Linked prospects
        </h3>
        {pilotMessage && <p role="status">{pilotMessage}</p>}
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
                  keepVisible(item);
                  if (
                    openPilots.current.size === 0 &&
                    dirtyForms.current.size === 0 &&
                    !rulesActive.current &&
                    !activityActive.current
                  )
                    release(item.id);
                }}
                saved={() => {
                  setPilotMessage(
                    "Pilot allocation recorded. The allocation count updates from the workspace.",
                  );
                  prospectHeading.current?.focus();
                  saved(item.id);
                }}
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
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (version !== null)
      panelRef.current
        ?.querySelector<HTMLButtonElement>("button[type=submit]")
        ?.focus();
    else if (restoreFocus.current) {
      triggerRef.current?.focus();
      restoreFocus.current = false;
    }
  }, [version]);
  return version === null ? (
    available && (
      <button
        type="button"
        ref={triggerRef}
        onClick={() => {
          setVersion(prospect.version);
          opened();
        }}
      >
        Allocate private pilot
      </button>
    )
  ) : (
    <div ref={panelRef}>
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
          restoreFocus.current = true;
          setVersion(null);
          closed();
        }}
      >
        Close allocation
      </button>
    </div>
  );
}
