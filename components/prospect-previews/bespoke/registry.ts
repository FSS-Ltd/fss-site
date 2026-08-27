import { BrightFoxLettingsPage } from "./prospects/bright-fox-lettings";
import { BurfordsPage } from "./prospects/burfords";
import { DunkleysOfDealPage } from "./prospects/dunkley-s-of-deal";
import { EvoKentRoofingPage } from "./prospects/evo-kent-roofing";
import { FugglesBeerCafePage } from "./prospects/fuggles-beer-cafe";
import { HideAndFoxPage } from "./prospects/hide-and-fox";
import { KentGarageEquipmentPage } from "./prospects/kent-garage-equipment";
import { MardenGaragePage } from "./prospects/marden-garage";
import { PaperstonePage } from "./prospects/paperstone";
import { PrimelineRoofingPage } from "./prospects/primeline-roofing";
import { SealeysWalkerJarvisPage } from "./prospects/sealeys-walker-jarvis";
import { WormaldAccountantsPage } from "./prospects/wormald-accountants";
import type { BespokeProspectPage } from "./types";

export const bespokeProspectPages = {
  "bright-fox-lettings": {
    Page: BrightFoxLettingsPage,
    businessName: "Bright Fox Lettings",
    title: "Landlord services in Royal Tunbridge Wells",
    description:
      "Choose Let Only, Rent Collection or Full Management before sharing property details.",
    layoutSignature: "editorial-property-control",
    heroSignature: "layered-townhouse-key",
  },
  burfords: {
    Page: BurfordsPage,
    businessName: "Burfords",
    title: "Accountancy support in Welling",
    description:
      "Company secretarial, payroll, accounts production and taxation support routed by need.",
    layoutSignature: "blue-ledger-service-grid",
    heroSignature: "dimensional-client-ledger",
  },
  "dunkley-s-of-deal": {
    Page: DunkleysOfDealPage,
    businessName: "Dunkley's of Deal",
    title: "MOT and vehicle servicing in Deal",
    description:
      "Start same-day MOT, car, commercial vehicle or motorhome requests with the registration.",
    layoutSignature: "workshop-command-deck",
    heroSignature: "graphite-vehicle-registration",
  },
  "evo-kent-roofing": {
    Page: EvoKentRoofingPage,
    businessName: "Evo Kent Roofing",
    title: "Roofing assessments across Kent",
    description:
      "Repairs and replacements for homes, businesses and public buildings with useful site context.",
    layoutSignature: "curved-building-assessment",
    heroSignature: "exploded-roof-layers",
  },
  "fuggles-beer-cafe": {
    Page: FugglesBeerCafePage,
    businessName: "Fuggles Beer Cafe",
    title: "Beer, food and group bookings in Tunbridge Wells",
    description:
      "Thirty beers on tap, more than 100 chilled, food all day and a clearer special-booking route.",
    layoutSignature: "bold-taproom-poster",
    heroSignature: "dimensional-pint-glass",
  },
  "hide-and-fox": {
    Page: HideAndFoxPage,
    businessName: "Hide and Fox",
    title: "Seasonal tasting menus in Saltwood",
    description:
      "Plan a tasting-menu experience, wine pairing or exclusive hire with the detail considered early.",
    layoutSignature: "midnight-tasting-editorial",
    heroSignature: "floating-tasting-plate",
  },
  "kent-garage-equipment": {
    Page: KentGarageEquipmentPage,
    businessName: "Kent Garage Equipment",
    title: "Workshop and MOT-bay equipment",
    description:
      "Workshop design, supply, installation, training and aftercare scoped by project need.",
    layoutSignature: "industrial-specification-grid",
    heroSignature: "four-post-mot-lift",
  },
  "marden-garage": {
    Page: MardenGaragePage,
    businessName: "Marden Garage",
    title: "MOT, service and repair in Marden",
    description:
      "Begin the workshop request with the vehicle registration, then select MOT, service or repair.",
    layoutSignature: "soft-vehicle-service-orbit",
    heroSignature: "teal-registration-car",
  },
  paperstone: {
    Page: PaperstonePage,
    businessName: "Paperstone",
    title: "Office and business supplies",
    description:
      "More than 60,000 business supplies with a category-first route and next-working-day delivery.",
    layoutSignature: "commerce-supply-stack",
    heroSignature: "floating-paper-delivery",
  },
  "primeline-roofing": {
    Page: PrimelineRoofingPage,
    businessName: "Primeline Roofing",
    title: "Roof repair and replacement in Chatham",
    description:
      "Start a free site-visit request with the work, property, urgency and supporting photo context.",
    layoutSignature: "night-site-visit-flow",
    heroSignature: "blue-roof-camera",
  },
  "sealeys-walker-jarvis": {
    Page: SealeysWalkerJarvisPage,
    businessName: "Sealeys Walker Jarvis",
    title: "Property services in Gravesend",
    description:
      "Route residential, lettings, commercial and auction enquiries with the right property context.",
    layoutSignature: "yellow-property-switchboard",
    heroSignature: "dimensional-gravesend-terrace",
  },
  "wormald-accountants": {
    Page: WormaldAccountantsPage,
    businessName: "Wormald Accountants",
    title: "Accounting and tax advice in Maidstone",
    description:
      "Accounting, taxation and business advice routed by service need and client type.",
    layoutSignature: "financial-advice-ascent",
    heroSignature: "three-dimensional-ledger-bars",
  },
} as const satisfies Record<string, BespokeProspectPage>;

type BespokeProspectSlug = keyof typeof bespokeProspectPages;

export function getBespokeProspectPage(
  slug: string,
): BespokeProspectPage | undefined {
  return Object.hasOwn(bespokeProspectPages, slug)
    ? bespokeProspectPages[slug as BespokeProspectSlug]
    : undefined;
}

export function getBespokeProspectSlugs(): readonly BespokeProspectSlug[] {
  return Object.keys(bespokeProspectPages) as BespokeProspectSlug[];
}
