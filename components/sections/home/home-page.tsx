import { AboutSection } from "@/components/sections/home/about-section";
import { FeatureGridSection } from "@/components/sections/home/feature-grid-section";
import { HeroSection } from "@/components/sections/home/hero-section";
import { HomeCtaSection } from "@/components/sections/home/home-cta-section";
import { HowItWorksSection } from "@/components/sections/home/how-it-works-section";
import { TestimonialStrip } from "@/components/sections/home/testimonial-strip";

export function HomePage() {
  return (
    <>
      <HeroSection />
      <FeatureGridSection />
      <AboutSection />
      <HowItWorksSection />
      <TestimonialStrip />
      <HomeCtaSection />
    </>
  );
}
