import { readFileSync } from "node:fs";

const files = {
  interactions: readFileSync(
    "components/redesign/fss-interactions.tsx",
    "utf8",
  ),
  header: readFileSync("components/layout/site-header.tsx", "utf8"),
  headerNavItems: readFileSync(
    "components/layout/site-header-nav-items.ts",
    "utf8",
  ),
  footer: readFileSync("components/layout/site-footer.tsx", "utf8"),
  fragments: readFileSync("components/redesign/design-fragments.ts", "utf8"),
  layout: readFileSync("app/layout.tsx", "utf8"),
  shell: readFileSync("components/layout/site-shell.tsx", "utf8"),
};

const failures = [];

if (!files.interactions.includes("usePathname")) {
  failures.push(
    "FssInteractions must re-initialize on App Router pathname changes.",
  );
}

if (
  !/\[\s*motion\s*,\s*nodeDensity\s*,\s*pathname\s*\]/.test(files.interactions)
) {
  failures.push(
    "FssInteractions useEffect dependencies must include pathname.",
  );
}

if (
  !files.headerNavItems.includes('label: "Blog"') ||
  !files.headerNavItems.includes('href: "/blog"')
) {
  failures.push("SiteHeader must expose the blog route.");
}

if (
  !files.footer.includes('label: "Blog"') ||
  !files.footer.includes('href: "/blog"')
) {
  failures.push("SiteFooter sitemap must expose the blog route.");
}

if (
  !files.fragments.includes("data-sc-sticky") ||
  !files.fragments.includes("data-sc-spacer")
) {
  failures.push(
    "Home selected-work section must keep the sticky showcase and scroll spacer.",
  );
}

if (/overflow-x-(hidden|clip)/.test(files.shell)) {
  failures.push(
    "SiteShell must not create an overflow container because that breaks the selected-work sticky scene.",
  );
}

if (!files.layout.includes("overflow-x-hidden")) {
  failures.push(
    "Root layout body must own horizontal overflow clipping, matching the redesign prototype.",
  );
}

const timelineProbeMatch = files.interactions.match(/const probe =([\s\S]*?);/);
const timelineProbe = timelineProbeMatch?.[1] ?? "";
const heroProbeIndex = timelineProbe.indexOf("#fssroot h1 span span");
const revealProbeIndex = timelineProbe.indexOf("[data-reveal]");

if (
  heroProbeIndex === -1 ||
  (revealProbeIndex !== -1 && heroProbeIndex > revealProbeIndex)
) {
  failures.push(
    "FssInteractions guardTimeline must probe the animated hero text before [data-reveal], otherwise below-fold cards are force-revealed.",
  );
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log("Redesign shell checks passed.");
