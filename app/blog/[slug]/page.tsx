import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArticleSchema } from "@/components/seo/article-schema";
import { BlogPostPage } from "@/components/sections/blog/blog-post-page";
import { getAllBlogPosts, getBlogPostBySlug, getRelatedPosts } from "@/lib/blog";

type BlogPostRouteProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const posts = await getAllBlogPosts();

  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: BlogPostRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);

  if (!post) {
    return {
      title: "Post not found",
      description: "The requested blog post could not be found.",
    };
  }

  return {
    title: post.meta.seoTitle,
    description: post.meta.seoDescription,
    alternates: {
      canonical: `/blog/${post.meta.slug}`,
    },
    openGraph: {
      type: "article",
      title: post.meta.seoTitle,
      description: post.meta.seoDescription,
      url: `/blog/${post.meta.slug}`,
      images: [post.meta.coverImage],
      publishedTime: post.meta.publishDate,
      authors: [post.meta.author],
      section: post.meta.category,
      tags: post.meta.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: post.meta.seoTitle,
      description: post.meta.seoDescription,
      images: [post.meta.coverImage],
    },
  };
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
      <BlogPostPage post={post} relatedPosts={relatedPosts} />
    </>
  );
}
