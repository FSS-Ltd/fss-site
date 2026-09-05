import { ExampleEnquiry } from "./enquiry";
import { SectionHeading } from "./chrome";
import { CashWorkspace } from "./cash-workspace";

export function AccountancyExample() {
  return (
    <>
      <section className="folio-hero">
        <div>
          <p className="example-eyebrow">Accounting for the way you work.</p>
          <h1>
            Less head
            <br />
            in the books.
            <br />
            <em>
              More room
              <br />
              to grow.
            </em>
          </h1>
          <p>
            Clear numbers. Useful conversations. Accounting support that gives
            you the space to get on with your business.
          </p>
          <a href="#enquire" className="example-button">
            Find your next step ↗
          </a>
          <span className="folio-hero-note">
            For independent minds & growing businesses.
          </span>
        </div>
        <CashWorkspace />
      </section>
      <div className="folio-promise">
        <span>A little more clarity.</span>
        <span>A lot less chasing.</span>
        <span>A better conversation.</span>
      </div>
      <section className="example-section" id="services">
        <SectionHeading number="01" title="A good place to start">
          <h2>
            Wherever you are,
            <br />
            <em>let’s move forward.</em>
          </h2>
        </SectionHeading>
        <div className="folio-services">
          {[
            [
              "01",
              "Make a good start.",
              "For new businesses",
              "Get organised from the beginning. Understand your records, responsibilities and the questions to settle before you grow.",
              "↗",
            ],
            [
              "02",
              "Find your rhythm.",
              "For established businesses",
              "Bookkeeping, accounts and regular conversations. Put a dependable routine around the numbers.",
              "≈",
            ],
            [
              "03",
              "See what’s possible.",
              "For the next chapter",
              "Make cash flow and management reporting part of your decisions, with a clear view of the assumptions behind them.",
              "+",
            ],
          ].map(([n, title, label, description, symbol]) => (
            <article key={n} data-reveal>
              <p className="example-eyebrow">
                {n} / {label}
              </p>
              <span className="folio-service-symbol" aria-hidden="true">
                {symbol}
              </span>
              <h3>{title}</h3>
              <p>{description}</p>
              <a href="#enquire">Let’s talk it through ↗</a>
            </article>
          ))}
        </div>
      </section>
      <section className="folio-approach example-section" id="approach">
        <div data-reveal>
          <p className="example-eyebrow">02 / People before spreadsheets</p>
          <h2>
            You bring
            <br />
            the ambition.
            <br />
            <em>
              We bring
              <br />
              the clarity.
            </em>
          </h2>
        </div>
        <div className="folio-approach-steps">
          {[
            [
              "A proper introduction",
              "Your business, your systems and what you want to change. We start by listening.",
            ],
            [
              "Support that fits",
              "An agreed scope, a clear fee and a practical plan for getting started.",
            ],
            [
              "A conversation that continues",
              "Questions answered in plain English. Numbers you can use. Support as things change.",
            ],
          ].map(([title, description], index) => (
            <article key={title} data-reveal>
              <span>0{index + 1}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="example-section example-faq">
        <p className="example-eyebrow">Let’s clear a few things up</p>
        <details>
          <summary>Can I switch from my current accountant?</summary>
          <p>
            A first conversation would establish your deadlines and current
            arrangements, then explain what a handover would involve before you
            decide.
          </p>
        </details>
        <details>
          <summary>How much support do I need?</summary>
          <p>
            That depends on your business, records and goals. The enquiry below
            helps prepare a useful discussion about scope rather than offering
            an arbitrary package.
          </p>
        </details>
      </section>
      <ExampleEnquiry theme="accounts" />
    </>
  );
}
