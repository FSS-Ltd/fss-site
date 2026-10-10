"use client";

import {
  PortalCheckbox,
  PortalField,
  PortalSelect,
  PortalTextarea,
} from "@/components/portal/ui";
import { decimalToMinor, type Currency } from "@/lib/operations/money";
import {
  commercialOfferSpecSchema,
  type CommercialOfferSpec,
} from "@/lib/operations/agreements/commercial-types";
import type { AgreementBuilderDraftContent } from "@/lib/operations/agreements/builder-draft-schema";
import styles from "./agreements.module.css";

export function readCommercialOffer(
  data: FormData,
): AgreementBuilderDraftContent["commercialOffer"] {
  const cashMode = String(data.get("cashMode") ?? "fixed");
  const enabled = data.has("revenueShareEnabled");
  if (cashMode === "fixed" && !enabled) return undefined;
  const shareMode = String(data.get("shareMode") ?? "fixed");
  const terms = {
    revenueSource: String(data.get("revenueSource") ?? ""),
    calculationBasis: String(data.get("calculationBasis") ?? ""),
    duration: String(data.get("shareDuration") ?? ""),
    reportingRequirements: String(data.get("reportingRequirements") ?? ""),
    paymentTerms: String(data.get("sharePaymentTerms") ?? ""),
  };
  const parsed = commercialOfferSpecSchema.safeParse({
    cash: cashMode === "disabled" ? null : { mode: cashMode },
    revenueShare: enabled
      ? {
          ...terms,
          mode: shareMode,
          ...(shareMode === "fixed"
            ? {
                percentageBps: Number(
                  decimalToMinor(String(data.get("sharePercentage") ?? "")),
                ),
              }
            : {}),
        }
      : null,
  });
  if (!parsed.success)
    throw new Error(
      parsed.error.issues[0]?.message ??
        "Check the offered compensation terms.",
    );
  const spec = parsed.data;
  const expiration = new Date(String(data.get("offerExpiresAt") ?? ""));
  if (!Number.isFinite(expiration.getTime()))
    throw new Error("Set an offer expiry date before publishing.");
  return { spec, expiresAt: expiration.toISOString() };
}

export function CommercialOfferFields({
  spec,
  currency,
  expiresAt,
  onChange,
}: Readonly<{
  spec: CommercialOfferSpec;
  currency: Currency;
  expiresAt?: string;
  onChange: (spec: CommercialOfferSpec) => void;
}>): React.JSX.Element {
  const share = spec.revenueShare;
  const needsOffer = Boolean(share) || spec.cash?.mode !== "fixed";
  return (
    <fieldset className={styles.feeFieldset}>
      <legend>Ongoing compensation</legend>
      <p>
        One-off fees remain fixed and payable whichever ongoing option the
        client selects.
      </p>
      <PortalSelect
        label="Recurring payment"
        name="cashMode"
        value={spec.cash?.mode ?? "disabled"}
        onChange={(event) =>
          onChange({
            ...spec,
            cash:
              event.target.value === "disabled"
                ? null
                : {
                    mode:
                      event.target.value === "client_proposed"
                        ? "client_proposed"
                        : "fixed",
                  },
          })
        }
      >
        <option value="fixed">Set the recurring amount</option>
        <option value="client_proposed">
          Let the client propose a recurring amount
        </option>
        <option value="disabled">Revenue share only</option>
      </PortalSelect>
      {spec.cash?.mode === "client_proposed" ? (
        <p>
          The client proposes one combined amount per billing period, minimum 20{" "}
          {currency}. You review it before signing. Ongoing services use
          matching intervals and service dates.
        </p>
      ) : null}
      <PortalCheckbox
        name="revenueShareEnabled"
        label="Offer revenue share for this agreement"
        checked={Boolean(share)}
        onChange={(event) =>
          onChange({
            ...spec,
            revenueShare: event.target.checked
              ? {
                  mode: "fixed",
                  percentageBps: 1000,
                  revenueSource: "",
                  calculationBasis: "",
                  duration: "",
                  reportingRequirements: "",
                  paymentTerms: "",
                }
              : null,
          })
        }
      />
      {share ? (
        <>
          <PortalSelect
            label="Share percentage"
            name="shareMode"
            value={share.mode}
            onChange={(event) => {
              const { mode: _mode, ...terms } = share;
              void _mode;
              const { percentageBps: _percentage, ...base } =
                "percentageBps" in terms
                  ? terms
                  : { ...terms, percentageBps: 1000 };
              void _percentage;
              onChange({
                ...spec,
                revenueShare:
                  event.target.value === "fixed"
                    ? { ...base, mode: "fixed", percentageBps: 1000 }
                    : { ...base, mode: "client_proposed" },
              });
            }}
          >
            <option value="fixed">Set the percentage</option>
            <option value="client_proposed">
              Let the client propose a percentage
            </option>
          </PortalSelect>
          {share.mode === "fixed" ? (
            <PortalField label="Revenue share (%)" required>
              <input
                name="sharePercentage"
                inputMode="decimal"
                defaultValue={(share.percentageBps / 100).toFixed(2)}
                required
              />
            </PortalField>
          ) : (
            <p>
              Client-proposed revenue share must be at least 10% and needs your
              approval.
            </p>
          )}
          <PortalTextarea
            label="Revenue source"
            name="revenueSource"
            defaultValue={share.revenueSource}
            required
          />
          <PortalTextarea
            label="Calculation basis"
            name="calculationBasis"
            defaultValue={share.calculationBasis}
            required
          />
          <PortalField label="Share duration" required>
            <input
              name="shareDuration"
              defaultValue={share.duration}
              required
            />
          </PortalField>
          <PortalTextarea
            label="Reporting requirements"
            name="reportingRequirements"
            defaultValue={share.reportingRequirements}
            required
          />
          <PortalTextarea
            label="Share payment terms"
            name="sharePaymentTerms"
            defaultValue={share.paymentTerms}
            required
          />
          <p>
            Revenue share replaces ongoing cash charges. Reporting and share
            collection are handled outside this feature.
          </p>
        </>
      ) : null}
      {needsOffer ? (
        <PortalField
          label="Offer expiry"
          hint="Publish reviewed terms for up to 90 days."
          required
        >
          <input
            name="offerExpiresAt"
            type="datetime-local"
            defaultValue={expiresAt ? localDateTime(expiresAt) : ""}
            required
          />
        </PortalField>
      ) : null}
    </fieldset>
  );
}

function localDateTime(value: string): string {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}
