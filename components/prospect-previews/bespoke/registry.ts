import { BrightAccountingPage } from "./prospects/bright-accounting";
import { BridglandRoofingPage } from "./prospects/bridgland-roofing";
import { BrightFoxLettingsPage } from "./prospects/bright-fox-lettings";
import { BurfordsPage } from "./prospects/burfords";
import { DoorknobsPage } from "./prospects/doorknobs";
import { DunkleysOfDealPage } from "./prospects/dunkley-s-of-deal";
import { EvoKentRoofingPage } from "./prospects/evo-kent-roofing";
import { FugglesBeerCafePage } from "./prospects/fuggles-beer-cafe";
import { HideAndFoxPage } from "./prospects/hide-and-fox";
import { JaguarPlumbingPage } from "./prospects/jaguar-plumbing";
import { KemsingMotorCompanyPage } from "./prospects/kemsing-motor-company";
import { KentGarageEquipmentPage } from "./prospects/kent-garage-equipment";
import { MardenGaragePage } from "./prospects/marden-garage";
import { PaperstonePage } from "./prospects/paperstone";
import { PrimelineRoofingPage } from "./prospects/primeline-roofing";
import { PriorityPointPage } from "./prospects/priority-point";
import { SealeysWalkerJarvisPage } from "./prospects/sealeys-walker-jarvis";
import { WormaldAccountantsPage } from "./prospects/wormald-accountants";
import type { BespokeProspectPage } from "./types";

export const bespokeProspectPages = {
  "bridgland-roofing": {
    Page: BridglandRoofingPage,
    businessName: "Bridgland Roofing",
    title: "Bridgland heritage roofing in Kent and Sussex",
    description:
      "A heritage-led route for roof assessments, listed buildings, traditional roofing and clear property context.",
    layoutSignature: "heritage-roof-inspection-brief",
    heroSignature: "scroll-scrubbed-roof-drone-analysis",
  },
  "bright-accounting": {
    Page: BrightAccountingPage,
    businessName: "Bright Accounting Ltd",
    title: "Bright Accounting fixed-fee accountancy in Tonbridge",
    description:
      "A premium fixed-fee accountancy service route for bookkeeping, VAT, tax, sole traders and limited companies.",
    layoutSignature: "apple-led-accountancy-service-route",
    heroSignature: "glass-deadline-ledger-command-centre",
  },
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
  doorknobs: {
    Page: DoorknobsPage,
    businessName: "Doorknobs",
    title: "Property services in Tunbridge Wells",
    description:
      "Choose a local property journey for selling, letting, buying or renting in Tunbridge Wells.",
    layoutSignature: "property-threshold-navigator",
    heroSignature: "light-through-blue-door",
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
  "jaguar-plumbing": {
    Page: JaguarPlumbingPage,
    businessName: "Jaguar Plumbing",
    title: "Plumbing, heating and drainage in Dartford and Kent",
    description:
      "Route emergency, repair and planned plumbing, heating and drainage enquiries with useful context.",
    layoutSignature: "premium-service-brief",
    heroSignature: "emergency-repair-plan-control-panel",
  },
  "kemsing-motor-company": {
    Page: KemsingMotorCompanyPage,
    businessName: "Kemsing Motor Company",
    title: "MOT, diagnostics and vehicle servicing in Kemsing",
    description:
      "Prepare an MOT, service, diagnostic or repair request with the vehicle details Kemsing Motor Company needs.",
    layoutSignature: "precision-vehicle-assembly",
    heroSignature: "scroll-linked-exploded-hatchback",
  },
  "kent-garage-equipment": {
    Page: KentGarageEquipmentPage,
    businessName: "Kent Garage Equipment",
    title: "Workshop and MOT-bay equipment",
    description:
      "Workshop design, supply, installation, training and aftercare scoped by project need.",
    layoutSignature: "workshop-scrollytelling-brief",
    heroSignature: "cinematic-workshop-installation",
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
  "priority-point": {
    Page: PriorityPointPage,
    businessName: "Priority Point",
    title: "Priority Point accountancy support in Folkestone",
    description:
      "Accountancy support for company registration, bookkeeping, payroll, VAT, accounts, tax and CIS, with a clearer first enquiry route.",
    layoutSignature: "responsibility-first-business-brief",
    heroSignature: "organised-accountancy-desk",
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
