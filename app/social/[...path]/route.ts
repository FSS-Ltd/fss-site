import { renderSocialImage } from "@/components/seo/social-image";
import { getBlogPostBySlug } from "@/lib/blog";
import { getResourceBySlug } from "@/lib/resources";
import { publicPages } from "@/lib/seo/pages";

export const revalidate = 86400;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await params;
  if (!path.every((segment) => /^[a-z0-9-]+$/.test(segment)))
    return new Response(null, { status: 404 });
  const route = path.join("/") === "home" ? "/" : `/${path.join("/")}`;
  const page = Object.values(publicPages).find((entry) => entry.path === route);
  let title = page?.title;
  if (!title && path.length === 2 && path[0] === "blog") {
    const post = await getBlogPostBySlug(path[1]);
    if (post?.meta.indexable) title = post.meta.title;
  }
  if (!title && path.length === 2 && path[0] === "resources") {
    const resource = await getResourceBySlug(path[1]);
    if (resource?.meta.indexable) title = resource.meta.title;
  }
  return title ? renderSocialImage(title) : new Response(null, { status: 404 });
}
