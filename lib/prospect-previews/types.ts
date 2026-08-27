export type PreviewSection =
  | "hero"
  | "mot-enquiry"
  | "service-selector"
  | "reviews"
  | "services"
  | "service-area"
  | "location"
  | "contact"
  | "owner-cta";

export type PreviewBrand = {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
};

export type PreviewReview = {
  quote: string;
  author: string;
  rating: 4 | 5;
};

export type PreviewResearch = {
  services: readonly string[];
  rating: number;
  reviewCount: number;
  strengths: readonly string[];
  opportunities: readonly string[];
};

export type SellingAngle = {
  title: string;
  description: string;
  primaryGoal: string;
};

export type PreviewSeo = {
  title: string;
  description: string;
};

export type OwnerCta = {
  title: string;
  description: string;
  href: string;
  label: string;
};

type ProspectPreviewBase = {
  slug: string;
  businessName: string;
  industry: "automotive" | "trades";
  location: string;
  phone: string;
  brand: PreviewBrand;
  research: PreviewResearch;
  sellingAngle: SellingAngle;
  seo: PreviewSeo;
  sections: readonly PreviewSection[];
  ownerCta: OwnerCta;
};

export type AutomotivePreviewContent = {
  eyebrow: string;
  headline: string;
  description: string;
  openingHours: readonly string[];
  reviews: readonly PreviewReview[];
  contactPrompt: string;
};

export type TradePreviewContent = {
  eyebrow: string;
  headline: string;
  description: string;
  serviceArea: string;
  responsePromise: string;
  reviews: readonly PreviewReview[];
};

export type AutomotiveProspectPreview = ProspectPreviewBase & {
  industry: "automotive";
  content: AutomotivePreviewContent;
};

export type TradeProspectPreview = ProspectPreviewBase & {
  industry: "trades";
  content: TradePreviewContent;
};

export type ProspectPreview = AutomotiveProspectPreview | TradeProspectPreview;
