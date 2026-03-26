import { ButtonLink } from "@/components/ui/button";

type MdxCtaBlockProps = {
  title: string;
  body: string;
  href?: string;
  ctaLabel?: string;
};

export function MdxCtaBlock({
  title,
  body,
  href = "/contact",
  ctaLabel = "Book a strategy call",
}: MdxCtaBlockProps) {
  return (
    <div className="rounded-2xl border border-border-soft/50 bg-gradient-to-r from-brand-secondary/42 via-surface-1/88 to-surface-2/88 p-6">
      <p className="text-xl font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm text-text-muted">{body}</p>
      <ButtonLink href={href} variant="primary" className="mt-5">
        {ctaLabel}
      </ButtonLink>
    </div>
  );
}
