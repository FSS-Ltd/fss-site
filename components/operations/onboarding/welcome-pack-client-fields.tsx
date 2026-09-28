import type { WelcomePackVersion } from "@/lib/operations/onboarding/welcome-packs";
import { PortalField, PortalTextarea } from "@/components/portal/ui";

export function interpolateWelcomePackCopy(
  value: string,
  replacements: Readonly<Record<string, string>>,
): string {
  return value.replace(
    /{{([a-z_]+)}}/g,
    (_match, key: string) => replacements[key] ?? "",
  );
}

export function WelcomePackClientFields({
  version,
  replacements,
  disabled,
}: Readonly<{
  version: WelcomePackVersion;
  replacements: Readonly<Record<string, string>>;
  disabled: boolean;
}>): React.JSX.Element {
  const copy = (value: string) =>
    interpolateWelcomePackCopy(value, replacements);

  return (
    <>
      <fieldset disabled={disabled}>
        <legend>Welcome email and guide</legend>
        <PortalField label="Welcome email subject" required>
          <input
            key={version.id}
            defaultValue={copy(version.content.emailSubject)}
            maxLength={160}
            name="emailSubject"
            required
          />
        </PortalField>
        <PortalTextarea
          key={`${version.id}-email`}
          label="Welcome email copy"
          defaultValue={copy(version.content.emailBody)}
          maxLength={6_000}
          name="emailBody"
          required
          rows={8}
        />
        <p>Each guide section becomes one readable page in the client PDF.</p>
        {version.content.guide.map((page, index) => (
          <div key={`${version.id}-guide-${index}`}>
            <PortalField label={`Guide section ${index + 1} title`} required>
              <input
                defaultValue={copy(page.title)}
                maxLength={100}
                name={`page-title-${index}`}
                required
              />
            </PortalField>
            <PortalTextarea
              label={page.title}
              defaultValue={page.paragraphs.map(copy).join("\n\n")}
              maxLength={6_000}
              name={`page-${index}`}
              required
              rows={4}
            />
          </div>
        ))}
      </fieldset>
      <fieldset disabled={disabled}>
        <legend>After signing</legend>
        <PortalField label="Thank-you subject" required>
          <input
            key={`${version.id}-thank-you-subject`}
            defaultValue={copy(version.content.thankYou.subject)}
            maxLength={200}
            name="thankYouSubject"
            required
          />
        </PortalField>
        <PortalTextarea
          key={`${version.id}-thank-you-intro`}
          label="Thank-you opening"
          defaultValue={copy(version.content.thankYou.intro)}
          maxLength={2_000}
          name="thankYouIntro"
          required
          rows={3}
        />
        <PortalTextarea
          key={`${version.id}-thank-you-next-step`}
          label="Next step"
          defaultValue={copy(version.content.thankYou.nextStep)}
          maxLength={2_000}
          name="thankYouNextStep"
          required
          rows={3}
        />
        <PortalTextarea
          key={`${version.id}-thank-you-action`}
          label="Client action"
          defaultValue={copy(version.content.thankYou.requiredAction)}
          maxLength={2_000}
          name="thankYouAction"
          required
          rows={3}
        />
      </fieldset>
    </>
  );
}
