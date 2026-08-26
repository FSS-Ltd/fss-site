import type { PublishedProspectPreview } from "@/lib/growth/prospect-previews/public-repository";

type PreviewSectionProps = {
  eyebrow: string;
  summary: string;
  items: readonly string[];
};

function PreviewSection({ eyebrow, summary, items }: PreviewSectionProps) {
  return (
    <section className="border-t border-slate-200 px-6 py-12 sm:px-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
        {eyebrow}
      </p>
      <h2 className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
        {summary}
      </h2>
      <ul className="mt-7 grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <li
            className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-700 shadow-sm"
            key={item}
          >
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
    <main className="min-h-screen bg-slate-100 px-4 py-6 font-sans text-slate-950 sm:px-8 sm:py-10">
      <article className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
        <header className="bg-[radial-gradient(circle_at_top_left,_#d9f7f6,_#ffffff_54%,_#e2e8f0)] px-6 py-14 sm:px-10 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-800">
            Private website concept
          </p>
          <p className="mt-5 text-sm font-medium text-slate-600">
            {content.sector} · {content.locality}
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-6xl">
            Concept for {content.businessName}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
            {content.businessGoal}
          </p>
          <div className="mt-9 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
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

        <footer className="border-t border-slate-200 bg-slate-50 px-6 py-7 text-sm leading-6 text-slate-600 sm:px-10">
          This private concept is an example of a clearer customer journey. It
          is not connected to a live service.
        </footer>
      </article>
    </main>
  );
}
