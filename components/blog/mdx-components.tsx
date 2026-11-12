import Link from "next/link";
import cta from "@/components/ui/cta-motion.module.css";
import { isValidElement, type ComponentPropsWithoutRef, type ReactNode } from "react";

import { MdxCallout } from "@/components/blog/mdx-callout";
import { MdxCtaBlock } from "@/components/blog/mdx-cta-block";
import { isSafeLinkDestination } from "@/lib/blog-api/links";
import { createHeadingIds, slugifyHeading } from "@/lib/blog-presentation";

/** Plain text of rendered heading children, so ids match extractHeadings. */
function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

// Typography lives in blog.module.css (.prose) so MDX and Markdown posts match.
/** Heading ids are allocated per document, so build the components once per compile. */
function createH2() {
  const nextId = createHeadingIds();
  return function H2(props: ComponentPropsWithoutRef<"h2">) {
    const text = textOf(props.children);
    return <h2 id={slugifyHeading(text) ? nextId(text) : undefined} {...props} />;
  };
}

function Image({ alt = "", ...props }: ComponentPropsWithoutRef<"img">) {
  // eslint-disable-next-line @next/next/no-img-element -- Markdown images have no known dimensions for next/image.
  return <img alt={alt} loading="lazy" decoding="async" {...props} />;
}

function Anchor({ href = "", ...props }: ComponentPropsWithoutRef<"a">) {
  // API-published rows can carry arbitrary hrefs; never render an unsafe one as a link.
  if (!isSafeLinkDestination(href, { allowFragment: true })) {
    return <span {...props} />;
  }

  const isInternal = href.startsWith("/");

  if (isInternal) {
    return <Link href={href} className={cta.link} {...props} />;
  }

  return (
    <a href={href} className={cta.link} target="_blank" rel="noreferrer" {...props} />
  );
}

export const createMdxComponents = () => ({
  h2: createH2(),
  img: Image,
  a: Anchor,
  Callout: MdxCallout,
  CtaBlock: MdxCtaBlock,
});
