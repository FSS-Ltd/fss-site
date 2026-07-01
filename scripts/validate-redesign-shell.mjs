import { readFileSync } from "node:fs";

const files = {
  interactions: readFileSync(
    "components/redesign/fss-interactions.tsx",
    "utf8",
  ),
  header: readFileSync("components/layout/site-header.tsx", "utf8"),
  footer: readFileSync("components/layout/site-footer.tsx", "utf8"),
  fragments: readFileSync("components/redesign/design-fragments.ts", "utf8"),
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
  !files.header.includes('label: "Blog"') ||
  !files.header.includes('href: "/blog"')
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

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log("Redesign shell checks passed.");
