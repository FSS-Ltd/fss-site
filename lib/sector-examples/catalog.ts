import { plumbingExamples } from "./catalogs/plumbing";
import { electricalExamples } from "./catalogs/electrical";
import { hospitalityExamples } from "./catalogs/hospitality";
import { landscapeExamples } from "./catalogs/landscape";
import { suppliesExamples } from "./catalogs/supplies";
import { equipmentExamples } from "./catalogs/equipment";
import { roofingExamples } from "./catalogs/roofing";
import { estateExamples } from "./catalogs/estate";
import { accountancyExamples } from "./catalogs/accounts";
import { automotiveExamples } from "./catalogs/automotive";
import type { SectorExample } from "./catalogs/types";
export type {
  SectorExample,
  ExampleTheme,
  ExampleApproach,
} from "./catalogs/types";
export const sectorExamples: readonly SectorExample[] = [
  ...roofingExamples,
  ...estateExamples,
  ...accountancyExamples,
  ...automotiveExamples,
  ...plumbingExamples,
  ...electricalExamples,
  ...hospitalityExamples,
  ...landscapeExamples,
  ...suppliesExamples,
  ...equipmentExamples,
];
export function findSectorExample(slug: string): SectorExample | undefined {
  return sectorExamples.find((example) => example.slug === slug);
}

/** Research labels are broad; named researched firms resolve the ambiguous groups. */
export function examplesForSector(
  sector: string,
  businessName = "",
): readonly SectorExample[] {
  const name = businessName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const known: Record<string, SectorExample["theme"]> = {
    hillwoodco: "landscape",
    hillwood: "landscape",
    paperstone: "supplies",
    kentgarageequipment: "equipment",
    hardydrainage: "plumbing",
    jaguarplumbing: "plumbing",
    paragas: "plumbing",
    plumbingangels: "plumbing",
    eteelectrical: "electrical",
    thelectrical: "electrical",
  };
  const namedTheme = Object.entries(known).find(([key]) =>
    name.startsWith(key),
  )?.[1];
  const normalized = sector.toLowerCase().replace(/[_-]/g, " ");
  const theme =
    namedTheme ??
    (/roof/.test(normalized)
      ? "roof"
      : /landscap|garden design/.test(normalized)
        ? "landscape"
        : /workshop equipment|garage equipment/.test(normalized)
          ? "equipment"
          : /office suppl|business suppl|stationery/.test(normalized)
            ? "supplies"
            : /plumb|heating|drainage|gas engineer/.test(normalized)
              ? "plumbing"
              : /electric/.test(normalized)
                ? "electrical"
                : /restaurant|hospitality|brewery|taproom|cafe|dining/.test(
                      normalized,
                    )
                  ? "hospitality"
                  : /estate|letting|property management|property agency/.test(
                        normalized,
                      )
                    ? "estate"
                    : /auto|motor|garage|vehicle/.test(normalized)
                      ? "auto"
                      : /account|bookkeep|tax|financ/.test(normalized)
                        ? "accounts"
                        : null);
  return theme
    ? sectorExamples.filter((example) => example.theme === theme)
    : [];
}
export const exampleSectors = [
  {
    theme: "roof",
    title: "Roofing",
    description: "From the first sign of a leak to a carefully specified roof.",
  },
  {
    theme: "estate",
    title: "Real estate",
    description: "Homes with a story. Moves with a clear plan.",
  },
  {
    theme: "accounts",
    title: "Accountancy",
    description:
      "Useful numbers, clear services and better business conversations.",
  },
  {
    theme: "auto",
    title: "Automotive",
    description:
      "Help drivers understand the work and arrange the right visit.",
  },
  {
    theme: "plumbing",
    title: "Plumbing & heating",
    description: "Make the next step clear when a home needs attention.",
  },
  {
    theme: "electrical",
    title: "Electrical",
    description: "Explain the systems, the service and the way forward.",
  },
  {
    theme: "hospitality",
    title: "Hospitality",
    description: "Give people a feel for the place and a reason to gather.",
  },
  {
    theme: "landscape",
    title: "Landscape design",
    description:
      "Connect the possibilities of a place with a considered project brief.",
  },
  {
    theme: "supplies",
    title: "Business supplies",
    description:
      "Make sourcing simpler and the first trade conversation useful.",
  },
  {
    theme: "equipment",
    title: "Workshop equipment",
    description: "Turn technical options into an informed workshop enquiry.",
  },
] as const;
