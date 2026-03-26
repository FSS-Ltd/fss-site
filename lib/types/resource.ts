export type ResourceFrontmatter = {
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
};

export type ResourceMeta = ResourceFrontmatter;

export type ResourceItem = {
  meta: ResourceMeta;
  body: string;
};
