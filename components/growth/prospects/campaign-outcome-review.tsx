"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProspectOutcomes } from "@/lib/growth/dashboard/prospect-campaign-outcomes";
import { formatGrowthDateTime } from "@/lib/growth/dashboard/formatters";
import styles from "./campaign-review.module.css";

export function CampaignOutcomeReview({
  result,
}: {
  result: ProspectOutcomes;
}) {
  const router = useRouter();
  const [membershipId, setMembership] = useState("");
  const [kind, setKind] = useState<"meeting" | "proposal">("meeting");
  const [sourceId, setSource] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [qualified, setQualified] = useState(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("");
  const retry = useRef<{ payload: string; id: string } | null>(null);
  if (result.status === "unavailable")
    return (
      <section>
        <h3>Campaign outcomes</h3>
        <p role="status">
          Outcome evidence is unavailable. Refresh to try again.
        </p>
      </section>
    );
  const proposals = result.proposals;
  const member = result.memberships.find((item) => item.id === membershipId);
  const source =
    kind === "meeting"
      ? result.meetings.find((item) => item.id === sourceId)
      : proposals.find((item) => item.id === sourceId);
  const validTime =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(occurredAt) &&
    Number.isFinite(Date.parse(occurredAt));
  function changed() {
    setMessage("");
    setDone(false);
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!member || !source || source.attributed) return;
    const proposal =
      kind === "proposal"
        ? proposals.find((item) => item.id === sourceId)
        : null;
    if (
      (kind === "meeting" && (!qualified || !validTime)) ||
      (kind === "proposal" && !proposal)
    ) {
      setMessage(
        "Enter a valid UTC meeting time and confirm it was qualified.",
      );
      return;
    }
    const outcome = proposal
      ? {
          kind: "proposal" as const,
          engagementId: proposal.engagementId,
          stageEventId: proposal.id,
        }
      : {
          kind: "meeting" as const,
          crmActivityId: source.id,
          occurredAt,
          qualified: true as const,
        };
    const body = {
      type: "record_outcome",
      membershipId: member.id,
      expectedPolicyVersion: member.policyVersion,
      expectedProspectVersion: member.prospectVersion,
      expectedContactVersion: member.contactVersion,
      outcome,
    };
    const payload = JSON.stringify(body);
    if (retry.current?.payload !== payload)
      retry.current = { payload, id: crypto.randomUUID() };
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/growth/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, requestId: retry.current.id }),
      });
      if (!response.ok) {
        let code = "";
        try {
          const data: unknown = await response.json();
          if (
            data &&
            typeof data === "object" &&
            "code" in data &&
            typeof data.code === "string"
          )
            code = data.code;
        } catch {
          /* No safe detail available. */
        }
        setMessage(
          code === "outcome_evidence_attributed"
            ? "This activity or proposal stage is already attributed. Refresh to review it."
            : response.status === 409
              ? "The campaign or evidence changed, or the event falls outside the eligible period. Your entries are retained; refresh and review."
              : response.status === 401
                ? "Your session expired. Sign in and retry; your entries are retained."
                : "Could not record the outcome. Your entries are retained for retry.",
        );
        return;
      }
      retry.current = null;
      setDone(true);
      setMessage(
        "Outcome recorded. The campaign sequence is stopped; refreshing the record.",
      );
      router.refresh();
    } catch {
      setMessage(
        "Could not record the outcome. Your entries are retained for retry.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <details className={styles.enrol}>
      <summary>Review campaign outcomes</summary>
      <p>
        Attribute a qualified meeting or a recorded proposal stage to a campaign
        with confirmed outreach. Recording stops remaining sequence messages. A
        proposal stage alone does not confirm delivery.
      </p>
      {result.memberships.length === 0 ? (
        <p>
          No campaign with confirmed outreach is available for outcome review.
        </p>
      ) : result.meetings.length === 0 && result.proposals.length === 0 ? (
        <p>
          No meeting activity or proposal stage is recorded for this prospect.
        </p>
      ) : (
        <form className={styles.outcomeForm} onSubmit={submit}>
          <label>
            Campaign
            <select
              required
              value={membershipId}
              disabled={pending}
              onChange={(event) => {
                setMembership(event.target.value);
                changed();
              }}
            >
              <option value="">Choose a campaign</option>
              {result.memberships.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.campaign} · policy {item.policyVersion} · outreach
                  issued {formatGrowthDateTime(item.submittedAt)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Evidence type
            <select
              value={kind}
              disabled={pending}
              onChange={(event) => {
                setKind(
                  event.target.value === "proposal" ? "proposal" : "meeting",
                );
                setSource("");
                changed();
              }}
            >
              <option value="meeting">Meeting activity</option>
              <option value="proposal">Proposal stage</option>
            </select>
          </label>
          <label>
            {kind === "meeting"
              ? "Meeting activity recorded"
              : "Proposal stage recorded"}
            <select
              required
              value={sourceId}
              disabled={pending}
              onChange={(event) => {
                setSource(event.target.value);
                changed();
              }}
            >
              <option value="">Choose a record</option>
              {(kind === "meeting" ? result.meetings : result.proposals).map(
                (item) => (
                  <option
                    key={item.id}
                    value={item.id}
                    disabled={item.attributed}
                  >
                    {formatGrowthDateTime(item.recordedAt)} ·{" "}
                    {item.id.slice(0, 8)}
                    {item.attributed ? " · already attributed" : ""}
                  </option>
                ),
              )}
            </select>
          </label>
          {kind === "meeting" && (
            <>
              <label>
                Actual meeting time (UTC, for example 2026-11-23T12:00:00Z)
                <input
                  required
                  value={occurredAt}
                  disabled={pending}
                  onChange={(event) => {
                    setOccurredAt(event.target.value);
                    changed();
                  }}
                />
              </label>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={qualified}
                  disabled={pending}
                  onChange={(event) => {
                    setQualified(event.target.checked);
                    changed();
                  }}
                />{" "}
                I confirm this meeting took place and was qualified.
              </label>
            </>
          )}
          <button
            type="submit"
            disabled={
              pending ||
              done ||
              !member ||
              !source ||
              source.attributed ||
              (kind === "meeting" && (!qualified || !validTime))
            }
          >
            {pending ? "Recording…" : "Record campaign outcome"}
          </button>
          {message && <p role={done ? "status" : "alert"}>{message}</p>}
        </form>
      )}
      {result.truncated && <p>Showing up to 20 records of each type.</p>}
    </details>
  );
}
