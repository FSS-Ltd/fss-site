import type { CSSProperties } from "react";

import type { PublishedProspectPreview } from "@/lib/growth/prospect-previews/public-repository";

type PreviewSectionProps = {
  eyebrow: string;
  summary: string;
  items: readonly string[];
};

const previewStyle: CSSProperties = {
  minHeight: "100vh",
  padding: "clamp(1.5rem, 4vw, 2.5rem) clamp(1rem, 4vw, 2rem)",
  background: "#f1f5f9",
  color: "#020617",
};

const articleStyle: CSSProperties = {
  maxWidth: "64rem",
  margin: "0 auto",
  overflow: "hidden",
  border: "1px solid #e2e8f0",
  borderRadius: "2rem",
  background: "#ffffff",
  boxShadow: "0 24px 80px rgba(15, 23, 42, 0.12)",
};

const headerStyle: CSSProperties = {
  padding: "clamp(3.5rem, 8vw, 5rem) clamp(1.5rem, 5vw, 2.5rem)",
  background:
    "radial-gradient(circle at top left, #d9f7f6, #ffffff 54%, #e2e8f0)",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#0e7490",
  fontSize: "0.75rem",
  fontWeight: 600,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
};

const sectionStyle: CSSProperties = {
  borderTop: "1px solid #e2e8f0",
  padding: "clamp(3rem, 6vw, 3.5rem) clamp(1.5rem, 5vw, 2.5rem)",
};

const sectionHeadingStyle: CSSProperties = {
  maxWidth: "42rem",
  margin: "0.75rem 0 0",
  color: "#020617",
  fontSize: "clamp(1.5rem, 3vw, 1.875rem)",
  fontWeight: 600,
  letterSpacing: "-0.025em",
  lineHeight: 1.2,
};

const itemListStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 15rem), 1fr))",
  gap: "0.75rem",
  margin: "1.75rem 0 0",
  padding: 0,
  listStyle: "none",
};

const itemStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "1rem",
  padding: "1rem",
  background: "#ffffff",
  color: "#334155",
  fontSize: "0.875rem",
  lineHeight: "1.5rem",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
};

function PreviewSection({ eyebrow, summary, items }: PreviewSectionProps) {
  return (
    <section style={sectionStyle}>
      <p style={eyebrowStyle}>{eyebrow}</p>
      <h2 style={sectionHeadingStyle}>{summary}</h2>
      <ul style={itemListStyle}>
        {items.map((item) => (
          <li key={item} style={itemStyle}>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProductionProspectPreview({
  preview,
}: {
  preview: PublishedProspectPreview;
}) {
  const { content } = preview;

  return (
    <main style={previewStyle}>
      <article style={articleStyle}>
        <header style={headerStyle}>
          <p style={eyebrowStyle}>Private website concept</p>
          <p
            style={{
              margin: "1.25rem 0 0",
              color: "#475569",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            {content.sector} · {content.locality}
          </p>
          <h1
            style={{
              maxWidth: "48rem",
              margin: "0.75rem 0 0",
              color: "#020617",
              fontSize: "clamp(2.25rem, 6vw, 3.75rem)",
              fontWeight: 600,
              letterSpacing: "-0.04em",
              lineHeight: 1.1,
            }}
          >
            Concept for {content.businessName}
          </h1>
          <p
            style={{
              maxWidth: "42rem",
              margin: "1.5rem 0 0",
              color: "#334155",
              fontSize: "1.125rem",
              lineHeight: "2rem",
            }}
          >
            {content.businessGoal}
          </p>
          <div
            style={{
              display: "inline-flex",
              marginTop: "2.25rem",
              borderRadius: "999px",
              padding: "0.75rem 1.25rem",
              background: "#020617",
              color: "#ffffff",
              fontSize: "0.875rem",
              fontWeight: 600,
            }}
          >
            {content.primaryCta}
          </div>
        </header>

        <PreviewSection
          eyebrow="Homepage structure"
          summary={content.homepageSections.summary}
          items={content.homepageSections.items}
        />
        <PreviewSection
          eyebrow="Customer journey"
          summary={content.conversionPlan.summary}
          items={content.conversionPlan.items}
        />
        <PreviewSection
          eyebrow="Trust"
          summary={content.trustSignals.summary}
          items={content.trustSignals.items}
        />

        <footer
          style={{
            borderTop: "1px solid #e2e8f0",
            padding: "1.75rem clamp(1.5rem, 5vw, 2.5rem)",
            background: "#f8fafc",
            color: "#475569",
            fontSize: "0.875rem",
            lineHeight: "1.5rem",
          }}
        >
          This private concept is an example of a clearer customer journey. It
          is not connected to a live service.
        </footer>
      </article>
    </main>
  );
}
