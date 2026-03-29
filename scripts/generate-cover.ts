type CoverInput = {
  title: string;
  category: string;
  id: string;
  pageType?: string;
};

type MotifKey = "service" | "alternatives" | "pricing" | "usecase";

const PAGE_TYPE_TO_MOTIF: Record<string, MotifKey> = {
  "service page": "service",
  "migration page": "service",
  "advisory page": "service",
  "discovery/service page": "service",
  "alternatives page": "alternatives",
  "pricing guide": "pricing",
  "use-case page": "usecase",
  "sector solution page": "usecase",
};

function wrapTitle(title: string): { line1: string; line2: string } {
  const words = title.split(" ");
  const mid = Math.ceil(words.length / 2);
  return {
    line1: words.slice(0, mid).join(" "),
    line2: words.slice(mid).join(" "),
  };
}

function buildGridLines(): string {
  const h = [108, 216, 324, 432]
    .map((y) => `<line x1="0" y1="${y}" x2="900" y2="${y}" stroke="#1a2540" stroke-width="1"/>`)
    .join("\n  ");
  const v = [180, 360, 540, 720]
    .map((x) => `<line x1="${x}" y1="0" x2="${x}" y2="540" stroke="#1a2540" stroke-width="1"/>`)
    .join("\n  ");
  return `${h}\n  ${v}`;
}

function serviceMotif(): string {
  return `
  <rect x="80" y="180" width="200" height="160" rx="12" fill="#131d33" stroke="#1e2f4d" stroke-width="1.5"/>
  <rect x="100" y="204" width="80" height="8" rx="4" fill="#6fd4ee" opacity="0.9"/>
  <rect x="100" y="222" width="140" height="7" rx="3.5" fill="#3a5080" opacity="0.6"/>
  <rect x="100" y="238" width="110" height="7" rx="3.5" fill="#3a5080" opacity="0.5"/>
  <rect x="100" y="254" width="120" height="7" rx="3.5" fill="#3a5080" opacity="0.4"/>
  <rect x="100" y="290" width="90" height="7" rx="3.5" fill="#6fd4ee" opacity="0.25"/>
  <rect x="100" y="308" width="130" height="7" rx="3.5" fill="#3a5080" opacity="0.35"/>
  <line x1="290" y1="260" x2="340" y2="260" stroke="#6fd4ee" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.5"/>
  <rect x="345" y="200" width="200" height="120" rx="12" fill="#131d33" stroke="#3a6ea8" stroke-width="1.5"/>
  <rect x="365" y="222" width="60" height="8" rx="4" fill="#6fd4ee" opacity="0.7"/>
  <rect x="365" y="240" width="140" height="7" rx="3.5" fill="#3a5080" opacity="0.5"/>
  <rect x="365" y="256" width="120" height="7" rx="3.5" fill="#3a5080" opacity="0.4"/>
  <rect x="365" y="274" width="100" height="7" rx="3.5" fill="#3a5080" opacity="0.3"/>
  <line x1="555" y1="260" x2="605" y2="260" stroke="#6fd4ee" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.5"/>
  <rect x="610" y="220" width="200" height="80" rx="12" fill="#0f1a2e" stroke="#6fd4ee" stroke-width="2"/>
  <circle cx="700" cy="260" r="18" fill="#131d33" stroke="#6fd4ee" stroke-width="2"/>
  <text x="700" y="265" text-anchor="middle" font-family="monospace" font-size="10" fill="#6fd4ee" font-weight="bold">BUILD</text>`;
}

