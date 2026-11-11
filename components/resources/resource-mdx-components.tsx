import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

function Heading(props: ComponentPropsWithoutRef<"h2">) {
  return <h2 className="mt-8 text-2xl font-semibold text-foreground" {...props} />;
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

function Anchor({ href = "", ...props }: ComponentPropsWithoutRef<"a">) {
  if (href.startsWith("/")) {
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

export const resourceMdxComponents = {
  h2: Heading,
  p: Paragraph,
  ul: UnorderedList,
  ol: OrderedList,
  a: Anchor,
};
