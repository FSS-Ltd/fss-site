import { Section } from "@/components/ui/section";

const institutions = [
  "Lincoln Education Group",
  "Thorne Enterprise",
  "Grace Community Church",
  "Pioneer Foundation",
  "Datawave Corp",
];

export function TrustStrip() {
  return (
    <Section className="border-y border-border-soft/30 py-8" containerClassName="space-y-6">
      <p className="text-center text-xs font-bold uppercase tracking-[0.3em] text-text-subtle">
        Trusted by Forward-Thinking Institutions
      </p>
      <ul className="flex flex-wrap items-center justify-center gap-6 opacity-50 transition-opacity duration-500 hover:opacity-100 md:gap-16">
        {institutions.map((name) => (
          <li key={name} className="text-sm font-medium tracking-wide text-text-muted">
            {name}
          </li>
        ))}
      </ul>
    </Section>
  );
}
