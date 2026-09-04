import type { ContentEvidence } from "@/lib/seo/content";

export type ResourceDeliveryType =
  | "direct_download"
  | "internal_asset_page"
  | "external_link"
  | "email_later";

export type ResourceDelivery = {
  type: ResourceDeliveryType;
  url?: string;
  label?: string;
  notes?: string;
  fileName?: string;
  accessInstructions?: string;
};

export type ResourceUsageStep = {
  title: string;
  description: string;
};

export type ResourceFrontmatter = ContentEvidence & {
  publishDate?: string;
  author?: string;
  slug: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  category: string;
  format: string;
  featured: boolean;
  downloadType: string;
  coverImage: string;
  benefits: string[];
  ctaLabel: string;
  thankYouMessage: string;
  seoTitle: string;
  seoDescription: string;
  usageSectionTitle?: string;
  usageSteps?: ResourceUsageStep[];
  delivery: ResourceDelivery;
};

export type ResourceMeta = ResourceFrontmatter;

export type ResourceItem = {
  meta: ResourceMeta;
  body: string;
};
