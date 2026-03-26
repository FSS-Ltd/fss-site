import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type CardProps = {
  title: string;
  description: string;
  icon?: ReactNode;
  className?: string;
};

export function Card({ title, description, icon, className }: CardProps) {
  return (
    <article
      className={cn(
        "rounded-2xl border border-border-soft/70 bg-surface-1/78 p-5 shadow-[inset_0_1px_0_rgba(140,180,220,0.08)] transition hover:border-border-strong/80 hover:bg-surface-2/84",
        className,
      )}
    >
      {icon ? <div className="mb-4 text-brand-primary">{icon}</div> : null}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-text-muted">{description}</p>
    </article>
  );
}
