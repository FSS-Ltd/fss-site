import { exampleSectors, sectorExamples } from "./catalog";

/** Build launcher guidance from the same catalog used by draft ingestion. */
export function buildSectorExampleResearchInstructions(
  siteUrl: string,
): string {
  const base = new URL(siteUrl);
  const directory = exampleSectors.map((sector) => {
    const examples = sectorExamples.filter(
      (example) => example.theme === sector.theme,
    );
    return `${sector.title}: ${examples.map((example) => `${example.name} (${new URL(`/examples/${example.slug}`, base).href})`).join("; ")}.`;
  });
  return [
    "Include all four matching fictional-company example links in every new first email, choosing the business type from verified research rather than a broad database label alone.",
    "Use examplesForSector(business.sector, business.legalName) from lib/sector-examples/catalog.ts as the matching rule. The application applies this same rule when storing the first-email draft, so links are added at ingestion rather than deferred until approval.",
    "Keep any existing private preview URL and bespoke concept. Never replace an existing concept or alter started outreach. Unknown business types use the example collection, honestly described as examples across other sectors. Do not invent an example URL or claim a fictional company is a real client.",
    `Example collection: ${new URL("/examples", base).href}. Current sector directory:`,
    ...directory,
    "Keep the first email within its existing word limit, with the required opt-out and concept disclaimer. These public examples do not authorize creating a Gmail draft or sending email.",
  ].join("\n");
}
