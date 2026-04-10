import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type GlowTag = "div" | "li" | "article" | "section" | "blockquote";

interface GlowCardProps {
  children?: ReactNode;
  className?: string;
  customSize?: boolean;
  as?: GlowTag;
}

export function GlowCard({
  children,
  className,
  customSize = false,
  as: Tag = "div",
}: GlowCardProps) {
  return (
    <Tag
      className={cn(
        !customSize && "w-64 h-80 aspect-[3/4]",
        "relative grid grid-rows-[1fr_auto] gap-4 overflow-hidden rounded-2xl border border-border-soft/45 bg-surface-1/80 p-5 shadow-[0_1rem_2rem_-1rem_black]",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_20%_20%,rgba(111,212,238,0.08),transparent_50%)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
