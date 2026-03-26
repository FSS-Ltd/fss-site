import { Section } from "@/components/ui/section";

const logos = ["Lumina", "Hadron", "Questline", "Datawave", "Pioneer"];

export function TrustStrip() {
  return (
    <Section className="border-y border-border-soft/40 py-8" containerClassName="space-y-6">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-text-subtle">
        Trusted by product-led teams
      </p>
      <ul className="grid grid-cols-2 gap-3 text-center text-sm text-text-muted sm:grid-cols-5">
        {logos.map((logo) => (
          <li
            key={logo}
            className="rounded-lg border border-border-soft/45 bg-surface-1/65 px-3 py-2.5 font-medium tracking-wide"
          >
            {logo}
          </li>
        ))}
      </ul>
    </Section>
  );
}
