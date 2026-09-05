import type { Metadata } from "next";
import { createArticleMetadata } from "@/lib/seo/content-metadata";
import { notFound } from "next/navigation";

import { ArticleSchema } from "@/components/seo/article-schema";
import { BreadcrumbSchema } from "@/components/seo/breadcrumb-schema";
import { BlogPostPage } from "@/components/sections/blog/blog-post-page";
import {
  getAllBlogPosts,
  getBlogPostBySlug,
  getRelatedPosts,
} from "@/lib/blog";

type BlogPostRouteProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const posts = await getAllBlogPosts();

  // The comparison has a dedicated static page sharing the same blog data.
  return posts
    .filter((post) => post.slug !== "church-management-software-vs-bespoke")
    .map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: BlogPostRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);

  if (!post) {
    return {
      title: "Post not found",
      description: "The requested blog post could not be found.",
    };
  }

  return createArticleMetadata(post.meta);
}

export default async function BlogPostRoute({ params }: BlogPostRouteProps) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const relatedPosts = await getRelatedPosts(post.meta, 2);

  return (
    <>
      <ArticleSchema post={post.meta} />
      <BreadcrumbSchema
        items={[
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: post.meta.title, path: `/blog/${post.meta.slug}` },
        ]}
      />
      <BlogPostPage post={post} relatedPosts={relatedPosts} />
    </>
  );
}
