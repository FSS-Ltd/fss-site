import { ServicesBusiness } from "./services-business";
import { ServicesCta } from "./services-cta";
import { ServicesEducation } from "./services-education";
import { ServicesHero } from "./services-hero";
import { ServicesProcess } from "./services-process";
import { ServicesReligious } from "./services-religious";

export function ServicesPage() {
  return (
    <>
      <ServicesHero />
      <ServicesBusiness />
      <ServicesEducation />
      <ServicesReligious />
      <ServicesProcess />
      <ServicesCta />
    </>
  );
}
