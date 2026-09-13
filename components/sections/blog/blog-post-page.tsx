import { compileMDX } from "next-mdx-remote/rsc";

import type { BlogPost } from "@/lib/types/blog";

import { BlogPostCard } from "@/components/blog/blog-post-card";
import { BlogPostLayout } from "@/components/blog/blog-post-layout";
import { mdxComponents } from "@/components/blog/mdx-components";
import { Container } from "@/components/ui/container";

type BlogPostPageProps = {
  post: BlogPost;
  relatedPosts: BlogPost["meta"][];
};

export async function BlogPostPage({ post, relatedPosts }: BlogPostPageProps) {
  const { content } = await compileMDX({
    source: post.body,
    components: mdxComponents,
  });

  return (
    <>
      <BlogPostLayout post={post.meta}>{content}</BlogPostLayout>
      {relatedPosts.length ? (
        <section className="pb-16 sm:pb-20" data-motion-reveal="up">
          <Container>
            <h2 className="text-2xl font-semibold text-foreground">
              Related articles
            </h2>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {relatedPosts.map((relatedPost) => (
                <BlogPostCard key={relatedPost.slug} post={relatedPost} />
              ))}
            </div>
          </Container>
        </section>
      ) : null}
    </>
  );
}
