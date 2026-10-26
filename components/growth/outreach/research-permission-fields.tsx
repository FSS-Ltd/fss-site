"use client";

import { useId } from "react";
import styles from "./outreach.module.css";

export type ResearchPermission = { basis: string; evidence: string };

export function ResearchPermissionFields({
  value,
  onChange,
  disabled = false,
}: {
  value: ResearchPermission;
  onChange: (value: ResearchPermission) => void;
  disabled?: boolean;
}): React.JSX.Element {
  const id = useId();
  return (
    <>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={`${id}-basis`}>
          Permission to contact this recipient
        </label>
        <select
          className={styles.textInput}
          id={`${id}-basis`}
          value={value.basis}
          onChange={(event) =>
            onChange({ ...value, basis: event.target.value })
          }
          required
          disabled={disabled}
        >
          <option value="">Choose a verified basis</option>
          <option value="corporate_legitimate_interests">
            Verified corporate contact, legitimate interests
          </option>
          <option value="consent">Recipient consent to this email</option>
        </select>
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={`${id}-evidence`}>
          Review note or permission evidence
        </label>
        <textarea
          className={styles.textArea}
          id={`${id}-evidence`}
          value={value.evidence}
          onChange={(event) =>
            onChange({ ...value, evidence: event.target.value })
          }
          minLength={10}
          maxLength={2000}
          required
          disabled={disabled}
          rows={3}
        />
      </div>
    </>
  );
}
