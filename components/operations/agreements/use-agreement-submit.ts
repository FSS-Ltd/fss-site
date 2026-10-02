"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FieldIssues } from "./form-fields";
import { decimalToMinor } from "@/lib/operations/money";
export function useAgreementSubmit(
  organisationId: string,
  endpoint = `/api/growth/operations/clients/${organisationId}/agreements`,
): {
  pending: boolean;
  message: string;
  issues: FieldIssues;
  submit: (build: () => unknown) => Promise<boolean>;
} {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [issues, setIssues] = useState<FieldIssues>([]);
  async function submit(build: () => unknown): Promise<boolean> {
    setPending(true);
    setMessage("");
    setIssues([]);
    try {
      const body = build();
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result: { message?: string; issues?: FieldIssues } =
        await response.json();
      if (!response.ok) {
        setMessage(result.message ?? "The agreement could not be saved.");
        setIssues(result.issues ?? []);
        return false;
      }
      setMessage("Saved.");
      router.refresh();
      return true;
    } catch (error) {
      if (error instanceof MoneyFieldError) {
        setIssues([{ path: error.path, message: error.message }]);
        setMessage("Check the marked amount.");
      } else
        setMessage(
          "The agreement could not be saved. Check your connection and try again.",
        );
      return false;
    } finally {
      setPending(false);
    }
  }
  return { pending, message, issues, submit };
}
class MoneyFieldError extends Error {
  constructor(readonly path: string) {
    super("Enter an amount with no more than two decimal places.");
  }
}
export function moneyValue(data: FormData, name: string): string {
  try {
    return decimalToMinor(String(data.get(name) ?? "").trim());
  } catch {
    throw new MoneyFieldError(name);
  }
}
