import type { ProspectPreviewComposition } from "@/lib/growth/prospect-previews/compositions/types";

function HeroArtwork({
  treatment,
}: {
  treatment: ProspectPreviewComposition["heroTreatment"];
}) {
  if (treatment === "workshop-geometry") {
    return (
      <svg aria-hidden="true" viewBox="0 0 600 440">
        <rect fill="currentColor" height="440" opacity="0.94" width="600" />
        <circle cx="455" cy="130" fill="var(--preview-accent)" r="110" />
        <path d="M60 344 244 146l136 198H60Z" fill="var(--preview-surface)" opacity="0.94" />
        <path d="M214 386 390 204l150 182H214Z" fill="var(--preview-background)" opacity="0.3" />
        <rect fill="var(--preview-accent)" height="8" rx="4" width="160" x="70" y="83" />
      </svg>
    );
  }

  if (treatment === "service-map" || treatment === "local-silhouette") {
    return (
      <svg aria-hidden="true" viewBox="0 0 600 440">
        <rect fill="var(--preview-surface)" height="440" width="600" />
        <path d="M-10 335C115 227 202 409 325 264S486 123 620 179" fill="none" stroke="var(--preview-accent)" strokeWidth="26" />
        <path d="M-10 98C128 203 179 24 325 120S485 341 620 294" fill="none" opacity="0.3" stroke="currentColor" strokeWidth="19" />
        <circle cx="310" cy="256" fill="var(--preview-accent)" r="33" />
        <circle cx="310" cy="256" fill="var(--preview-surface)" r="13" />
      </svg>
    );
  }

  if (treatment === "crafted-table") {
    return (
      <svg aria-hidden="true" viewBox="0 0 600 440">
        <rect fill="var(--preview-surface)" height="440" width="600" />
        <circle cx="300" cy="220" fill="var(--preview-accent)" r="132" />
        <circle cx="300" cy="220" fill="var(--preview-background)" r="84" />
        <path d="M90 84h420v272H90z" fill="none" opacity="0.25" stroke="currentColor" strokeWidth="8" />
        <path d="m161 307 77-115 67 94 84-139 69 160H161Z" fill="var(--preview-ink)" opacity="0.18" />
      </svg>
    );
  }

  if (treatment === "property-frame") {
    return (
      <svg aria-hidden="true" viewBox="0 0 600 440">
        <rect fill="var(--preview-surface)" height="440" width="600" />
        <rect fill="var(--preview-accent)" height="305" rx="18" width="336" x="132" y="68" />
        <rect fill="var(--preview-background)" height="220" rx="8" width="247" x="176" y="112" />
        <path d="m190 286 83-97 65 61 54-71 18 107H190Z" fill="currentColor" opacity="0.22" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 600 440">
      <rect fill="var(--preview-surface)" height="440" width="600" />
      {Array.from({ length: 7 }, (_, index) => (
        <rect
          fill={index % 2 === 0 ? "var(--preview-accent)" : "currentColor"}
          height="38"
          key={index}
          opacity={index % 2 === 0 ? 0.85 : 0.15}
          rx="8"
          width={index % 2 === 0 ? 310 : 405}
          x="96"
          y={64 + index * 47}
        />
      ))}
    </svg>
  );
}

export function CompositionHero({
  composition,
}: {
  composition: ProspectPreviewComposition;
}) {
  return (
    <header className="grid min-h-[min(44rem,calc(100vh-4rem))] items-center gap-8 py-8 sm:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,.9fr)] lg:gap-16">
      <div>
        <p className="m-0 text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--preview-accent)]">
          {composition.copy.businessName} · {composition.copy.locality}
        </p>
        <h1 className="mt-4 max-w-[12ch] text-[clamp(3rem,8vw,6.25rem)] font-semibold tracking-[-0.065em] leading-[0.96]">
          {composition.copy.headline}
        </h1>
        <p className="mt-6 max-w-2xl text-[clamp(1.05rem,2vw,1.3rem)] leading-7 text-[var(--preview-muted)]">
          {composition.content.businessGoal}
        </p>
      </div>
      <div className="min-h-88 overflow-hidden rounded-[2rem] border border-black/10 bg-[var(--preview-surface)] shadow-2xl shadow-black/15">
        <HeroArtwork treatment={composition.heroTreatment} />
      </div>
    </header>
  );
}
