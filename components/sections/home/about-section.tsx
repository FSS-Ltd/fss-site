import { Section } from "@/components/ui/section";

const stats = [
  { value: "12+", label: "Years Experience" },
  { value: "200+", label: "Projects Delivered" },
  { value: "98%", label: "Client Retention" },
];

export function AboutSection() {
  return (
    <Section id="about" className="border-y border-border-soft/30 bg-surface-1/60">
      <div className="grid gap-16 md:grid-cols-2 md:items-center">
        <div className="relative aspect-video overflow-hidden rounded-xl shadow-2xl">
          <div className="h-full w-full bg-gradient-to-br from-surface-2 to-brand-secondary/40" />
          <div className="pointer-events-none absolute inset-0 bg-brand-primary/10 mix-blend-multiply rounded-xl" />
        </div>

        <div className="space-y-6">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-primary">Our Mission</p>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            The Anchored Vision of Faithful Software Solutions
          </h2>
          <p className="text-lg leading-relaxed text-text-muted">
            At Faithful Software Solutions, we believe technology should be a cornerstone of growth,
            not a source of frustration. Our name reflects our commitment: to provide software that
            is dependable, ethical, and built to last.
          </p>
          <p className="leading-relaxed text-text-muted">
            Whether supporting a global enterprise, an elementary school, or a local community church,
            we approach every project with the same architectural precision and dedication to digital
            craftsmanship.
          </p>

          <div className="flex items-center gap-8 pt-4">
            {stats.map((stat, i) => (
              <div key={stat.label} className="flex items-center gap-8">
                <div>
                  <p className="text-3xl font-extrabold text-foreground">{stat.value}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-widest text-text-subtle">
                    {stat.label}
                  </p>
                </div>
                {i < stats.length - 1 && (
                  <div className="h-12 w-px bg-border-soft/60" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}
