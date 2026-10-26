"use client";
import { useId } from "react";
import { crmCountries } from "@/lib/growth/crm/countries";
import { useFormFieldError } from "./form-validation";
import styles from "./crm.module.css";

export function CountryField({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string) => void;
}) {
  const id = useId();
  const error = useFormFieldError("countryCode");
  return (
    <div className={styles.field}>
      <label htmlFor={id}>Country</label>
      <select
        id={id}
        name="countryCode"
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      >
        {crmCountries.map((country) => (
          <option key={country.code} value={country.code}>
            {country.name}
          </option>
        ))}
      </select>
      {error && (
        <small id={`${id}-error`} className={styles.fieldError}>
          {error}
        </small>
      )}
    </div>
  );
}