function alternativesMotif(): string {
  return `
  <rect x="80" y="180" width="330" height="200" rx="12" fill="#131d33" stroke="#3a5080" stroke-width="1.5"/>
  <rect x="100" y="202" width="120" height="8" rx="4" fill="#3a5080" opacity="0.7"/>
  <rect x="100" y="222" width="280" height="7" rx="3.5" fill="#3a5080" opacity="0.5"/>
  <rect x="100" y="238" width="260" height="7" rx="3.5" fill="#3a5080" opacity="0.4"/>
  <rect x="100" y="254" width="240" height="7" rx="3.5" fill="#3a5080" opacity="0.35"/>
  <rect x="100" y="276" width="100" height="20" rx="5" fill="#1a2e4a"/>
  <text x="150" y="291" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#7a98c0">Off-the-shelf</text>
  <rect x="210" y="276" width="100" height="20" rx="5" fill="#1a2e4a"/>
  <text x="260" y="291" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#7a98c0">Bespoke</text>
  <rect x="100" y="308" width="280" height="7" rx="3.5" fill="#3a5080" opacity="0.3"/>
  <rect x="100" y="324" width="200" height="7" rx="3.5" fill="#3a5080" opacity="0.25"/>
  <line x1="265" y1="192" x2="265" y2="370" stroke="#1e2f4d" stroke-width="1" stroke-dasharray="4 4"/>
  <rect x="480" y="200" width="330" height="160" rx="12" fill="#131d33" stroke="#6fd4ee" stroke-width="1.5" opacity="0.8"/>
  <rect x="500" y="222" width="80" height="8" rx="4" fill="#6fd4ee" opacity="0.9"/>
  <rect x="500" y="242" width="280" height="7" rx="3.5" fill="#3a5080" opacity="0.6"/>
  <rect x="500" y="258" width="260" height="7" rx="3.5" fill="#3a5080" opacity="0.5"/>
  <rect x="500" y="274" width="240" height="7" rx="3.5" fill="#3a5080" opacity="0.45"/>
  <rect x="500" y="300" width="280" height="7" rx="3.5" fill="#6fd4ee" opacity="0.2"/>
  <rect x="500" y="316" width="200" height="7" rx="3.5" fill="#3a5080" opacity="0.35"/>`;
}

function pricingMotif(): string {
  return `
  <rect x="60" y="175" width="220" height="190" rx="12" fill="#131d33" stroke="#1e2f4d" stroke-width="1.5"/>
  <rect x="80" y="198" width="80" height="8" rx="4" fill="#3a5080" opacity="0.7"/>
  <rect x="80" y="224" width="60" height="28" rx="6" fill="#1a2e4a"/>
  <text x="110" y="244" text-anchor="middle" font-family="monospace" font-size="14" fill="#7a98c0" font-weight="bold">£ — £</text>
  <rect x="80" y="266" width="160" height="7" rx="3.5" fill="#3a5080" opacity="0.4"/>
  <rect x="80" y="282" width="140" height="7" rx="3.5" fill="#3a5080" opacity="0.35"/>
  <rect x="80" y="298" width="120" height="7" rx="3.5" fill="#3a5080" opacity="0.3"/>
  <rect x="340" y="155" width="220" height="230" rx="12" fill="#0f1a2e" stroke="#6fd4ee" stroke-width="2"/>
  <rect x="360" y="177" width="100" height="8" rx="4" fill="#6fd4ee" opacity="0.9"/>
  <rect x="360" y="202" width="70" height="32" rx="6" fill="#1a2e4a"/>
  <text x="395" y="225" text-anchor="middle" font-family="monospace" font-size="14" fill="#6fd4ee" font-weight="bold">££ — £££</text>
  <rect x="360" y="248" width="160" height="7" rx="3.5" fill="#6fd4ee" opacity="0.3"/>
  <rect x="360" y="264" width="140" height="7" rx="3.5" fill="#3a5080" opacity="0.5"/>
  <rect x="360" y="280" width="160" height="7" rx="3.5" fill="#3a5080" opacity="0.4"/>
  <rect x="360" y="296" width="120" height="7" rx="3.5" fill="#3a5080" opacity="0.35"/>
  <rect x="620" y="175" width="220" height="190" rx="12" fill="#131d33" stroke="#1e2f4d" stroke-width="1.5"/>
  <rect x="640" y="198" width="80" height="8" rx="4" fill="#3a5080" opacity="0.7"/>
  <rect x="640" y="224" width="60" height="28" rx="6" fill="#1a2e4a"/>
  <text x="670" y="244" text-anchor="middle" font-family="monospace" font-size="14" fill="#7a98c0" font-weight="bold">£££+</text>
  <rect x="640" y="266" width="160" height="7" rx="3.5" fill="#3a5080" opacity="0.4"/>
  <rect x="640" y="282" width="140" height="7" rx="3.5" fill="#3a5080" opacity="0.35"/>`;
}

