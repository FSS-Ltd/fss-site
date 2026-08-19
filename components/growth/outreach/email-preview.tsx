"use client";

import { useState } from "react";

import { formatGrowthEvidenceCount } from "@/lib/growth/dashboard/formatters";
import type { MessageReviewData } from "@/lib/growth/dashboard/message-review";

import styles from "./outreach.module.css";

type PreviewMode = "html" | "text";

export function EmailPreview({ message }: { message: MessageReviewData }) {
  const [mode, setMode] = useState<PreviewMode>("html");

  return (
    <div className={styles.card}>
      <h2 className={styles.sectionTitle}>Email draft</h2>

      <div className={styles.envelope}>
        <div className={styles.envelopeRow}>
          <span className={styles.envelopeLabel}>To</span>
          <span className={styles.envelopeValue}>
            {message.contactName} &lt;{message.contactEmail}&gt;
          </span>
        </div>
        <div className={styles.envelopeRow}>
          <span className={styles.envelopeLabel}>From</span>
          <span className={styles.envelopeValue}>
            Jean-Fidele at Faithful Software Solutions &lt;{message.founderEmail}
            &gt;
          </span>
        </div>
        <div className={styles.envelopeRow}>
          <span className={styles.envelopeLabel}>Subject</span>
          <span className={styles.envelopeValue}>{message.subject}</span>
        </div>
      </div>

      <div
        aria-label="Preview format"
        className={styles.previewToggle}
        role="group"
      >
        <button
          aria-pressed={mode === "html"}
          className={styles.previewToggleButton}
          onClick={() => setMode("html")}
          type="button"
        >
          HTML
        </button>
        <button
          aria-pressed={mode === "text"}
          className={styles.previewToggleButton}
          onClick={() => setMode("text")}
          type="button"
        >
          Plain text
        </button>
      </div>

      {mode === "html" ? (
        <div className={styles.previewFrame}>
          <iframe
            sandbox=""
            srcDoc={message.previewHtml}
            title="Email HTML preview"
          />
        </div>
      ) : (
        <pre className={styles.previewPlainText}>{message.previewText}</pre>
      )}

      <p className={styles.previewMeta}>
        <span>{message.wordCount} words</span>
        <span>
          {message.visualKind === "stored" ? "One approved visual" : "Fallback visual"}
        </span>
        <span>Plain-text fallback ready</span>
        <span>No tracking pixel</span>
        <span>{formatGrowthEvidenceCount(message.citations.length)} cited</span>
      </p>
    </div>
  );
}
