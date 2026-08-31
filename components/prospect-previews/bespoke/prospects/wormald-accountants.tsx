import Image from "next/image";
import {
  ArrowDown,
  ArrowRight,
  Building2,
  FileCheck2,
  LineChart,
  MapPin,
  MessagesSquare,
  Scale,
} from "lucide-react";

import { RevealOnScroll } from "../../reveal-on-scroll";
import { ConceptBar, OwnerInvitation } from "../concept-chrome";
import { DemoEnquiry } from "../demo-enquiry";
import { WormaldClarityJourney } from "./wormald-clarity-journey";

const assetBase = "/prospect-previews/bespoke/wormald-accountants";

const serviceFields = [
  {
    id: "service",
    label: "What would you like help with?",
    type: "select",
    options: [
      "Annual accounts or Self Assessment",
      "Payroll, CIS or VAT",
      "Bookkeeping or management accounts",
      "Tax or business advice",
    ],
  },
  {
    id: "client",
    label: "Who is the advice for?",
    type: "select",
    options: ["Limited company", "Sole trader", "Partnership", "Individual"],
  },
  {
    id: "deadline",
    label: "Is there a deadline?",
    type: "select",
    options: ["Within 30 days", "Within three months", "No fixed deadline"],
  },
  {
    id: "email",
    label: "Email",
    type: "email",
    placeholder: "you@example.co.uk",
  },
] as const;

const trustPoints = [
  { value: "25+", label: "years of experience" },
  { value: "One to one", label: "understood on an individual basis" },
  { value: "Maidstone", label: "accountants based in Kent" },
  { value: "04922533", label: "registered company" },
] as const;

const services = [
  {
    eyebrow: "Keep obligations in order",
    title: "Compliance",
    body: "The recurring accounting and taxation work that keeps individuals and businesses prepared.",
    items: [
      "Annual accounts",
      "Tax Self Assessment",
      "Payroll and CIS filing",
      "VAT returns and filing",
    ],
    Icon: FileCheck2,
  },
  {
    eyebrow: "See the position clearly",
    title: "Support",
    body: "Practical financial information and day-to-day services shaped around the client.",
    items: [
      "Management accounts",
      "Financial analysis and data",
      "Payroll operation",
      "Bookkeeping",
    ],
    Icon: LineChart,
  },
  {
    eyebrow: "Plan what comes next",
    title: "Advising",
    body: "Structured advice for tax, business decisions and longer-term financial planning.",
    items: [
      "Corporate and personal taxes",
      "Retirement and estate planning",
      "Business structures",
      "Financial strategies",
    ],
    Icon: Scale,
  },
] as const;

const guidanceTopics = [
  {
    title: "Starting a business",
    body: "Consider the legal, tax and record-keeping choices that shape a sound start.",
  },
  {
    title: "VAT and business tax",
    body: "Understand the recurring issues that affect trading businesses and company owners.",
  },
  {
    title: "Personal tax",
    body: "Find a clearer starting point for individual tax responsibilities and planning.",
  },
] as const;

