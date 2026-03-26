export type BlogFrontmatter = {
  title: string;
  excerpt: string;
  publishDate: string;
  author: string;
  category: string;
  tags: string[];
  coverImage: string;
  seoTitle: string;
  seoDescription: string;
  featured: boolean;
};

export type BlogPostMeta = BlogFrontmatter & {
  slug: string;
  readingMinutes: number;
};

export type BlogPost = {
  meta: BlogPostMeta;
  body: string;
};
