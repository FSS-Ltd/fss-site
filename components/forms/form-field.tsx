import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
};

export function FormField({ id, label, className, error, ...props }: FormFieldProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground" htmlFor={id}>
        {label}
      </label>
      <input
        className={cn(
          "h-11 w-full rounded-xl border border-border-soft bg-surface-2 px-3 text-sm text-foreground placeholder:text-text-subtle focus:border-brand-primary/70 focus:outline-none",
          className,
        )}
        id={id}
        {...props}
      />
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