export function WormaldAccountantsPage() {
  return (
    <div
      className="wormaldPage min-h-screen overflow-clip"
      data-bespoke-prospect="wormald-accountants"
    >
      <ConceptBar businessName="Wormald Accountants" />
      <main>
        <section className="wormaldHero" id="top">
          <Image
            alt=""
            className="wormaldHeroImage"
            fill
            loading="eager"
            sizes="100vw"
            src={`${assetBase}/hero-ledger-v1.webp`}
          />
          <div aria-hidden="true" className="wormaldHeroWash" />

          <header className="wormaldHeader">
            <a aria-label="Wormald Accountants home" href="#top">
              <Image
                alt="Wormald Accountants"
                className="wormaldLogo"
                height={43}
                priority
                src={`${assetBase}/wormald-logo.png`}
                width={500}
              />
            </a>
            <nav aria-label="Concept navigation">
              <a href="#services">Services</a>
              <a href="#guidance">Guidance</a>
              <a className="wormaldHeaderCta" href="#advice">
                Start a conversation
              </a>
            </nav>
          </header>

          <div className="wormaldHeroContent">
            <RevealOnScroll className="wormaldHeroCopy">
              <p className="wormaldEyebrow">
                Accountants for people and businesses
              </p>
              <h1>Making sense of your numbers.</h1>
              <p className="wormaldHeroLead">
                More than figures and filings. Wormald brings accounting,
                taxation and business advice together around an individual
                understanding of every client.
              </p>
              <div className="wormaldHeroActions">
                <a className="wormaldPrimaryCta" href="#advice">
                  Choose the right support
                  <ArrowDown aria-hidden="true" size={17} />
                </a>
                <a className="wormaldSecondaryCta" href="#services">
                  See how Wormald helps
                </a>
              </div>
            </RevealOnScroll>
          </div>

          <div className="wormaldHeroNote">
            <span>Established expertise</span>
            <strong>Clarity for what comes next</strong>
          </div>
        </section>

        <section aria-label="Wormald at a glance" className="wormaldTrustStrip">
          {trustPoints.map((point) => (
            <div key={point.label}>
              <strong>{point.value}</strong>
              <span>{point.label}</span>
            </div>
          ))}
        </section>

        <section className="wormaldServices" id="services">
          <div className="wormaldSectionIntro">
            <RevealOnScroll>
              <p className="wormaldEyebrow">A joined-up service</p>
              <h2>Three ways to make the financial picture clearer.</h2>
            </RevealOnScroll>
            <RevealOnScroll delay={80}>
              <p>
                Wormald’s experience, built up for over a quarter of a century,
                combines accounting and tax compliance with ongoing support and
                considered advice.
              </p>
            </RevealOnScroll>
          </div>

          <RevealOnScroll className="wormaldPillarsArtwork">
            <Image
              alt="Three sculptural forms representing compliance, support and advice."
              fill
              sizes="(min-width: 1280px) 1200px, 94vw"
              src={`${assetBase}/service-pillars-v1.webp`}
            />
          </RevealOnScroll>

          <div className="wormaldServiceGrid">
            {services.map(({ Icon, body, eyebrow, items, title }, index) => (
              <RevealOnScroll delay={index * 70} key={title}>
                <article className="wormaldServiceCard">
                  <div className="wormaldServiceCardTop">
                    <span>0{index + 1}</span>
                    <Icon aria-hidden="true" size={22} strokeWidth={1.8} />
                  </div>
                  <p>{eyebrow}</p>
                  <h3>{title}</h3>
                  <p>{body}</p>
                  <ul>
                    {items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              </RevealOnScroll>
            ))}
          </div>
        </section>

        <WormaldClarityJourney />

        <section className="wormaldGuidance" id="guidance">
          <div className="wormaldGuidanceIntro">
            <RevealOnScroll>
              <p className="wormaldEyebrow">Practical guidance</p>
              <h2>Useful context, before you need to make a decision.</h2>
            </RevealOnScroll>
            <RevealOnScroll delay={80}>
              <p>
                Wormald already maintains a broad accountancy factsheet library.
                This concept gives the most useful starting points room to be
                found.
              </p>
            </RevealOnScroll>
          </div>
          <div className="wormaldGuidanceGrid">
            {guidanceTopics.map((topic, index) => (
              <RevealOnScroll delay={index * 60} key={topic.title}>
                <article>
                  <span>0{index + 1}</span>
                  <h3>{topic.title}</h3>
                  <p>{topic.body}</p>
                  <a href="#advice">
                    Ask Wormald about this
                    <ArrowRight aria-hidden="true" size={16} />
                  </a>
                </article>
              </RevealOnScroll>
            ))}
          </div>
        </section>

        <section className="wormaldAdvice" id="advice">
          <div className="wormaldAdviceVisual">
            <Image
              alt="An organised consultation brief arranged for a clear review."
              fill
              sizes="(min-width: 1024px) 48vw, 100vw"
              src={`${assetBase}/clarity-brief-v1.webp`}
            />
            <div className="wormaldAdviceBadge">
              <MessagesSquare aria-hidden="true" size={20} />
              <span>A clearer first brief</span>
            </div>
          </div>

          <RevealOnScroll className="wormaldAdviceContent">
            <p className="wormaldEyebrow">Start with your need</p>
            <h2>Prepare the conversation, not a generic message.</h2>
            <p>
              Choose the service, client type and deadline. A live version could
              route the context to the right Wormald conversation before the
              team responds.
            </p>
            <DemoEnquiry
              businessName="Wormald Accountants"
              buttonLabel="Prepare my accountancy enquiry"
              fields={serviceFields}
              formClassName="wormaldEnquiryForm"
              successMessage="A live version could route your service, client type and timing to the relevant Wormald conversation."
              successTitle="Your accountancy brief is ready"
            />
          </RevealOnScroll>
        </section>

        <section className="wormaldLocation">
          <RevealOnScroll className="wormaldLocationCard">
            <MapPin aria-hidden="true" size={24} strokeWidth={1.8} />
            <div>
              <p className="wormaldEyebrow">Based in Maidstone</p>
              <h2>Professional accountants, close enough to understand.</h2>
              <p>Brooks House, 1 Albion Place, Maidstone, Kent ME14 5DY.</p>
            </div>
            <Building2 aria-hidden="true" className="wormaldLocationMark" />
          </RevealOnScroll>
        </section>
      </main>
      <div className="wormaldOwnerInvitation">
        <OwnerInvitation businessName="Wormald Accountants" />
      </div>
    </div>
  );
}
