/** The value network as a static strip under every inner page header, with a
 *  "0N / 0M" section counter. Inline styles on purpose: the 404 boundary and
 *  every route share the homepage stylesheet, which has no room to spare.
 *  The entrance cascade hooks on [data-mesh-band] in app/globals.css. */
const sections = [
  "services",
  "work",
  "about",
  "resources",
  "blog",
  "contact",
] as const;

export type MeshSection = (typeof sections)[number] | "notFound";

export function sectionCounter(section: MeshSection) {
  const index = sections.indexOf(section as (typeof sections)[number]) + 1;
  return `${String(index).padStart(2, "0")} / ${String(sections.length).padStart(2, "0")}`;
}

export function MeshBand({
  section,
  compact = false,
}: {
  section: MeshSection;
  /** A short header (the contact form leads the page) gets a thinner strip. */
  compact?: boolean;
}) {
  return (
    <div
      data-mesh-band
      aria-hidden="true"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        marginTop: compact ? 12 : 44,
        // Starts after the headline (globals.css reads --d for its delay).
        ["--d" as string]: "0.22s",
        color: "#665b54",
        fontFamily: "var(--font-geist-mono), monospace",
        fontSize: 11,
        letterSpacing: "0.14em",
      }}
    >
      <span>{sectionCounter(section)}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/redesign/mesh-band.svg"
        alt=""
        width={1120}
        height={120}
        decoding="async"
        style={{
          flex: 1,
          minWidth: 0,
          height: compact ? 40 : 72,
          objectFit: "cover",
          maskImage: "linear-gradient(90deg, #000 55%, transparent)",
          WebkitMaskImage: "linear-gradient(90deg, #000 55%, transparent)",
        }}
      />
    </div>
  );
}
