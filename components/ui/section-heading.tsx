import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  children?: ReactNode;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  children,
}: SectionHeadingProps) {
  return (
    <div className={cn("space-y-5", align === "center" && "mx-auto max-w-3xl text-center")}>
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">{eyebrow}</p>
      ) : null}
      <h2 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-[2.6rem]">
        {title}
      </h2>
      {description ? <p className="text-pretty text-base leading-7 text-text-muted">{description}</p> : null}
      {children}
    </div>
  );
}
