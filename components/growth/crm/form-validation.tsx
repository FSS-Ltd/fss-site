"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { CrmFieldError } from "@/lib/growth/crm/validation-feedback";

const FormErrors = createContext<readonly CrmFieldError[]>([]);

export function FormValidation({
  errors,
  children,
}: {
  errors: readonly CrmFieldError[];
  children: ReactNode;
}) {
  return <FormErrors.Provider value={errors}>{children}</FormErrors.Provider>;
}

export function useFormFieldError(
  name: string | undefined,
): string | undefined {
  return useContext(FormErrors).find((issue) => issue.name === name)?.message;
}
