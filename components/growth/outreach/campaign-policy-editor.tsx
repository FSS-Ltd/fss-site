"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CampaignOverviewRow } from "@/lib/growth/dashboard/campaign-overview";
import { CampaignPolicyFields } from "./campaign-policy-fields";
import styles from "./campaign-overview.module.css";

export function CampaignPolicyEditor({
  campaign,
}: {
  campaign?: CampaignOverviewRow;
}) {
  const router = useRouter();
  const [initial] = useState(() => campaign?.editorPolicy ?? null);
  const [initialVersion] = useState(() => campaign?.version);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (message) feedback.current?.focus();
  }, [message]);
  const retry = useRef<{ payload: string; id: string } | null>(null);
  if (campaign?.status === "revoked") return null;
  if (campaign && !initial)
    return (
      <p className={styles.note}>
        Revision unavailable for this stored policy. Its fields require review
        before editing.
      </p>
    );
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) ?? "").trim();
    const evidence = (prefix: string) => ({
      summary: value(`${prefix}Summary`),
      reference: {
        kind: value(`${prefix}Kind`),
        value: value(`${prefix}Reference`),
      },
      observedAt: value(`${prefix}Observed`),
      expiresAt: value(`${prefix}Expires`),
    });
    const editor = {
      offer: value("offer"),
      provider: value("provider"),
      jurisdiction: value("jurisdiction").toUpperCase(),
      permissionRequirement: value("permission"),
      effectiveAt: value("effectiveAt"),
      expiresAt: value("expiresAt"),
      ctaA: value("ctaA"),
      ctaB: value("ctaB"),
      capability: evidence("capability"),
      providerEvidence: evidence("providerEvidence"),
      providerConfirmed: data.has("providerConfirmed"),
      hardBounces: Number(value("hardBounces")),
      complaints: Number(value("complaints")),
    };
    const base = campaign
      ? {
          type: "revise",
          campaignId: campaign.id,
          policyVersion: initialVersion,
          editor,
        }
      : { type: "create", name: value("name"), editor };
    const payload = JSON.stringify(base);
    if (retry.current?.payload !== payload)
      retry.current = { payload, id: crypto.randomUUID() };
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/growth/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...base, requestId: retry.current.id }),
      });
      if (!response.ok) {
        setMessage(
          response.status === 409
            ? "The policy could not be saved. The campaign may have changed or evidence may need review. Your entries are retained."
            : response.status === 401
              ? "Your session has expired. Sign in again; your entries remain here."
              : "The policy could not be saved. Check the fields and evidence times; your entries are retained.",
        );
        if (response.status === 409) router.refresh();
        return;
      }
      retry.current = null;
      setSaved(true);
      setMessage("Draft saved. Approval and activation are separate actions.");
      router.refresh();
    } catch {
      setMessage(
        "The policy could not be saved. Your entries are retained; try again.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <details className={styles.editor}>
      <summary>
        {campaign ? `Revise version ${initialVersion}` : "Create campaign"}
      </summary>
      <form onSubmit={save}>
        <p>
          {campaign
            ? `Saving creates version ${(initialVersion ?? 0) + 1}, paused and requiring a new approval.`
            : "Create a paused draft. Saving does not approve or start it."}
        </p>
        {campaign && campaign.version !== initialVersion && (
          <p role="alert">
            A newer version is available. Your entries are preserved. Copy any
            needed changes, then refresh the page to review the current version.
          </p>
        )}
        <fieldset disabled={pending || saved} className={styles.editorInputs}>
          {!campaign && (
            <label>
              Campaign name
              <input name="name" required maxLength={200} />
            </label>
          )}
          <CampaignPolicyFields policy={initial} />
        </fieldset>
        <button
          type="submit"
          disabled={
            pending ||
            saved ||
            (!!campaign && campaign.version !== initialVersion)
          }
        >
          {pending ? "Saving…" : "Save draft"}
        </button>
        {message && (
          <p ref={feedback} tabIndex={-1} role={saved ? "status" : "alert"}>
            {message}
          </p>
        )}
      </form>
    </details>
  );
}
