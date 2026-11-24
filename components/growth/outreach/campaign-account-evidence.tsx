"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  healthReviewSchema,
  limitsReviewSchema,
} from "@/lib/growth/campaigns/account-contracts";
import type { CampaignAccount } from "@/lib/growth/dashboard/campaign-accounts";
import styles from "./campaign-overview.module.css";

type Field = {
  name: string;
  label: string;
  type?: "number" | "text";
  optional?: boolean;
  choices?: readonly string[];
};
const dateFields: Field[] = [
  { name: "observedFrom", label: "Observation starts (ISO UTC)" },
  { name: "observedUntil", label: "Observation ends (ISO UTC)" },
  { name: "expiresAt", label: "Evidence expires (ISO UTC)" },
];
const counts: Field[] = [
  "sends",
  "attempts",
  "hardBounces",
  "complaints",
  "rateIncidents",
  "authIncidents",
].map((name) => ({
  name,
  label: `${name.replace(/([A-Z])/g, " $1")} (blank if unknown)`,
  type: "number",
  optional: true,
}));
const healthFields: Field[] = [
  { name: "source", label: "Health evidence source" },
  ...dateFields,
  {
    name: "complete",
    label: "Is the observation complete?",
    choices: ["yes", "no"],
  },
  {
    name: "verdict",
    label: "Health verdict",
    choices: ["healthy", "unhealthy", "unknown"],
  },
  ...counts,
  ...(["spf", "dkim", "dmarc"] as const).flatMap((name) => [
    {
      name: `${name}Status`,
      label: `${name.toUpperCase()} status`,
      choices: ["pass", "fail", "unknown"],
    },
    { name: `${name}Source`, label: `${name.toUpperCase()} evidence source` },
  ]),
];
const limitsFields: Field[] = [
  { name: "source", label: "Limits source" },
  { name: "edition", label: "Gmail edition" },
  { name: "path", label: "Sending path" },
  { name: "observedAt", label: "Limits observed (ISO UTC)" },
  { name: "expiresAt", label: "Limits expire (ISO UTC)" },
  ...[
    "messages",
    "recipientLimit1",
    "recipientLimit2",
    "recipientLimit3",
    "recipientLimit4",
    "perMessage",
    "messageReserve",
    "recipientReserve",
  ].map((name) => ({
    name,
    label: name.replace(/([A-Z])/g, " $1"),
    type: "number" as const,
  })),
  { name: "visibilitySource", label: "Mailbox visibility source" },
  { name: "reviewedAt", label: "Visibility reviewed (ISO UTC)" },
  { name: "visibilityExpiresAt", label: "Visibility expires (ISO UTC)" },
  { name: "scope", label: "Visibility scope" },
  ...["mailbox", "aliases", "delegates", "automatic"].map((name) => ({
    name,
    label: `${name} visibility`,
    choices: ["covered", "unknown"],
  })),
  {
    name: "recipientHeaders",
    label: "Recipient headers",
    choices: ["complete", "unknown"],
  },
  {
    name: "nativeMailbox",
    label: "Native mailbox path",
    choices: ["included", "none", "unknown"],
  },
  {
    name: "fssGmailApi",
    label: "FSS Gmail API path",
    choices: ["included", "none", "unknown"],
  },
  {
    name: "aliasPath",
    label: "Alias path",
    choices: ["none", "native_send_as", "unknown"],
  },
  {
    name: "delegation",
    label: "Delegation path",
    choices: ["none", "present", "unknown"],
  },
  {
    name: "other",
    label: "Other sending path",
    choices: ["none", "external_smtp", "relay", "other", "unknown"],
  },
];
function Fields({ fields }: { fields: Field[] }) {
  return (
    <div className={styles.accountInput}>
      {fields.map((field) => (
        <label key={field.name}>
          {field.label}
          {field.choices ? (
            <select name={field.name} required defaultValue="">
              <option value="" disabled>
                Choose
              </option>
              {field.choices.map((choice) => (
                <option value={choice} key={choice}>
                  {choice.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          ) : (
            <input
              name={field.name}
              type={field.type ?? "text"}
              required={!field.optional}
              min={field.type === "number" ? 0 : undefined}
              step={field.type === "number" ? 1 : undefined}
              maxLength={field.type === "number" ? undefined : 500}
              placeholder={
                field.label.includes("ISO UTC")
                  ? "2026-11-23T12:00:00Z"
                  : undefined
              }
            />
          )}
        </label>
      ))}
    </div>
  );
}
function evidenceFrom(form: FormData, kind: "record_health" | "record_limits") {
  const value = (name: string) => String(form.get(name) ?? "").trim();
  const number = (name: string) => Number(value(name));
  const nullable = (name: string) => (value(name) === "" ? null : number(name));
  if (kind === "record_health")
    return healthReviewSchema.safeParse({
      source: value("source"),
      observedFrom: value("observedFrom"),
      observedUntil: value("observedUntil"),
      expiresAt: value("expiresAt"),
      complete: value("complete") === "yes",
      verdict: value("verdict"),
      sends: nullable("sends"),
      attempts: nullable("attempts"),
      hardBounces: nullable("hardBounces"),
      complaints: nullable("complaints"),
      rateIncidents: nullable("rateIncidents"),
      authIncidents: nullable("authIncidents"),
      authentication: Object.fromEntries(
        ["spf", "dkim", "dmarc"].map((name) => [
          name,
          { status: value(`${name}Status`), source: value(`${name}Source`) },
        ]),
      ),
    });
  return limitsReviewSchema.safeParse({
    source: value("source"),
    edition: value("edition"),
    path: value("path"),
    observedAt: value("observedAt"),
    expiresAt: value("expiresAt"),
    messages: number("messages"),
    recipients: [
      number("recipientLimit1"),
      number("recipientLimit2"),
      number("recipientLimit3"),
      number("recipientLimit4"),
    ],
    perMessage: number("perMessage"),
    messageReserve: number("messageReserve"),
    recipientReserve: number("recipientReserve"),
    visibility: {
      source: value("visibilitySource"),
      reviewedAt: value("reviewedAt"),
      expiresAt: value("visibilityExpiresAt"),
      scope: value("scope"),
      paths: {
        mailbox: value("mailbox"),
        aliases: value("aliases"),
        delegates: value("delegates"),
        automatic: value("automatic"),
      },
      recipientHeaders: value("recipientHeaders"),
      supportedPaths: {
        nativeMailbox: value("nativeMailbox"),
        fssGmailApi: value("fssGmailApi"),
        aliases: value("aliasPath"),
        delegation: value("delegation"),
        other: value("other"),
      },
    },
  });
}
function EvidenceForm({
  account,
  kind,
}: {
  account: CampaignAccount;
  kind: "record_health" | "record_limits";
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  const retry = useRef<{ payload: string; id: string } | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const version = account.evidenceVersion;
    if (version === null) return;
    const parsed = evidenceFrom(new FormData(event.currentTarget), kind);
    if (!parsed.success) {
      setMessage(
        "Check the required fields, counts and ISO UTC dates. Values are retained.",
      );
      return;
    }
    const body = {
      provider: account.provider,
      action: kind,
      expectedVersion: version,
      evidence: parsed.data,
    };
    const payload = JSON.stringify(body);
    if (retry.current?.payload !== payload)
      retry.current = { payload, id: crypto.randomUUID() };
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/growth/outreach-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, requestId: retry.current.id }),
      });
      if (!response.ok) {
        setMessage(
          response.status === 401
            ? "Session expired. Sign in and retry; your entries remain here."
            : "Evidence could not be recorded. Check its dates, current account version and grant; your entries remain here.",
        );
        return;
      }
      setSavedVersion(version);
      retry.current = null;
      setMessage("Evidence recorded. Refreshing account state.");
      router.refresh();
    } catch {
      setMessage(
        "The request could not be completed. Your entries are retained for retry.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <details className={styles.editor}>
      <summary>
        {kind === "record_health"
          ? "Record health and authentication evidence"
          : "Record Gmail limits and visibility evidence"}
      </summary>
      <p>
        Enter your observed evidence and its source. Unknown fields remain held.
        Use UTC timestamps ending in Z. Recording evidence does not activate
        sending.
      </p>
      <form onSubmit={submit}>
        <Fields
          fields={kind === "record_health" ? healthFields : limitsFields}
        />
        <button
          disabled={
            pending ||
            savedVersion === account.evidenceVersion ||
            account.evidenceVersion === null
          }
          type="submit"
        >
          {pending ? "Saving…" : "Record evidence"}
        </button>
        {message && <p role="status">{message}</p>}
      </form>
    </details>
  );
}
export function CampaignAccountEvidence({
  account,
}: {
  account: CampaignAccount;
}) {
  if (account.evidenceVersion === null)
    return (
      <p>
        Evidence entry is held until the account identity and grant are
        available.
      </p>
    );
  return (
    <>
      {account.provider === "gmail" && (
        <EvidenceForm account={account} kind="record_limits" />
      )}
      <EvidenceForm account={account} kind="record_health" />
    </>
  );
}
