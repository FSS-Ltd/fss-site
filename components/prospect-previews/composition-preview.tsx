import type { CSSProperties, ReactNode } from "react";

import type { ProspectPreviewComposition } from "@/lib/growth/prospect-previews/compositions/types";

import { CompositionHero } from "./composition-modules/composition-hero";
import { CompositionJourney } from "./composition-modules/composition-journey";
import { CompositionOwnerCta } from "./composition-modules/composition-owner-cta";
import { CompositionSection } from "./composition-modules/composition-section";

type PreviewTheme = CSSProperties & {
  "--preview-background": string;
  "--preview-surface": string;
  "--preview-ink": string;
  "--preview-muted": string;
  "--preview-accent": string;
  "--preview-accent-contrast": string;
};

const themes: Record<ProspectPreviewComposition["visualDirection"], PreviewTheme> = {
  "precision-dark": {
    "--preview-background": "#121719",
    "--preview-surface": "#1d2526",
    "--preview-ink": "#f8f4ea",
    "--preview-muted": "#c5c9c0",
    "--preview-accent": "#e1aa4b",
    "--preview-accent-contrast": "#121719",
  },
  "warm-editorial": {
    "--preview-background": "#f7eee3",
    "--preview-surface": "#fffaf4",
    "--preview-ink": "#35261e",
    "--preview-muted": "#775d4c",
    "--preview-accent": "#a14a2d",
    "--preview-accent-contrast": "#ffffff",
  },
  "calm-architectural": {
    "--preview-background": "#eaf0ed",
    "--preview-surface": "#fbfdfb",
    "--preview-ink": "#1a3330",
    "--preview-muted": "#58706b",
    "--preview-accent": "#287066",
    "--preview-accent-contrast": "#ffffff",
  },
  "local-service": {
    "--preview-background": "#edf3f3",
    "--preview-surface": "#ffffff",
    "--preview-ink": "#12333b",
    "--preview-muted": "#527079",
    "--preview-accent": "#0e6c80",
    "--preview-accent-contrast": "#ffffff",
  },
  "considered-ledger": {
    "--preview-background": "#f2f2ed",
    "--preview-surface": "#fdfdf9",
    "--preview-ink": "#262b29",
    "--preview-muted": "#636a66",
    "--preview-accent": "#4b5d45",
    "--preview-accent-contrast": "#ffffff",
  },
};

type CompositionPreviewProps = {
  composition: ProspectPreviewComposition;
  mode: "public" | "review";
};

export function CompositionPreview({
  composition,
  mode,
}: CompositionPreviewProps) {
  const sections: Record<ProspectPreviewComposition["sectionOrder"][number], ReactNode> = {
    hero: <CompositionHero composition={composition} />,
    proof: <CompositionSection eyebrow="Trust" section={composition.content.trustSignals} />,
    services: <CompositionSection eyebrow="A clearer route" section={composition.content.homepageSections} />,
    "case-for-change": <CompositionSection eyebrow="The next step" section={composition.content.conversionPlan} />,
    journey: <CompositionJourney composition={composition} />,
    locality: (
      <section className="grid gap-5 border-t border-black/10 py-8 sm:py-14 lg:grid-cols-[minmax(12rem,.42fr)_minmax(0,1fr)]">
        <p className="m-0 text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--preview-accent)]">Local focus</p>
        <div>
          <h2 className="m-0 text-[clamp(1.7rem,4vw,3rem)] font-semibold tracking-[-0.045em] leading-[1.05]">
            Designed around a clearer first step in {composition.copy.locality}.
          </h2>
        </div>
      </section>
    ),
    "owner-cta": <CompositionOwnerCta mode={mode} />,
  };

  return (
    <main
      className="min-h-screen bg-[var(--preview-background)] text-[var(--preview-ink)]"
      data-preview-family={composition.family}
      data-visual-direction={composition.visualDirection}
      style={themes[composition.visualDirection]}
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-8 sm:py-8">
        {composition.sectionOrder.map((section) => (
          <div key={section}>{sections[section]}</div>
        ))}
      </div>
    </main>
  );
}
