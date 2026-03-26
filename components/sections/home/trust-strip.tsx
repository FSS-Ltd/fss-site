import { Section } from "@/components/ui/section";

const logos = ["Lumina", "Hadron", "Questline", "Datawave", "Pioneer"];

export function TrustStrip() {
  return (
    <Section className="border-y border-white/8 py-8" containerClassName="space-y-5">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
        Trusted by product-led teams
      </p>
      <ul className="grid grid-cols-2 gap-4 text-center text-sm text-zinc-300 sm:grid-cols-5">
        {logos.map((logo) => (
          <li key={logo} className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
            {logo}
          </li>
        ))}
      </ul>
    </Section>
  );
}
