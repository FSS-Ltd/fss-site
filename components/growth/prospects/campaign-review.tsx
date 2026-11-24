"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ProspectCampaignResult } from "@/lib/growth/dashboard/prospect-campaign";
import { formatGrowthDateTime } from "@/lib/growth/dashboard/formatters";
import { CampaignOutcomeReview } from "./campaign-outcome-review";
import type { ProspectOutcomes } from "@/lib/growth/dashboard/prospect-campaign-outcomes";
import { CampaignReplyReview } from "./campaign-reply-review";
import { CampaignPermissionForm } from "./campaign-permission-form";
import { SourceVerificationForm } from "./source-verification-form";
import styles from "./campaign-review.module.css";

type Contact = {
  email: string;
  firstName: string | null;
  lastName: string | null;
} | null;
export function CampaignReview({
  result,
  prospectId,
  version,
  contact,
  outcomes = { status: "unavailable" },
}: {
  result: ProspectCampaignResult;
  prospectId: string;
  version: number;
  contact: Contact;
  outcomes?: ProspectOutcomes;
}) {
  const router = useRouter();
  const [selection, setSelection] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("");
  const feedback = useRef<HTMLParagraphElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (message) feedback.current?.focus();
  }, [message]);
  const retry = useRef<{ payload: string; id: string } | null>(null);
  async function enrol() {
    if (result.status !== "ready") return;
    const campaign = result.campaigns.find((item) => item.id === selection);
    if (!campaign) return;
    const body = {
      type: "enrol",
      campaignId: campaign.id,
      policyVersion: campaign.version,
      prospectId,
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
        setMessage(
          response.status === 409
            ? "The campaign or prospect changed, or another outreach record exists. Refresh and review before trying again."
            : response.status === 401
              ? "Your session has expired. Sign in again."
              : "Could not add this prospect for review. Try again.",
        );
        if (response.status === 409) router.refresh();
        return;
      }
      retry.current = null;
      setDone(true);
      setConfirm(false);
      setMessage(
        "Added for review. Permission and approval are still required before outreach.",
      );
      router.refresh();
    } catch {
      setMessage("Could not add this prospect for review. Try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section
      className={styles.panel}
      aria-labelledby="prospect-campaign-heading"
    >
      <h2 id="prospect-campaign-heading">Campaign review</h2>
      {result.status === "unavailable" ? (
        <p role="alert">
          Campaign and source verification information is unavailable. Refresh
          to try again.
        </p>
      ) : (
        <>
          {result.verification ? (
            <div className={styles.evidence}>
              <h3>
                {result.verification.status === "current"
                  ? "Current founder-verified evidence"
                  : "Evidence needs re-verification"}
              </h3>
              <p>
                {result.verification.email} · observed{" "}
                {formatGrowthDateTime(result.verification.contactObservedAt)} ·{" "}
                <a
                  href={result.verification.contactSourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Contact source
                </a>
              </p>
              <p>
                {result.verification.observation} · observed{" "}
                {formatGrowthDateTime(result.verification.observedAt)} ·{" "}
                <a
                  href={result.verification.observationSourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Observation source
                </a>
              </p>
              <p>
                Evidence freshness ends{" "}
                {formatGrowthDateTime(result.verification.freshUntil)}. It is
                not permission to send.
              </p>
            </div>
          ) : (
            <p>
              No founder-verified contact and business observation are recorded.
            </p>
          )}
          <SourceVerificationForm
            prospectId={prospectId}
            version={version}
            contact={contact}
          />
          {result.membership && (
            <div className={styles.enrol}>
              <h3>Review membership · {result.membership.campaignName}</h3>
              <p>
                Policy version {result.membership.policyVersion} · membership{" "}
                {result.membership.status.replaceAll("_", " ")} ·{" "}
                {result.membership.provider} ·{" "}
                {result.membership.jurisdiction ?? "jurisdiction unknown"}
              </p>
              <p>
                {result.membership.permissionExpiresAt
                  ? `Permission recorded; expires ${formatGrowthDateTime(result.membership.permissionExpiresAt)}.`
                  : "No current permission record."}{" "}
                A record does not establish send eligibility.
              </p>
              <p>
                {result.membership.preparation
                  ? `Preparation job: ${result.membership.preparation.status.replaceAll("_", " ")}${result.membership.preparation.reason ? ` · ${result.membership.preparation.reason.replaceAll("_", " ")}` : ""}.`
                  : "No preparation job recorded for this permission."}
              </p>
              {result.membership.canRecord &&
              result.verification?.status === "current" ? (
                <CampaignPermissionForm
                  membership={result.membership}
                  verification={result.verification}
                />
              ) : (
                <p>
                  Permission recording is unavailable. Check the current source,
                  approved policy, jurisdiction and exclusion state.
                </p>
              )}
            </div>
          )}
          {result.reviewStatus === "excluded" ? (
            <p>This prospect is excluded from outreach review.</p>
          ) : result.reviewStatus === "already_in_outreach" ? (
            !result.membership && (
              <p>
                This business already has an outreach membership or sequence.
              </p>
            )
          ) : !result.verification ||
            result.verification.status !== "current" ? (
            <p>Verify current source evidence before choosing a campaign.</p>
          ) : result.campaigns.length === 0 ? (
            <p>
              No currently valid approved campaign policies are available.{" "}
              <Link href="/growth/outreach">Review campaigns</Link>
            </p>
          ) : (
            <div className={styles.enrol}>
              <label>
                Approved campaign for review
                <select
                  value={selection}
                  disabled={pending || done}
                  onChange={(event) => {
                    setSelection(event.target.value);
                    setConfirm(false);
                    setMessage("");
                  }}
                >
                  <option value="">Choose a campaign</option>
                  {result.campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name} · version {campaign.version} ·{" "}
                      {campaign.offer.replaceAll("_", " ")} ·{" "}
                      {campaign.status === "paused" ? "paused" : "active"}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                Adding creates a review record only. Recipient permission and
                all send checks remain separate.
              </p>
              {result.truncated && <p>Showing up to 50 approved campaigns.</p>}
              {!confirm ? (
                <button
                  ref={trigger}
                  type="button"
                  disabled={!selection || pending || done}
                  onClick={() => setConfirm(true)}
                >
                  Add for review
                </button>
              ) : (
                <div>
                  <p>
                    Confirm adding this prospect to the selected policy version
                    for review?
                  </p>
                  <button
                    autoFocus
                    type="button"
                    disabled={pending}
                    onClick={enrol}
                  >
                    {pending ? "Saving…" : "Confirm review"}
                  </button>{" "}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setConfirm(false);
                      requestAnimationFrame(() => trigger.current?.focus());
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
          <CampaignReplyReview result={result.replies} />
          <CampaignOutcomeReview result={outcomes} />
          {message && (
            <p ref={feedback} tabIndex={-1} role={done ? "status" : "alert"}>
              {message}
            </p>
          )}
        </>
      )}
    </section>
  );
}