function usecaseMotif(): string {
  return `
  <defs>
    <marker id="uc-arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
      <path d="M0,0 L0,6 L6,3 z" fill="#6fd4ee" opacity="0.6"/>
    </marker>
  </defs>
  <rect x="60" y="210" width="160" height="110" rx="12" fill="#131d33" stroke="#3a5080" stroke-width="1.5"/>
  <text x="140" y="262" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#7a98c0" font-weight="bold">PROBLEM</text>
  <rect x="80" y="278" width="120" height="7" rx="3.5" fill="#3a5080" opacity="0.5"/>
  <rect x="80" y="294" width="100" height="7" rx="3.5" fill="#3a5080" opacity="0.4"/>
  <path d="M 228 265 L 278 265" stroke="#6fd4ee" stroke-width="1.5" marker-end="url(#uc-arr)" opacity="0.6"/>
  <rect x="283" y="190" width="180" height="150" rx="12" fill="#131d33" stroke="#6fd4ee" stroke-width="1.5" opacity="0.8"/>
  <text x="373" y="258" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#6fd4ee" font-weight="bold">PROCESS</text>
  <rect x="303" y="272" width="140" height="7" rx="3.5" fill="#6fd4ee" opacity="0.25"/>
  <rect x="303" y="288" width="120" height="7" rx="3.5" fill="#3a5080" opacity="0.5"/>
  <rect x="303" y="304" width="130" height="7" rx="3.5" fill="#3a5080" opacity="0.4"/>
  <path d="M 471 265 L 521 265" stroke="#6fd4ee" stroke-width="1.5" marker-end="url(#uc-arr)" opacity="0.6"/>
  <rect x="526" y="210" width="300" height="110" rx="12" fill="#0f1a2e" stroke="#6fd4ee" stroke-width="2"/>
  <text x="676" y="262" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#6fd4ee" font-weight="bold">OUTCOME</text>
  <circle cx="570" cy="286" r="5" fill="#6fd4ee" opacity="0.7"/>
  <circle cx="590" cy="286" r="5" fill="#6fd4ee" opacity="0.5"/>
  <circle cx="610" cy="286" r="5" fill="#6fd4ee" opacity="0.3"/>
  <rect x="630" y="280" width="160" height="7" rx="3.5" fill="#3a5080" opacity="0.4"/>`;
}

const MOTIF_GENERATORS: Record<MotifKey, () => string> = {
  service: serviceMotif,
  alternatives: alternativesMotif,
  pricing: pricingMotif,
  usecase: usecaseMotif,
};

export function generateCoverSvg(input: CoverInput): string {
  const motifKey: MotifKey = PAGE_TYPE_TO_MOTIF[input.pageType ?? "service page"] ?? "service";
  const motif = MOTIF_GENERATORS[motifKey]();
  const { line1, line2 } = wrapTitle(input.title);
  const categoryLabel = input.category.toUpperCase();
  const categoryWidth = Math.max(80, categoryLabel.length * 8 + 24);
  const categoryX = 60 + categoryWidth / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 540" fill="none">
  <rect width="900" height="540" fill="#0d1424"/>
  ${buildGridLines()}
  <radialGradient id="glow-${input.id}" cx="70%" cy="25%" r="45%">
    <stop offset="0%" stop-color="#6fd4ee" stop-opacity="0.16"/>
    <stop offset="100%" stop-color="#6fd4ee" stop-opacity="0"/>
  </radialGradient>
  <rect width="900" height="540" fill="url(#glow-${input.id})"/>
  ${motif}
  <rect x="0" y="480" width="900" height="60" fill="#0a1020" opacity="0.8"/>
  <rect x="0" y="480" width="900" height="1" fill="#1e2f4d"/>
  <rect x="60" y="496" width="${categoryWidth}" height="24" rx="12" fill="#6fd4ee" opacity="0.12"/>
  <text x="${categoryX}" y="513" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#6fd4ee" font-weight="bold" letter-spacing="1">${categoryLabel}</text>
  <text x="60" y="72" font-family="sans-serif" font-size="26" font-weight="800" fill="#ffffff">${line1}</text>
  <text x="60" y="106" font-family="sans-serif" font-size="26" font-weight="800" fill="#6fd4ee">${line2}</text>
</svg>`;
}
