import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";
import { GlowCard } from "@/components/ui/spotlight-card";

type CardProps = {
  title: string;
  description: string;
  icon?: ReactNode;
  className?: string;
};

export function Card({ title, description, icon, className }: CardProps) {
  return (
    <GlowCard customSize className={cn("p-5", className)}>
      {icon ? <div className="mb-4 text-brand-primary">{icon}</div> : null}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-text-muted">{description}</p>
    </GlowCard>
  );
}
