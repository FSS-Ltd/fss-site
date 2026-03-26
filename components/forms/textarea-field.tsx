import type { TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

type TextareaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string;
  label: string;
  error?: string;
};

export function TextareaField({ id, label, className, error, ...props }: TextareaFieldProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground" htmlFor={id}>
        {label}
      </label>
      <textarea
        className={cn(
          "min-h-[120px] w-full rounded-xl border border-border-soft bg-surface-2 px-3 py-2.5 text-sm text-foreground placeholder:text-text-subtle focus:border-brand-primary/70 focus:outline-none",
          className,
        )}
        id={id}
        {...props}
      />
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
