import { readFileSync } from "node:fs";

const files = {
  interactions: readFileSync(
    "components/redesign/fss-interactions.tsx",
    "utf8",
  ),
  siteInteractions: readFileSync(
    "components/layout/site-interactions.tsx",
    "utf8",
  ),
  homePage: readFileSync("components/sections/public/home-page.tsx", "utf8"),
  pageIntro: readFileSync("components/sections/public/page-intro.tsx", "utf8"),
  motionScenes: readFileSync("components/redesign/motion-scenes.ts", "utf8"),
  homeStyles: readFileSync(
    "components/sections/public/home-page.module.css",
    "utf8",
  ),
  publicStyles: readFileSync(
    "components/sections/public/public-page.module.css",
    "utf8",
  ),
  globals: readFileSync("app/globals.css", "utf8"),
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

if (/<header[^>]*data-motion-reveal/.test(files.pageIntro)) {
  failures.push(
    "Shared hero reveals must target content, never the full-width canvas parent.",
  );
}
if (
  files.motionScenes.includes('fill: "both"') ||
  files.motionScenes.includes('fill: "forwards"')
) {
  failures.push(
    "Completed reveals must release clipping and transform ownership.",
  );
}

if (!files.interactions.includes("usePathname")) {
  failures.push(
    "FssInteractions must re-initialize on App Router pathname changes.",
  );
}

if (files.siteInteractions.includes("usePathname")) {
  failures.push(
    "SiteInteractions must stay available across the public site so every hero can opt into the shared runtime.",
  );
}

if (!files.siteInteractions.includes('"pointermove"')) {
  failures.push(
    "SiteInteractions must load the interaction runtime when a pointer moves, not only after a click.",
  );
}

if (!files.interactions.includes("queryAll<HTMLCanvasElement>")) {
  failures.push("FssInteractions must initialize every hero particle canvas.");
}

if (files.interactions.includes("window.innerWidth < 940")) {
  failures.push(
    "FssInteractions must not disable hero particles below a fixed viewport width.",
  );
}

if (files.globals.includes("[data-hero-canvas] {\n    display: none")) {
  failures.push(
    "Global CSS must not hide hero particle canvases on narrow screens.",
  );
}

if (!files.homePage.includes("data-hero-canvas")) {
  failures.push("The homepage hero must render the shared particle canvas.");
}

if (
  !files.interactions.includes(
    'bind(\n          window,\n          "pointermove"',
  )
) {
  failures.push(
    "Hero particle interaction must track the pointer at window scope so full-width canvases follow the mouse.",
  );
}

if (!files.publicStyles.includes("width: 100vw")) {
  failures.push("Shared public hero canvases must span the viewport width.");
}

if (/\.hero\s*\{[^}]*overflow\s*:\s*hidden/.test(files.publicStyles)) {
  failures.push(
    "Shared public hero containers must not clip the full-width particle canvas.",
  );
}

if (/\.serviceSection\s*\{[^}]*max-width\s*:/.test(files.homeStyles)) {
  failures.push(
    "The homepage service section must remain full width so its responsive side padding does not collapse the content column.",
  );
}

if (/\.processWrap\s*\{[^}]*max-width\s*:/.test(files.homeStyles)) {
  failures.push(
    "The homepage process section must remain full width so its responsive side padding does not collapse the content column.",
  );
}

if (
  !/\[\s*motion\s*,\s*nodeDensity\s*,\s*pathname\s*,\s*preferenceVersion\s*\]/.test(files.interactions)
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
