"use client";

import { useState } from "react";
import { portalRoleOptions } from "@/lib/operations/auth/access-dashboard-metrics";
import type { PortalRole } from "@/lib/operations/auth/types";
import styles from "./portal-role-picker.module.css";

type PortalRolePickerProps = {
  name: string;
  options: readonly (typeof portalRoleOptions)[number][];
  defaultValue?: PortalRole;
  disabled: boolean;
};

export function PortalRolePicker({
  name,
  options,
  defaultValue = "viewer",
  disabled,
}: PortalRolePickerProps): React.JSX.Element {
  const [selectedRole, setSelectedRole] = useState<PortalRole>(defaultValue);
  const [expandedRole, setExpandedRole] = useState<PortalRole | null>(null);
  const selectedOption = options.find((option) => option.value === selectedRole);

  return (
    <fieldset className={styles.fieldset} disabled={disabled}>
      <legend>Portal role</legend>
      <p className={styles.selection} id="portal-role-description">
        Selected role: {selectedOption?.label ?? selectedRole}.{" "}
        {selectedOption?.detail ?? "Choose a role for this portal invitation."}
      </p>
      <div className={styles.grid}>
        {options.map((option) => {
          const tooltipId = `portal-role-${option.value}-tooltip`;
          const isExpanded = expandedRole === option.value;

          return (
            <div className={styles.option} key={option.value}>
              <label className={styles.card}>
                <input
                  aria-describedby="portal-role-description"
                  checked={selectedRole === option.value}
                  name={name}
                  onChange={() => setSelectedRole(option.value)}
                  type="radio"
                  value={option.value}
                />
                <span>
                  <strong>{option.label}</strong>
                  <span>{option.detail}</span>
                </span>
              </label>
              <button
                aria-describedby={tooltipId}
                aria-expanded={isExpanded}
                aria-label={`More about ${option.label}`}
                className={styles.helpButton}
                onBlur={() => setExpandedRole(null)}
                onClick={() => setExpandedRole(option.value)}
                onFocus={() => setExpandedRole(option.value)}
                onMouseEnter={() => setExpandedRole(option.value)}
                onMouseLeave={() => setExpandedRole(null)}
                type="button"
              >
                ?
              </button>
              <span
                className={styles.tooltip}
                hidden={!isExpanded}
                id={tooltipId}
                role="tooltip"
              >
                {option.detail}
              </span>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
