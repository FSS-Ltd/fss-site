import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { ContactLink } from "./page-intro";
import { NexStepsProof } from "./nexsteps-proof";
import { DeliverySteps } from "./delivery-steps";
import { RelatedLinks } from "./related-links";
import { HomeStory, HomeValueStory } from "./home-story";
import { AppJourney } from "./app-journey";
import { sectorLink, costLink } from "@/lib/commercial/links";
import styles from "./public-page.module.css";
import homeStyles from "./home-page.module.css";
import {
  ValueNetworkPoster,
  networkView,
} from "@/components/redesign/value-network-poster";
import cta from "@/components/ui/cta-motion.module.css";

export function HomePage() {
  return (
    <div className={`${styles.page} ${homeStyles.home}`}>
      <section className={homeStyles.hero} aria-labelledby="home-title">
        <canvas
          data-hero-canvas
          className={homeStyles.particleCanvas}
          aria-hidden="true"
        />
        <div className={homeStyles.heroGrid}>
          <div className={homeStyles.intro} data-intro>
            <p className={homeStyles.eyebrow}>
              Faithful Software Solutions · UK studio
            </p>
            <h1 id="home-title" className={homeStyles.title}>
              AI and custom software for the work your <em>business</em> depends
              on.
            </h1>
            <p
              style={{
                maxWidth: 540,
                margin: "22px 0 0",
                paddingLeft: 14,
                borderLeft: "3px solid #a64224",
                color: "#211b17",
                fontSize: "1.0625rem",
                fontWeight: 560,
                lineHeight: 1.5,
              }}
            >
              For a learning centre,{" "}
              <Link
                href="/work/nexsteps"
                className={cta.link}
                style={{ color: "#a64224" }}
              >
                NexSteps
              </Link>{" "}
              turned hours of admin into more time with the children and
              families.
            </p>
            <p className={homeStyles.description}>
              We add AI to the systems you already use, automate repeated work
              and build custom software for businesses of any size, from
              owner-led firms to large teams.
            </p>
            <div className={homeStyles.actions}>
              <ContactLink />
              <Link
                href="/work/nexsteps"
                className={`${homeStyles.caseStudyLink} ${cta.sweep}`}
              >
                Read the NexSteps case study
              </Link>
            </div>
            <p className={homeStyles.audience}>
              <span>BUILT FOR</span>
              <span>Small businesses</span>
              <span>Growing teams</span>
              <span>Large organisations</span>
            </p>
          </div>
        </div>
        {/* The site's own value network, bled across the hero. The poster is the
            static frame for first paint, no-JS and reduced motion, until the
            canvas takes over. */}
        <div
          className={homeStyles.markStage}
          aria-hidden="true"
          data-motion-parallax="0.08"
        >
          <canvas
            data-hero-canvas
            data-value-particles
            data-network-nodes={networkView.nodes}
            data-network-view={`${networkView.width}x${networkView.height}`}
            className={homeStyles.networkCanvas}
          />
          <ValueNetworkPoster className={homeStyles.poster} />
        </div>
      </section>
      <HomeValueStory />
      <HomeStory />
      <AppJourney>
        <div className={homeStyles.serviceSection}>
          <div className={homeStyles.serviceHeader}>
            <div>
              <p>WHAT WE BUILD</p>
              <h2>Systems that fit the way you work.</h2>
            </div>
            <Link
              href="/services"
              className={`${homeStyles.caseStudyLink} ${cta.sweep}`}
            >
              All services
            </Link>
          </div>
          <div className={homeStyles.serviceGrid}>
            <article
              className={homeStyles.serviceCard}
              data-motion-reveal="left"
            >
              <div className={homeStyles.serviceNumber}>01</div>
              <h3>AI integration and agents</h3>
              <p>
                Add AI to the tools your team already uses, with approval steps,
                logs and a clear route for anything it cannot handle.
              </p>
              <Link href="/services/ai-integration" className={cta.link}>
                Explore AI integration
              </Link>
            </article>
            <article
              className={homeStyles.serviceCard}
              data-motion-reveal="right"
            >
              <div className={homeStyles.serviceNumber}>02</div>
              <h3>Workflows and integrations</h3>
              <p>
                Reduce repeated data entry and connect the tools your business
                already relies on, with clear review and exception handling.
              </p>
              <Link href="/services/workflow-automation" className={cta.link}>
                Explore automation
              </Link>
            </article>
            <article
              className={homeStyles.serviceCard}
              data-motion-reveal="left"
            >
              <div className={homeStyles.serviceNumber}>03</div>
              <h3>Private and local AI</h3>
              <p>
                Assess sensitive workflows before data reaches the wrong tools,
                with deployment boundaries and oversight built into the work.
              </p>
              <Link href="/services/private-ai" className={cta.link}>Explore private AI</Link>
            </article>
          </div>
        </div>
      </AppJourney>
      <NexStepsProof className={homeStyles.proofFeature} />
      <div className={homeStyles.processWrap}>
        <DeliverySteps cinematic />
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
        <h2 id="home-closing">Start with the problem.</h2>
        <p>
          Tell us what is getting in the way. We will help you decide whether
          AI, automation or a custom system is the right next step.
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
