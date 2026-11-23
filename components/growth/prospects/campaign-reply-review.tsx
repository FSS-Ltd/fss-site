"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CampaignReplies,
  CampaignReply,
} from "@/lib/growth/dashboard/prospect-campaign-replies";
import { formatGrowthDateTime } from "@/lib/growth/dashboard/formatters";
import styles from "./campaign-review.module.css";

type Kind = NonNullable<CampaignReply["review"]>["kind"];
const names: Record<Kind, string> = {
  positive: "Positive",
  negative: "Negative",
  bot: "Automated message",
  out_of_office: "Out of office",
  opt_out: "Opt out",
  unknown: "Unknown",
};
function effect(kind: Kind): string {
  if (kind === "opt_out")
    return "This records an opt-out, suppresses future outreach and stops remaining follow-ups.";
  if (kind === "bot" || kind === "out_of_office")
    return "This records the classification without stopping the sequence.";
  return "This records the classification and stops any remaining follow-ups.";
}
function ReplyItem({ reply }: { reply: CampaignReply }) {
  const router = useRouter();
  const id = useId();
  const [kind, setKind] = useState<Kind | "">("");
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  const retry = useRef<{ payload: string; id: string } | null>(null);
  useEffect(() => {
    if (message) feedback.current?.focus();
  }, [message]);
  async function submit() {
    if (!kind) return;
    const body = {
      type: "record_reply",
      membershipId: reply.membershipId,
      inboundMessageId: reply.messageId,
      expectedPolicyVersion: reply.policyVersion,
      expectedProspectVersion: reply.prospectVersion,
      expectedContactVersion: reply.contactVersion,
      kind,
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
        setSessionExpired(response.status === 401);
        setMessage(
          response.status === 401
            ? "Your session expired. Sign in again; your selection is retained."
            : response.status === 409
              ? "The reply or record changed, or its attribution is unavailable. Your selection is retained; refresh and review before retrying."
              : "Could not record the classification. Your selection is retained; try again.",
        );
        return;
      }
      retry.current = null;
      setSaved(true);
      setConfirm(false);
      setMessage("Reply classification recorded.");
      router.refresh();
    } catch {
      setMessage(
        "Could not record the classification. Your selection is retained; try again.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <li className={styles.reply}>
      <h4>Received {formatGrowthDateTime(reply.receivedAt)}</h4>
      <p>
        <a href={reply.gmailUrl} target="_blank" rel="noreferrer">
          Open Gmail thread
        </a>{" "}
        to read the message before classifying it.
      </p>
      {reply.review ? (
        <p>
          Reviewed as {names[reply.review.kind]} ·{" "}
          {formatGrowthDateTime(reply.review.recordedAt)}
        </p>
      ) : (
        <>
          <p>Not reviewed for campaign reporting.</p>
          <label htmlFor={id}>Founder classification</label>
          <select
            id={id}
            value={kind}
            disabled={pending || saved}
            onChange={(event) => {
              const next = event.target.value;
              if (
                next === "positive" ||
                next === "negative" ||
                next === "bot" ||
                next === "out_of_office" ||
                next === "opt_out" ||
                next === "unknown" ||
                next === ""
              )
                setKind(next);
              setConfirm(false);
              setMessage("");
            }}
          >
            <option value="">Choose a classification</option>
            {Object.entries(names).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {kind && <p>{effect(kind)}</p>}
          {!confirm ? (
            <button
              ref={trigger}
              type="button"
              disabled={!kind || pending || saved}
              onClick={() => setConfirm(true)}
            >
              Review classification
            </button>
          ) : (
            <div>
              <p>
                Confirm {kind ? names[kind] : "classification"} for this reply?
              </p>
              <button
                autoFocus
                type="button"
                disabled={pending}
                onClick={submit}
              >
                {pending ? "Saving…" : "Confirm classification"}
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
        </>
      )}
      {message && (
        <p ref={feedback} tabIndex={-1} role={saved ? "status" : "alert"}>
          {message}{" "}
          {sessionExpired && (
            <a href="/growth/login" target="_blank" rel="noreferrer">
              Sign in in a new tab
            </a>
          )}
        </p>
      )}
    </li>
  );
}
export function CampaignReplyReview({ result }: { result: CampaignReplies }) {
  return (
    <section
      className={styles.enrol}
      aria-labelledby="campaign-replies-heading"
    >
      <h3 id="campaign-replies-heading">Campaign replies</h3>
      {result.status === "unavailable" ? (
        <p role="alert">Reply review is unavailable. Refresh to try again.</p>
      ) : (
        <>
          {result.items.length === 0 ? (
            <p>
              No attributable Gmail replies were found among the messages
              checked.
            </p>
          ) : (
            <>
              <p>
                Open each message and classify it yourself. Message bodies are
                not shown here.
              </p>
              <ul className={styles.replies}>
                {result.items.map((reply) => (
                  <ReplyItem key={reply.messageId} reply={reply} />
                ))}
              </ul>
            </>
          )}
          {result.truncated && (
            <p>Only the 20 most recent candidate messages were checked.</p>
          )}
        </>
      )}
    </section>
  );
}
