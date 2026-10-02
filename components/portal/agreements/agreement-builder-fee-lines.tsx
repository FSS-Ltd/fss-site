import {
  PortalButton,
  PortalField,
  PortalSelect,
} from "@/components/portal/ui";
import { formatGbp } from "./agreement-builder-step-support";
import { currencySymbol, type Currency } from "@/lib/operations/money";
import type { EditableLine } from "./agreement-builder-fee-inputs";
import styles from "./agreements.module.css";

export function AgreementBuilderFeeLines({
  lines,
  fixed,
  total,
  currency,
  updateLine,
  onAdd,
  onRemove,
}: Readonly<{
  lines: readonly EditableLine[];
  fixed: boolean;
  total: string | null;
  currency: Currency;
  updateLine: (index: number, field: keyof EditableLine, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}>): React.JSX.Element {
  const symbol = currencySymbol(currency);
  return (
    <fieldset className={styles.feeFieldset}>
      <legend>One-off fees and service lines</legend>
      <div className={styles.feeLineList}>
        {lines.map((line, index) => (
          <section className={styles.feeLine} key={index}>
            <div className={styles.feeLineHeading}>
              <h3>Fee line {index + 1}</h3>
              {lines.length > 1 ? (
                <PortalButton
                  onClick={() => onRemove(index)}
                  type="button"
                  variant="quiet"
                >
                  Remove line
                </PortalButton>
              ) : null}
            </div>
            <div className={styles.fieldGrid}>
              <PortalField label="Service code" required>
                <input
                  onChange={(event) =>
                    updateLine(index, "serviceCode", event.target.value)
                  }
                  value={line.serviceCode}
                />
              </PortalField>
              <PortalField label="Description" required>
                <input
                  onChange={(event) =>
                    updateLine(index, "description", event.target.value)
                  }
                  value={line.description}
                />
              </PortalField>
              <PortalField label="Quantity" required>
                <input
                  min="1"
                  onChange={(event) =>
                    updateLine(index, "quantity", event.target.value)
                  }
                  type="number"
                  value={line.quantity}
                />
              </PortalField>
              <PortalField
                label={`Rate (${symbol})`}
                required={line.recurrenceMonths === "0"}
                hint={
                  line.recurrenceMonths !== "0" && fixed
                    ? "Required for fixed recurring fees. Choose compensation on the next screen."
                    : undefined
                }
              >
                <input
                  disabled={line.recurrenceMonths !== "0" && !fixed}
                  inputMode="decimal"
                  onChange={(event) =>
                    updateLine(index, "unitPrice", event.target.value)
                  }
                  value={line.unitPrice}
                />
              </PortalField>
              <PortalField label={`Discount (${symbol})`} required>
                <input
                  disabled={line.recurrenceMonths !== "0" && !fixed}
                  inputMode="decimal"
                  onChange={(event) =>
                    updateLine(index, "discount", event.target.value)
                  }
                  value={line.discount}
                />
              </PortalField>
              <PortalField label={`Tax amount (${symbol})`} required>
                <input
                  disabled={line.recurrenceMonths !== "0" && !fixed}
                  inputMode="decimal"
                  onChange={(event) =>
                    updateLine(index, "tax", event.target.value)
                  }
                  value={line.tax}
                />
              </PortalField>
              <PortalSelect
                label="Billing interval"
                onChange={(event) =>
                  updateLine(index, "recurrenceMonths", event.target.value)
                }
                value={line.recurrenceMonths}
              >
                <option value="0">One-off</option>
                <option value="1">Monthly</option>
                <option value="3">Quarterly</option>
                <option value="12">Annual</option>
              </PortalSelect>
              <PortalField label="Contract start date" required>
                <input
                  onChange={(event) =>
                    updateLine(index, "startDate", event.target.value)
                  }
                  type="date"
                  value={line.startDate}
                />
              </PortalField>
              <PortalField label="Contract end date">
                <input
                  onChange={(event) =>
                    updateLine(index, "endDate", event.target.value)
                  }
                  type="date"
                  value={line.endDate}
                />
              </PortalField>
            </div>
          </section>
        ))}
      </div>
      <PortalButton
        disabled={lines.length >= 30}
        onClick={() => onAdd()}
        type="button"
        variant="secondary"
      >
        Add line item
      </PortalButton>
      <p className={styles.totalLine}>
        Priced service fees{" "}
        <strong>
          {total ? formatGbp(total, currency) : "Complete fee lines"}
        </strong>
      </p>
    </fieldset>
  );
}
