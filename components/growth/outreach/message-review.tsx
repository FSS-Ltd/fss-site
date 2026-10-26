import Link from "next/link";

import type { MessageReviewResult } from "@/lib/growth/dashboard/message-review";

import { EmailPreview } from "./email-preview";
import { MessageActions } from "./message-actions";
import styles from "./outreach.module.css";
import { ReviewEvidence } from "./review-evidence";
import { ResearchMessageActions } from "./research-message-actions";

export function MessageReview({ result }: { result: MessageReviewResult }) {
  if (result.status === "error") {
    return (
      <div className={styles.card} role="alert">
        <p>{result.message}</p>
        <p>Reference: {result.correlationId}</p>
      </div>
    );
  }

  if (result.status === "unavailable") {
    return (
      <div className={styles.card}>
        <p>{result.reason}</p>
        <p>
          <Link className={styles.evidenceLink} href="/growth/prospects">
            Back to prospects
          </Link>
        </p>
      </div>
    );
  }

  const { data } = result;

  return (
    <div className={styles.page}>
      <p className={styles.breadcrumb}>
        <Link href="/growth/outreach">Outreach</Link> /{" "}
        <Link href="/growth/outreach">First emails</Link> / {data.businessName}
      </p>

      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>Review first email</h1>
          <p className={styles.subtitle}>
            {data.researchOnly
              ? "Review or edit the researched draft and supporting evidence, then approve this email for sending."
              : "Check the personalised draft and evidence before it enters the Gmail sequence."}
          </p>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.column}>
          <EmailPreview message={data} />
          {data.researchOnly ? (
            <ResearchMessageActions message={data} />
          ) : (
            <MessageActions message={data} />
          )}
        </div>
        <ReviewEvidence message={data} />
      </div>
    </div>
  );
}
