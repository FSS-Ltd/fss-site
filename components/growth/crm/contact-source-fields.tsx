import { contactSchema } from "@/lib/growth/crm/schemas";
import { FieldGroup, FormField } from "./form-field";
import { fieldText, localInstant, nullableText } from "./form-values";
import styles from "./crm.module.css";

export function sourcedContact(data: FormData) {
  return contactSchema.parse({
    firstName: fieldText(data, "firstName"),
    lastName: fieldText(data, "lastName"),
    email: fieldText(data, "email"),
    roleTitle: nullableText(data, "roleTitle"),
    sourceUrl: fieldText(data, "emailSource"),
    verifiedAt: localInstant(fieldText(data, "verifiedAt")),
    lawfulBasis: fieldText(data, "lawfulBasis"),
  });
}
export function ContactSourceFields({
  defaults,
}: {
  defaults?: { firstName: string; lastName: string; email: string };
}) {
  return (
    <>
      <FieldGroup>
        <FormField
          label="First name"
          name="firstName"
          defaultValue={defaults?.firstName}
          required
          maxLength={100}
        />
        <FormField
          label="Last name"
          name="lastName"
          defaultValue={defaults?.lastName}
          required
          maxLength={100}
        />
      </FieldGroup>
      <FieldGroup>
        <FormField
          label="Email"
          name="email"
          type="email"
          defaultValue={defaults?.email}
          required
          maxLength={254}
        />
        <FormField label="Role" name="roleTitle" maxLength={150} />
      </FieldGroup>
      <FormField
        label="Contact source URL"
        name="emailSource"
        type="url"
        required
        help="Page where this contact address was checked."
      />
      <FormField
        label="Contact checked (your device time)"
        name="verifiedAt"
        type="datetime-local"
        required
      />
      <label className={styles.field}>
        <span>Lawful basis for holding this contact</span>
        <select name="lawfulBasis" required>
          <option value="">Choose a basis</option>
          <option value="requested_service">They requested a service</option>
          <option value="legitimate_interests">
            Legitimate interests reviewed
          </option>
        </select>
      </label>
      <p className={styles.muted}>
        This records contact provenance. Corporate and outreach eligibility
        still require review. No newsletter consent is added.
      </p>
    </>
  );
}
