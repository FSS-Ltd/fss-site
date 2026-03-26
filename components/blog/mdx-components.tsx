import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

import { MdxCallout } from "@/components/blog/mdx-callout";
import { MdxCtaBlock } from "@/components/blog/mdx-cta-block";

function H2(props: ComponentPropsWithoutRef<"h2">) {
  return <h2 className="mt-12 text-3xl font-semibold tracking-tight text-foreground" {...props} />;
}

function H3(props: ComponentPropsWithoutRef<"h3">) {
  return <h3 className="mt-10 text-2xl font-semibold tracking-tight text-foreground" {...props} />;
}

function Paragraph(props: ComponentPropsWithoutRef<"p">) {
  return <p className="text-base leading-8 text-text-muted" {...props} />;
}

function UnorderedList(props: ComponentPropsWithoutRef<"ul">) {
  return <ul className="ml-5 list-disc space-y-3 text-text-muted" {...props} />;
}

function OrderedList(props: ComponentPropsWithoutRef<"ol">) {
  return <ol className="ml-5 list-decimal space-y-3 text-text-muted" {...props} />;
}

function ListItem(props: ComponentPropsWithoutRef<"li">) {
  return <li className="pl-1" {...props} />;
}

function Blockquote(props: ComponentPropsWithoutRef<"blockquote">) {
  return (
    <blockquote
      className="rounded-r-xl border-l-4 border-brand-primary/80 bg-surface-1/80 px-5 py-4 text-text-muted"
      {...props}
    />
  );
}

function Anchor({ href = "", ...props }: ComponentPropsWithoutRef<"a">) {
  const isInternal = href.startsWith("/");

  if (isInternal) {
    return <Link href={href} className="font-medium text-brand-primary underline-offset-4 hover:underline" {...props} />;
  }

  return (
    <a
      href={href}
      className="font-medium text-brand-primary underline-offset-4 hover:underline"
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  );
}

export const mdxComponents = {
  h2: H2,
  h3: H3,
  p: Paragraph,
  ul: UnorderedList,
  ol: OrderedList,
  li: ListItem,
  blockquote: Blockquote,
  a: Anchor,
  Callout: MdxCallout,
  CtaBlock: MdxCtaBlock,
};
