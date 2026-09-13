import Link from "next/link";
import Image from "next/image";
import { ButtonLink } from "@/components/ui/button";
import { ContactLink } from "./page-intro";
import { NexStepsProof } from "./nexsteps-proof";
import { DeliverySteps } from "./delivery-steps";
import { RelatedLinks } from "./related-links";
import { sectorLink, costLink } from "@/lib/commercial/links";
import styles from "./public-page.module.css";
import homeStyles from "./home-page.module.css";

export function HomePage() {
  return (
    <div className={`${styles.page} ${homeStyles.home}`}>
      <section
        className={homeStyles.hero}
        aria-labelledby="home-title"
        data-motion-reveal="mask"
      >
        <canvas
          data-hero-canvas
          className={homeStyles.particleCanvas}
          aria-hidden="true"
        />
        <div className={homeStyles.heroGrid}>
          <div className={homeStyles.intro}>
            <p className={homeStyles.eyebrow}>
              Faithful Software Solutions · UK studio
            </p>
            <h1 id="home-title" className={homeStyles.title}>
              Custom software for the work your <em>mission</em> depends on.
            </h1>
            <p className={homeStyles.description}>
              We build custom software for UK charities and faith organisations:
              portals, operational systems and workflow automation shaped around
              your people.
            </p>
            <div className={homeStyles.actions}>
              <ContactLink />
              <Link href="/work/nexsteps" className={homeStyles.caseStudyLink}>
                Read the NexSteps case study
              </Link>
            </div>
            <p className={homeStyles.audience}>
              <span>BUILT FOR</span>
              <span>Charities</span>
              <span>Faith organisations</span>
              <span>Schools</span>
            </p>
          </div>
          <div
            className={homeStyles.markStage}
            aria-hidden="true"
            data-motion-parallax="0.08"
          >
            <svg className={homeStyles.circuit} viewBox="0 0 520 450">
              <path d="M0 108h110v78h96" />
              <path d="M520 330H398v-82h-84" />
              <path d="M472 74H370v62h-64" />
              <circle cx="206" cy="186" r="5" />
              <circle cx="314" cy="248" r="5" />
              <circle cx="306" cy="136" r="5" />
            </svg>
            <div className={homeStyles.markFrame}>
              <Image
                src="/images/editorial/home-mission-systems-v1.webp"
                alt=""
                width={2048}
                height={1280}
                priority
                sizes="(max-width: 760px) 92vw, 44vw"
                className={homeStyles.editorialImage}
              />
              <div className={homeStyles.markOverlay}>
                <Image
                  src="/redesign/brand/fss-monogram-white.png"
                  alt=""
                  width={709}
                  height={316}
                  className={homeStyles.markImage}
                />
              </div>
              <div className={homeStyles.markCaption}>
                <span>FSS / SYSTEMS</span>
                <span>BUILT TO LAST</span>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section
        className={homeStyles.kineticStatement}
        aria-label="Our approach"
        data-motion-scene
      >
        <p data-motion-kinetic>Systems that fit the way you work.</p>
        <p data-motion-kinetic="reverse">
          Software for the people who care for others.
        </p>
      </section>
      <div className={homeStyles.serviceSection} data-motion-reveal="mask">
        <div className={homeStyles.serviceHeader}>
          <div>
            <p>WHAT WE BUILD</p>
            <h2>Systems that fit the way you work.</h2>
          </div>
          <Link href="/services">All services</Link>
        </div>
        <div className={homeStyles.serviceGrid}>
          <article className={homeStyles.serviceCard} data-motion-reveal="left">
            <div className={homeStyles.serviceNumber}>01</div>
            <h3>Custom platforms and portals</h3>
            <p>
              Connect teams, members and services with operational software,
              dashboards and access shaped around each person’s role.
            </p>
            <Link href="/services/portal-development">Explore portals</Link>
          </article>
          <article
            className={homeStyles.serviceCard}
            data-motion-reveal="right"
          >
            <div className={homeStyles.serviceNumber}>02</div>
            <h3>Workflows and integrations</h3>
            <p>
              Reduce repeated data entry and connect the tools your organisation
              already relies on, with clear review and exception handling.
            </p>
            <Link href="/services/workflow-automation">Explore automation</Link>
          </article>
          <article className={homeStyles.serviceCard} data-motion-reveal="left">
            <div className={homeStyles.serviceNumber}>03</div>
            <h3>Private and local AI</h3>
            <p>
              Assess sensitive workflows before data reaches the wrong tools,
              with deployment boundaries and oversight built into the work.
            </p>
            <Link href="/services/private-ai">Explore private AI</Link>
          </article>
        </div>
      </div>
      <div className={homeStyles.proofScene} data-motion-scene>
        <NexStepsProof className={homeStyles.proofFeature} motionTrack />
      </div>
      <div className={homeStyles.processWrap}>
        <DeliverySteps />
      </div>
      <div className={homeStyles.processWrap}>
        <RelatedLinks links={[sectorLink, costLink]} />
      </div>
      <section
        className={homeStyles.closing}
        aria-labelledby="home-closing"
        data-motion-wipe
      >
        <p>LET’S BUILD</p>
        <h2 id="home-closing">Start with the operational problem.</h2>
        <p>
          Tell us what is getting in the way. We will help you decide whether a
          custom system is the right next step.
        </p>
        <ButtonLink
          href="/contact"
          prefetch={false}
          magnetic
          className={homeStyles.closingLink}
        >
          Discuss your project
        </ButtonLink>
      </section>
    </div>
  );
}
