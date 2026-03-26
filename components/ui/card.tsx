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
        "rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]",
        className,
      )}
    >
      {icon ? <div className="mb-4 text-zinc-300">{icon}</div> : null}
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-zinc-400">{description}</p>
    </article>
  );
}
