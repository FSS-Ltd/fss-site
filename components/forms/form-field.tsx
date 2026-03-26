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
      <label className="block text-sm font-medium text-zinc-200" htmlFor={id}>
        {label}
      </label>
      <input
        className={cn(
          "h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white placeholder:text-zinc-500 focus:border-white/40 focus:outline-none",
          className,
        )}
        id={id}
        {...props}
      />
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
