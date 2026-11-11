import type { ProspectPreviewComposition } from "@/lib/growth/prospect-previews/compositions/types";

type CompositionSectionProps = {
  eyebrow: string;
  section: ProspectPreviewComposition["content"]["homepageSections"];
};

export function CompositionSection({
  eyebrow,
  section,
}: CompositionSectionProps) {
  return (
    <section className="grid gap-5 border-t border-black/10 py-8 sm:py-14 lg:grid-cols-[minmax(12rem,.42fr)_minmax(0,1fr)]">
      <p className="m-0 text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--preview-accent)]">
        {eyebrow}
      </p>
      <div>
        <h2 className="m-0 text-[clamp(1.7rem,4vw,3rem)] font-semibold tracking-[-0.045em] leading-[1.05]">
          {section.summary}
        </h2>
        <ul className="mt-6 grid list-none gap-3 p-0">
          {section.items.map((item) => (
            <li className="rounded-2xl border border-black/10 bg-[var(--preview-surface)] px-4 py-3 leading-6 text-[var(--preview-muted)]" key={item}>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
