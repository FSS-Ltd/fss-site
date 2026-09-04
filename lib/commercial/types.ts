import type { PageMetadataInput } from "@/lib/seo/metadata";

export type CommercialLink = { href: string; label: string };
export type CommercialSection = {
  id: string;
  title: string;
  text: string;
  points?: readonly string[];
  links?: readonly CommercialLink[];
};

export type CommercialPageContent = PageMetadataInput & {
  kind: "service" | "sector" | "case-study" | "guide" | "article";
  modifiedDate: string;
  label: string;
  heading: string;
  answer: string;
  sections: readonly CommercialSection[];
  faqs: readonly { question: string; answer: string }[];
  related: readonly CommercialLink[];
};
