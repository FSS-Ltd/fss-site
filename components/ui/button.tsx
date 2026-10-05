import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import * as React from "react";

import { cn } from "@/lib/utils/cn";

export const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-full text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--button-primary)] px-5 py-2.5 text-cta-text shadow-[0_20px_40px_-24px_var(--button-shadow)] hover:bg-[var(--button-primary-hover)]",
        secondary:
          "border border-[var(--button-secondary-border)] bg-white px-5 py-2.5 text-foreground hover:border-[var(--button-secondary-hover-border)] hover:bg-white",
        ghost:
          "px-0 py-0 text-[var(--button-ghost-text)] hover:text-foreground",
      },
      size: {
        default: "h-10",
        lg: "h-11 px-6 text-[0.95rem]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  magnetic?: boolean;
}

export function Button({
  className,
  variant,
  size,
  magnetic = false,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      data-magnetic={magnetic || undefined}
      type={type}
      {...props}
    >
      {magnetic ? <span data-mag-label>{children}</span> : children}
    </button>
  );
}

type ButtonLinkProps = React.ComponentProps<typeof Link> &
  VariantProps<typeof buttonVariants> & {
    className?: string;
    magnetic?: boolean;
  };

export function ButtonLink({
  className,
  variant,
  size,
  magnetic = false,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(buttonVariants({ variant, size, className }))}
      data-magnetic={magnetic || undefined}
      {...props}
    >
      {magnetic ? <span data-mag-label>{children}</span> : children}
    </Link>
  );
}
