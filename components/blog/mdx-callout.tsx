import type { ReactNode } from "react";

type MdxCalloutProps = {
  title?: string;
  children: ReactNode;
};

export function MdxCallout({ title = "Note", children }: MdxCalloutProps) {
  return (
    <aside className="rounded-2xl border border-border-soft/45 bg-brand-secondary/24 p-5">
      <p className="text-sm font-semibold text-brand-primary">{title}</p>
      <div className="mt-2 text-sm leading-7 text-text-muted">{children}</div>
    </aside>
  );
}
