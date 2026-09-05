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
  rootLayout: readFileSync("app/layout.tsx", "utf8"),
  siteLayout: readFileSync("app/(site)/layout.tsx", "utf8"),
  growthLayout: readFileSync("app/(growth)/layout.tsx", "utf8"),
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

if (!files.rootLayout.includes("overflow-x-hidden")) {
  failures.push(
    "Root layout body must own horizontal overflow clipping, matching the redesign prototype.",
  );
}

if (
  files.rootLayout.includes("SiteShell") ||
  files.rootLayout.includes("RootSchema") ||
  files.rootLayout.includes("AnalyticsLoader")
) {
  failures.push(
    "Root layout must stay neutral so private Growth OS routes do not inherit the public site shell or analytics.",
  );
}

if (
  !files.siteLayout.includes("SiteShell") ||
  !files.siteLayout.includes("RootSchema") ||
  !files.siteLayout.includes("AnalyticsLoader")
) {
  failures.push(
    "Public routes must retain the site shell, structured data, and analytics in the site route-group layout.",
  );
}

if (
  files.growthLayout.includes("SiteShell") ||
  files.growthLayout.includes("RootSchema") ||
  files.growthLayout.includes("AnalyticsLoader")
) {
  failures.push(
    "Growth OS routes must not render the public site shell, structured data, or analytics.",
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
