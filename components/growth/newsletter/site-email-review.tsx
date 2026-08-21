"use client";

import { useState } from "react";
import Link from "next/link";

import {
  formatGrowthDateTime,
  formatGrowthStatusLabel,
} from "@/lib/growth/dashboard/formatters";
import type {
  EmailTemplateReview,
  EmailTemplateSummary,
} from "@/lib/growth/dashboard/newsletter";

import styles from "./newsletter.module.css";

type PreviewMode = "html" | "text";

function templateDisplayName(templateKey: string): string {
  return templateKey
    .split("-")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

export function SiteEmailReview({
  fromEmail,
  replyToEmail,
  selected,
  templates,
}: {
  fromEmail: string | null;
  replyToEmail: string | null;
  selected: EmailTemplateReview;
  templates: readonly EmailTemplateSummary[];
}) {
  const [mode, setMode] = useState<PreviewMode>("html");

  return (
    <div className={styles.page}>
      <p className={styles.breadcrumb}>
        <Link href="/growth/newsletter">Newsletter</Link> / Email templates /{" "}
        {templateDisplayName(selected.templateKey)}
      </p>

      <div className={styles.header}>
        <div>
          <div className={styles.headerTitles}>
            <h1 className={styles.heading}>Review site email</h1>
            <span className={styles.pill} data-tone="neutral">
              {formatGrowthStatusLabel(selected.status)} v{selected.version}
            </span>
          </div>
          <p className={styles.subtitle}>
            Complete copy and imagery for people who have asked FSS to
            contact them.
          </p>
        </div>
      </div>

      <div className={styles.templateLayout}>
        <nav aria-label="Email templates" className={styles.card}>
          <h2 className={styles.sectionTitle}>Templates</h2>
          <ul className={styles.templateList}>
            {templates.map((template) => (
              <li key={template.templateId}>
                <Link
                  aria-current={
                    template.templateId === selected.templateId
                      ? "page"
                      : undefined
                  }
                  className={styles.templateListLink}
                  href={`/growth/settings/email-templates?templateId=${template.templateId}`}
                >
                  <span className={styles.templateListLinkKey}>
                    {templateDisplayName(template.templateKey)}
                  </span>
                  <span className={styles.templateListLinkStatus}>
                    {formatGrowthStatusLabel(template.status)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.card}>
          <div className={styles.envelope}>
            {selected.renderedSubject && (
              <div className={styles.envelopeRow}>
                <span className={styles.envelopeLabel}>Subject</span>
                <span className={styles.envelopeValue}>
                  {selected.renderedSubject}
                </span>
              </div>
            )}
            <div className={styles.envelopeRow}>
              <span className={styles.envelopeLabel}>From</span>
              <span className={styles.envelopeValue}>
                {fromEmail ?? "Not configured"}
              </span>
            </div>
            <div className={styles.envelopeRow}>
              <span className={styles.envelopeLabel}>Reply to</span>
              <span className={styles.envelopeValue}>
                {replyToEmail ?? "Not configured"}
              </span>
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
                srcDoc={selected.renderedHtml}
                title="Site email HTML preview"
              />
            </div>
          ) : (
            <pre className={styles.previewPlainText}>{selected.renderedText}</pre>
          )}

          <p className={styles.subtitle}>
            Rendered with representative fixture data, never a real
            subscriber or client record:{" "}
            {selected.requiredFields.length === 0
              ? "no personalisation fields."
              : selected.requiredFields
                  .map((field) => `${field} = "${selected.fixtureFields[field]}"`)
                  .join(", ")}
          </p>
        </div>

        <div className={styles.column}>
          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Template settings</h2>
            <ul className={styles.metaList}>
              <li className={styles.metaItem}>
                <span className={styles.metaLabel}>Channel</span>
                <span className={styles.metaValue}>Resend</span>
              </li>
              {selected.category && (
                <li className={styles.metaItem}>
                  <span className={styles.metaLabel}>Category</span>
                  <span className={styles.metaValue}>
                    {formatGrowthStatusLabel(selected.category)}
                  </span>
                </li>
              )}
              <li className={styles.metaItem}>
                <span className={styles.metaLabel}>Checksum</span>
                <span className={styles.metaValue}>
                  {selected.checksum.slice(0, 12)}…
                </span>
              </li>
            </ul>
          </div>

          {selected.publishedAt && (
            <div className={styles.card}>
              <h2 className={styles.sectionTitle}>Publish history</h2>
              <ul className={styles.metaList}>
                <li className={styles.metaItem}>
                  <span className={styles.metaLabel}>Published</span>
                  <span className={styles.metaValue}>
                    {formatGrowthDateTime(selected.publishedAt)}
                  </span>
                </li>
                {selected.publishedBy && (
                  <li className={styles.metaItem}>
                    <span className={styles.metaLabel}>Published by</span>
                    <span className={styles.metaValue}>{selected.publishedBy}</span>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
