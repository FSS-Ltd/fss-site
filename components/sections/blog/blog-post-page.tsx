import { compileMDX } from "next-mdx-remote/rsc";

import type { BlogPost } from "@/lib/types/blog";

import { BlogPostLayout } from "@/components/blog/blog-post-layout";
import { extractHeadings } from "@/lib/blog-presentation";
import { markdownMdxOptions } from "@/lib/blog-api/render";
import { mdxComponents } from "@/components/blog/mdx-components";

type BlogPostPageProps = {
  post: BlogPost;
  relatedPosts: BlogPost["meta"][];
  allPosts: BlogPost["meta"][];
};

export async function BlogPostPage({ post, relatedPosts, allPosts }: BlogPostPageProps) {
  const { content } = await compileMDX({
    source: post.body,
    components: mdxComponents,
    // API-published rows are plain Markdown: nothing in them is evaluated.
    options: post.format === "markdown" ? { mdxOptions: markdownMdxOptions } : undefined,
  });

  return (
    <BlogPostLayout
      post={post.meta}
      headings={extractHeadings(post.body)}
      relatedPosts={relatedPosts}
      allPosts={allPosts}
    >
      {content}
    </BlogPostLayout>
  );
}
