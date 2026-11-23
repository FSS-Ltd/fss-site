"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProspectCampaignResult } from "@/lib/growth/dashboard/prospect-campaign";
import styles from "./campaign-review.module.css";

type Ready = Extract<ProspectCampaignResult, { status: "ready" }>;
export function CampaignPermissionForm({
  membership,
  verification,
}: {
  membership: NonNullable<Ready["membership"]>;
  verification: NonNullable<Ready["verification"]>;
}) {
  const router = useRouter();
  const [initial] = useState(() => ({ membership, verification }));
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const feedback = useRef<HTMLParagraphElement>(null);
  const retry = useRef<{ payload: string; id: string } | null>(null);
  useEffect(() => {
    if (message) feedback.current?.focus();
  }, [message]);
  const changed =
    membership.id !== initial.membership.id ||
    membership.policyVersion !== initial.membership.policyVersion ||
    verification.requestId !== initial.verification.requestId ||
    verification.contactVersion !== initial.verification.contactVersion ||
    verification.prospectVersion !== initial.verification.prospectVersion ||
    !membership.canRecord ||
    verification.status !== "current";
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) ?? "").trim();
    const attestation =
      initial.membership.basis === "consent"
        ? { kind: "consent", explicitOptIn: data.has("confirmed") }
        : {
            kind: "requested_service",
            requestedAt: value("requestedAt"),
            attestsRecipientRequest: data.has("confirmed"),
            messageScope: "initial_and_two_followups",
          };
    const body = {
      type: "record_permission",
      membershipId: initial.membership.id,
      expectedPolicyVersion: initial.membership.policyVersion,
      expectedProspectVersion: initial.verification.prospectVersion,
      expectedContactVersion: initial.verification.contactVersion,
      proofRequestId: initial.verification.requestId,
      observedAt: value("observedAt"),
      expiresAt: value("expiresAt"),
      summary: value("summary"),
      reference: { kind: value("referenceKind"), value: value("reference") },
      attestation,
    };
    const payload = JSON.stringify(body);
    if (retry.current?.payload !== payload)
      retry.current = { payload, id: crypto.randomUUID() };
    setPending(true);
    setMessage("");
    setSessionExpired(false);
    try {
      const response = await fetch("/api/growth/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, requestId: retry.current.id }),
      });
      if (!response.ok) {
        let code = "";
        try {
          const result: unknown = await response.json();
          if (
            result &&
            typeof result === "object" &&
            "code" in result &&
            typeof result.code === "string"
          )
            code = result.code;
        } catch {
          /* A non-JSON response has no safe detail. */
        }
        const messages: Record<string, string> = {
          verification_required: "Source verification is no longer current.",
          prospect_version_changed: "The prospect changed.",
          contact_version_changed: "The contact changed.",
          membership_unavailable: "The review membership is unavailable.",
          policy_version_changed: "The campaign policy changed.",
          permission_invalid:
            "The evidence does not match the policy, jurisdiction or required times.",
          excluded: "This prospect is excluded from outreach.",
        };
        setSessionExpired(response.status === 401);
        setMessage(
          response.status === 401
            ? "Your session expired. Sign in again; your entries remain here."
            : `${Object.hasOwn(messages, code) ? messages[code] : "Permission could not be saved."} Your entries are retained. Copy them before refreshing to review the current record.`,
        );
        return;
      }
      retry.current = null;
      setSaved(true);
      setMessage(
        "Permission recorded. Preparation and send checks remain separate.",
      );
      router.refresh();
    } catch {
      setMessage(
        "Permission could not be saved. Your entries are retained; try again.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <details className={styles.disclosure}>
      <summary>Record recipient permission</summary>
      <form className={styles.form} onSubmit={submit}>
        <p>
          For {initial.membership.campaignName}, policy{" "}
          {initial.membership.policyVersion}: {initial.membership.provider},{" "}
          {initial.membership.jurisdiction},{" "}
          {initial.membership.basis === "consent"
            ? "consent"
            : "requested service"}
          . The verified source above confirms contact details, not permission.
        </p>
        {changed && !saved && (
          <p role="alert">
            The membership or source changed. Copy your entries, then refresh
            and review the current record.
          </p>
        )}
        <fieldset disabled={pending || saved}>
          <label>
            Permission evidence summary
            <textarea name="summary" required maxLength={2000} />
          </label>
          <label>
            Evidence reference type
            <select name="referenceKind" defaultValue="private">
              <option value="private">Private reference</option>
              <option value="public">Public URL</option>
            </select>
          </label>
          <label>
            Permission evidence reference
            <input name="reference" required maxLength={500} />
          </label>
          <label>
            Permission observed at (ISO time with offset)
            <input
              name="observedAt"
              required
              placeholder="YYYY-MM-DDTHH:MM:SSZ"
            />
          </label>
          <label>
            Permission expires at (ISO time with offset)
            <input
              name="expiresAt"
              required
              placeholder="YYYY-MM-DDTHH:MM:SSZ"
            />
          </label>
          {initial.membership.basis === "requested_service" && (
            <label>
              Service requested at (ISO time with offset)
              <input
                name="requestedAt"
                required
                placeholder="YYYY-MM-DDTHH:MM:SSZ"
              />
            </label>
          )}
          <label className={styles.checkbox}>
            <input name="confirmed" type="checkbox" required />
            {initial.membership.basis === "consent"
              ? "I confirm the recipient explicitly opted in to this outreach."
              : "I confirm the recipient specifically requested this service and the initial message plus two follow-ups."}
          </label>
        </fieldset>
        <button type="submit" disabled={pending || saved || changed}>
          {pending ? "Saving…" : "Record permission"}
        </button>
        {message && (
          <p ref={feedback} tabIndex={-1} role={saved ? "status" : "alert"}>
            {message}{" "}
            {sessionExpired && (
              <a href="/growth/login" target="_blank" rel="noreferrer">
                Sign in in a new tab
              </a>
            )}{" "}
            {!saved && (
              <a href="#prospect-campaign-heading">
                Review source and membership
              </a>
            )}
          </p>
        )}
      </form>
    </details>
  );
}
