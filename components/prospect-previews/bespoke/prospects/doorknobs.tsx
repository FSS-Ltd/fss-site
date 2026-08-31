import Image from "next/image";
import { ArrowDown, ArrowRight, MapPin, Phone } from "lucide-react";

import { ConceptBar, OwnerInvitation } from "../concept-chrome";
import { DemoEnquiry } from "../demo-enquiry";
import { RevealOnScroll } from "../../reveal-on-scroll";
import { DoorknobsPropertyNavigator } from "./doorknobs-property-navigator";

const enquiryFields = [
  {
    id: "journey",
    label: "Which property journey are you planning?",
    type: "select",
    options: ["Selling", "Letting a property", "Buying", "Renting"],
  },
  {
    id: "location",
    label: "Property postcode or preferred area",
    type: "text",
    placeholder: "For example, TN1 or Tunbridge Wells",
  },
  {
    id: "timing",
    label: "When would you like to move forward?",
    type: "select",
    options: ["This month", "Within three months", "Planning ahead"],
  },
  {
    id: "email",
    label: "Best email address",
    type: "email",
    placeholder: "you@example.co.uk",
  },
] as const;

const landlordServices = [
  {
    number: "01",
    title: "Let Only",
    copy: "A landlord option for when you want a focused start to the letting process.",
  },
  {
    number: "02",
    title: "Rent Collection",
    copy: "A landlord option that keeps rent collection in view after the tenancy begins.",
  },
  {
    number: "03",
    title: "Full Management",
    copy: "A landlord option for broader ongoing property management support.",
  },
] as const;

export function DoorknobsPage() {
  return (
    <div className="doorknobsPage" data-bespoke-prospect="doorknobs">
      <ConceptBar businessName="Doorknobs" />
      <main id="top">
        <section className="doorknobsHero" aria-labelledby="doorknobs-title">
          <Image
            alt="A sky-blue front door opening onto a warmly lit home"
            className="doorknobsHeroImage"
            fill
            priority
            sizes="100vw"
            src="/prospect-previews/bespoke/doorknobs/property-threshold-v1.webp"
          />
          <div className="doorknobsHeroWash" />
          <div className="doorknobsHeroLight" aria-hidden="true" />

          <header className="doorknobsHeader">
            <a
              aria-label="Doorknobs home"
              className="doorknobsBrand"
              href="#top"
            >
              <Image
                alt="Doorknobs"
                height={63}
                priority
                src="/prospect-previews/bespoke/doorknobs/doorknobs-logo-v1.png"
                width={180}
              />
            </a>
            <a className="doorknobsPhone" href="tel:01892512101">
              <Phone aria-hidden="true" size={16} strokeWidth={2.2} />
              <span>01892 512101</span>
            </a>
          </header>

          <div className="doorknobsHeroCopy">
            <p className="doorknobsEyebrow">
              <MapPin aria-hidden="true" size={15} strokeWidth={2.2} />
              Tunbridge Wells property services
            </p>
            <h1 id="doorknobs-title">
              Choose the next property move that feels right for you.
            </h1>
            <p>
              Independent, family-run local support for selling, letting, buying
              and renting, with more than 30 years of established experience
              behind every first conversation.
            </p>
            <a className="doorknobsPrimaryAction" href="#property-journey">
              Choose your property journey
              <ArrowDown aria-hidden="true" size={17} strokeWidth={2.3} />
            </a>
          </div>
        </section>

        <DoorknobsPropertyNavigator />

        <RevealOnScroll as="section" className="doorknobsTrustSection">
          <div className="doorknobsTrustImage">
            <Image
              alt="Warm local home detail"
              fill
              sizes="(min-width: 1024px) 42vw, 100vw"
              src="/prospect-previews/bespoke/doorknobs/local-home-detail-v1.webp"
            />
          </div>
          <div className="doorknobsTrustCopy">
            <p className="doorknobsEyebrow">Local perspective</p>
            <h2>Property decisions deserve more than a generic next step.</h2>
            <p>
              Doorknobs brings together local sales and lettings support in one
              independent, family-run business. Whether you are moving, buying,
              letting or renting, the first step can meet the decision in front
              of you.
            </p>
            <a href="#property-enquiry">
              Start with a valuation or property conversation
              <ArrowRight aria-hidden="true" size={17} strokeWidth={2.3} />
            </a>
          </div>
        </RevealOnScroll>

        <RevealOnScroll
          as="section"
          className="doorknobsLandlordSection"
          id="landlord-services"
        >
          <div className="doorknobsLandlordHeading">
            <p className="doorknobsEyebrow">For landlords</p>
            <h2>
              Choose the level of letting support that suits your property.
            </h2>
            <p>
              Landlord services are offered through three clear routes, so you
              can start with the level of involvement you want.
            </p>
          </div>
          <div className="doorknobsLandlordGrid">
            <div className="doorknobsLandlordImage">
              <Image
                alt="Calm managed-home interior detail"
                fill
                sizes="(min-width: 1024px) 42vw, 100vw"
                src="/prospect-previews/bespoke/doorknobs/landlord-care-v1.webp"
              />
            </div>
            <ol className="doorknobsServiceList">
              {landlordServices.map((service) => (
                <li key={service.title}>
                  <span>{service.number}</span>
                  <div>
                    <h3>{service.title}</h3>
                    <p>{service.copy}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </RevealOnScroll>

        <RevealOnScroll
          as="section"
          className="doorknobsEnquirySection"
          id="property-enquiry"
        >
          <div className="doorknobsEnquiryIntro">
            <p className="doorknobsEyebrow">A considered first brief</p>
            <h2>
              Share the move you are considering when the timing feels right.
            </h2>
            <p>
              This private concept collects the journey, location and timing
              that would make a first Doorknobs conversation more useful.
            </p>
          </div>
          <DemoEnquiry
            businessName="Doorknobs"
            buttonLabel="Prepare my property brief"
            fields={enquiryFields}
            formClassName="doorknobsEnquiryForm"
            successMessage="This concept is not connected to live systems. In a launch version, Doorknobs could receive the journey, location and timing as one organised property brief."
            successTitle="Your property brief is ready"
          />
        </RevealOnScroll>
      </main>
      <OwnerInvitation businessName="Doorknobs Limited" />
    </div>
  );
}
