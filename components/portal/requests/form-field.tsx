import { PortalField, PortalTextarea } from "@/components/portal/ui";

type FieldProps = {
  name: string;
  label: string;
  multiline?: boolean;
  required?: boolean;
  maxLength?: number;
  type?: "text" | "date";
  error?: string;
  hint?: string;
};

export function RequestField({
  name,
  label,
  multiline = false,
  required = false,
  maxLength,
  type = "text",
  error,
  hint,
}: FieldProps): React.JSX.Element {
  const visibleLabel = required ? label : `${label} (optional)`;

  if (multiline)
    return (
      <PortalTextarea
        error={error}
        hint={hint}
        label={visibleLabel}
        maxLength={maxLength}
        name={name}
        required={required}
        rows={4}
      />
    );

  return (
    <PortalField
      error={error}
      hint={hint}
      label={visibleLabel}
      required={required}
    >
      <input maxLength={maxLength} name={name} type={type} />
    </PortalField>
  );
}
