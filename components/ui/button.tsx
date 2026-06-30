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
          "bg-[#0a1a2e] px-5 py-2.5 text-[#fff] shadow-[0_20px_40px_-24px_rgba(10,26,46,.65)] hover:bg-[#102642]",
        secondary:
          "border border-[rgba(10,26,46,.14)] bg-white px-5 py-2.5 text-[#0a1a2e] hover:border-[rgba(10,26,46,.28)] hover:bg-white",
        ghost: "px-0 py-0 text-[#0f7a83] hover:text-[#0a1a2e]",
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
    VariantProps<typeof buttonVariants> {}

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      type={type}
      {...props}
    />
  );
}

type ButtonLinkProps = React.ComponentProps<typeof Link> &
  VariantProps<typeof buttonVariants> & { className?: string };

export function ButtonLink({
  className,
  variant,
  size,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
