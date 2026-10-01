import { PortalField, PortalSelect } from "@/components/portal/ui";
import {
  deliveryCapacitySchema,
  type ActiveStudioSettings,
  type StudioSettingsSection,
} from "@/lib/operations/studio/active-settings-types";

type Props = Readonly<{
  section: StudioSettingsSection;
  values: ActiveStudioSettings;
  approvedReplyTo: readonly string[];
  pending: boolean;
  onChange: (values: Partial<Omit<ActiveStudioSettings, "revision">>) => void;
}>;

export function SettingsSectionFields({
  section,
  values,
  approvedReplyTo,
  pending,
  onChange,
}: Props): React.JSX.Element {
  switch (section) {
    case "identity":
      return (
        <PortalField
          label="Display name"
          required
          hint="Used in Studio identity and newly prepared welcome materials."
        >
          <input
            name="displayName"
            maxLength={160}
            value={values.displayName}
            disabled={pending}
            onChange={(event) => onChange({ displayName: event.target.value })}
          />
        </PortalField>
      );
    case "communication":
      return (
        <>
          <PortalSelect
            label="Reply-to address"
            name="replyTo"
            value={values.replyTo ?? ""}
            disabled={pending}
            hint={
              approvedReplyTo.length
                ? "Only deployment-approved addresses are available. Applies to new welcome emails."
                : "No approved reply-to is configured. Email credentials remain deployment-owned."
            }
            onChange={(event) =>
              onChange({ replyTo: event.target.value || null })
            }
          >
            <option value="">No reply-to address</option>
            {values.replyTo && !approvedReplyTo.includes(values.replyTo) ? (
              <option value={values.replyTo} disabled>
                {values.replyTo} (no longer approved)
              </option>
            ) : null}
            {approvedReplyTo.map((address) => (
              <option key={address} value={address}>
                {address}
              </option>
            ))}
          </PortalSelect>
          <PortalField
            label="Response expectation (hours)"
            required
            hint="1 to 168 hours. Used for new communication guidance; existing agreements remain fixed."
          >
            <input
              name="responseExpectationHours"
              type="number"
              min={1}
              max={168}
              step={1}
              value={
                Number.isNaN(values.responseExpectationHours)
                  ? ""
                  : values.responseExpectationHours
              }
              disabled={pending}
              onChange={(event) =>
                onChange({
                  responseExpectationHours:
                    event.target.value === ""
                      ? NaN
                      : Number(event.target.value),
                })
              }
            />
          </PortalField>
        </>
      );
    case "timezone":
      return (
        <PortalField
          label="Timezone"
          required
          hint="An IANA timezone for Studio displays and new client defaults. Welcome scheduling remains 09:00 Europe/London."
        >
          <input
            name="timezone"
            maxLength={100}
            value={values.timezone}
            disabled={pending}
            onChange={(event) => onChange({ timezone: event.target.value })}
          />
        </PortalField>
      );
    case "delivery":
      return (
        <PortalSelect
          label="Delivery capacity"
          name="deliveryCapacity"
          value={values.deliveryCapacity}
          disabled={pending}
          onChange={(event) => {
            const value = deliveryCapacitySchema.safeParse(event.target.value);
            if (value.success) onChange({ deliveryCapacity: value.data });
          }}
          hint="Shows Studio's current operational capacity."
        >
          <option value="standard">Standard</option>
          <option value="limited">Limited</option>
          <option value="priority">Priority</option>
        </PortalSelect>
      );
  }
}
