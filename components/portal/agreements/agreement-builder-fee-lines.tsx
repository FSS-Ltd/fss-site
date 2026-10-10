import {
  PortalButton,
  PortalCheckbox,
  PortalField,
  PortalSelect,
} from "@/components/portal/ui";
import { formatGbp } from "./agreement-builder-step-support";
import { currencySymbol, type Currency } from "@/lib/operations/money";
import type { EditableLine } from "./agreement-builder-fee-inputs";
import type { AgreementBuilderDraftContent } from "@/lib/operations/agreements/builder-draft-schema";
import styles from "./agreements.module.css";

export function AgreementBuilderFeeLines({
  onInteraction,
  includeOneOffFees,
  lines,
  services,
  fixed,
  clientProposed,
  totals,
  currency,
  updateLine,
  onIncludeOneOffFeesChange,
  onAdd,
  onRemove,
  onAddService,
  onUpdateService,
  onRemoveService,
}: Readonly<{
  onInteraction?: () => void;
  includeOneOffFees: boolean;
  lines: readonly EditableLine[];
  services: NonNullable<AgreementBuilderDraftContent["services"]>;
  fixed: boolean;
  clientProposed: boolean;
  totals: Readonly<{
    setup: string | null;
    recurring: readonly { interval: number; amount: string | null }[];
  }>;
  currency: Currency;
  updateLine: (index: number, field: keyof EditableLine, value: string) => void;
  onIncludeOneOffFeesChange: (include: boolean) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onAddService: () => void;
  onUpdateService: (
    id: string,
    field: "code" | "name" | "description",
    value: string,
  ) => void;
  onRemoveService: (id: string) => void;
}>): React.JSX.Element {
  const symbol = currencySymbol(currency);
  return (
    <fieldset className={styles.feeFieldset} data-builder-validate-on-save-only>
      <legend>Service fees</legend>
      {services.length ? (
        <div className={styles.feeLineList}>
          {services.map((service) => (
            <section className={styles.feeLine} key={service.id}>
              <div className={styles.feeLineHeading}>
                <h3>Service identity</h3>
                {services.length > 1 &&
                !lines.some((line) => line.serviceGroupId === service.id) ? (
                  <PortalButton
                    type="button"
                    variant="quiet"
                    onClick={() => onRemoveService(service.id)}
                  >
                    Remove service
                  </PortalButton>
                ) : null}
              </div>
              <p>
                These details describe the whole service across setup and
                ongoing charges.
              </p>
              <div className={styles.fieldGrid}>
                <PortalField label="Service code" required>
                  <input
                    required
                    maxLength={100}
                    value={service.code}
                    onChange={(event) =>
                      onUpdateService(service.id, "code", event.target.value)
                    }
                  />
                </PortalField>
                <PortalField label="Service name" required>
                  <input
                    required
                    maxLength={160}
                    value={service.name}
                    onChange={(event) =>
                      onUpdateService(service.id, "name", event.target.value)
                    }
                  />
                </PortalField>
                <PortalField label="What this service covers" required>
                  <textarea
                    required
                    maxLength={3700}
                    value={service.description}
                    onChange={(event) =>
                      onUpdateService(
                        service.id,
                        "description",
                        event.target.value,
                      )
                    }
                  />
                </PortalField>
              </div>
            </section>
          ))}
          <PortalButton
            type="button"
            variant="secondary"
            onClick={onAddService}
            disabled={services.length >= 30}
          >
            Add another service
          </PortalButton>
        </div>
      ) : (
        <div>
          <p>
            Legacy draft: fee lines have separate service details. Assign them
            to a shared service only after reviewing which charges belong
            together.
          </p>
          <PortalButton
            type="button"
            variant="secondary"
            onClick={onAddService}
          >
            Create shared service identity
          </PortalButton>
        </div>
      )}
      <PortalCheckbox
        checked={includeOneOffFees}
        hint="Turn this off when the agreement has no setup charge. One-off installments are then removed from the saved draft."
        label="Include a one-off fee"
        onChange={(event) => {
          onInteraction?.();
          onIncludeOneOffFeesChange(event.target.checked);
        }}
      />
      <div className={styles.feeLineList}>
        {lines.map((line, index) => (
          <section className={styles.feeLine} key={index}>
            <div className={styles.feeLineHeading}>
              <h3>
                {line.recurrenceMonths === "0"
                  ? "Setup charge"
                  : "Ongoing compensation"}{" "}
                {index + 1}
              </h3>
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
              {services.length ? (
                <PortalSelect
                  label="Service"
                  required
                  value={line.serviceGroupId ?? ""}
                  onChange={(event) =>
                    updateLine(index, "serviceGroupId", event.target.value)
                  }
                >
                  <option value="" disabled>
                    Choose a service
                  </option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name || service.code || "New service"}
                    </option>
                  ))}
                </PortalSelect>
              ) : (
                <>
                  <PortalField label="Service code" required>
                    <input
                      required
                      onChange={(event) =>
                        updateLine(index, "serviceCode", event.target.value)
                      }
                      value={line.serviceCode}
                    />
                  </PortalField>
                  <PortalField label="What this service covers" required>
                    <input
                      required
                      onChange={(event) =>
                        updateLine(index, "description", event.target.value)
                      }
                      value={line.description}
                    />
                  </PortalField>
                </>
              )}
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
                required={line.recurrenceMonths === "0" || fixed}
                hint={
                  clientProposed && line.recurrenceMonths !== "0"
                    ? "The client proposes the combined amount for each billing period."
                    : line.recurrenceMonths !== "0" && fixed
                      ? "Enter a fixed amount for this recurring service."
                      : undefined
                }
              >
                <input
                  disabled={line.recurrenceMonths !== "0" && !fixed}
                  inputMode="decimal"
                  onFocus={onInteraction}
                  onChange={(event) =>
                    updateLine(index, "unitPrice", event.target.value)
                  }
                  value={line.unitPrice}
                />
              </PortalField>
              <PortalField
                label={`Discount (${symbol})`}
                required={line.recurrenceMonths === "0" || fixed}
              >
                <input
                  disabled={line.recurrenceMonths !== "0" && !fixed}
                  inputMode="decimal"
                  onFocus={onInteraction}
                  onChange={(event) =>
                    updateLine(index, "discount", event.target.value)
                  }
                  value={line.discount}
                />
              </PortalField>
              <PortalField
                label={`Tax amount (${symbol})`}
                required={line.recurrenceMonths === "0" || fixed}
              >
                <input
                  disabled={line.recurrenceMonths !== "0" && !fixed}
                  inputMode="decimal"
                  onFocus={onInteraction}
                  onChange={(event) =>
                    updateLine(index, "tax", event.target.value)
                  }
                  value={line.tax}
                />
              </PortalField>
              <PortalSelect
                label="Billing interval"
                onFocus={onInteraction}
                onChange={(event) =>
                  updateLine(index, "recurrenceMonths", event.target.value)
                }
                value={line.recurrenceMonths}
              >
                <option disabled={!includeOneOffFees} value="0">
                  One-off
                </option>
                <option value="1">Monthly</option>
                <option value="3">Quarterly</option>
                <option value="12">Annual</option>
              </PortalSelect>
              <PortalField label="Contract start date" required>
                <input
                  onFocus={onInteraction}
                  required
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
      <div className={styles.totalLine}>
        <p>
          One-off setup fees{" "}
          <strong>
            {totals.setup === null
              ? "Complete fee lines"
              : formatGbp(totals.setup, currency)}
          </strong>
        </p>
        {totals.recurring.map(({ interval, amount }) => (
          <p key={interval}>
            Ongoing every {interval} {interval === 1 ? "month" : "months"}
            <strong>
              {fixed
                ? amount === null
                  ? "Complete fee lines"
                  : formatGbp(amount, currency)
                : clientProposed
                  ? "Client proposal pending"
                  : "Covered by revenue share"}
            </strong>
          </p>
        ))}
      </div>
    </fieldset>
  );
}
