import Image from "next/image";
import Link from "next/link";
import { sectorExamples, exampleSectors } from "@/lib/sector-examples/catalog";
export default function ExamplesPage() {
  return (
    <main className="example-gallery">
      <header>
        <Link href="/">Faithful Software Solutions</Link>
        <a href="/contact">Let’s talk ↗</a>
      </header>
      <section className="example-gallery-intro">
        <p className="example-eyebrow">
          The example collection / 40 websites · 10 sectors
        </p>
        <h1>
          Good design.
          <br />
          <em>A better next step.</em>
        </h1>
        <p>
          Four distinct directions for every sector. Beautifully considered
          websites with useful service content, thoughtful motion and a clear
          route to a conversation. Explore the details. Try the journeys.
          Imagine what yours could do.
        </p>
      </section>
      <nav className="example-sector-nav" aria-label="Browse by sector">
        {exampleSectors.map((sector) => (
          <a key={sector.theme} href={`#sector-${sector.theme}`}>
            {sector.title}
            <span>04</span>
          </a>
        ))}
      </nav>
      {exampleSectors.map((sector, sectorIndex) => (
        <section
          className="example-sector-collection"
          id={`sector-${sector.theme}`}
          key={sector.theme}
        >
          <div className="example-sector-heading">
            <p className="example-eyebrow">
              {String(sectorIndex + 1).padStart(2, "0")} / Four individual
              directions
            </p>
            <h2>{sector.title}</h2>
            <p>{sector.description}</p>
          </div>
          <div className="example-gallery-grid">
            {sectorExamples
              .filter((example) => example.theme === sector.theme)
              .map((example, index) => (
                <Link
                  href={`/examples/${example.slug}`}
                  key={example.slug}
                  className={`example-gallery-card example-${example.theme}`}
                >
                  <div>
                    <Image
                      src={example.image}
                      alt={`${example.name} illustrative brand imagery`}
                      fill
                      sizes="(max-width: 760px) 100vw, 50vw"
                      priority={sectorIndex === 0 && index < 2}
                    />
                    <span>
                      0{index + 1} / {example.approach}
                    </span>
                  </div>
                  <section>
                    <h3>{example.name}</h3>
                    <span aria-hidden="true">↗</span>
                    <p>{example.outcome}</p>
                    <small>{example.description}</small>
                  </section>
                </Link>
              ))}
          </div>
        </section>
      ))}
      <footer>
        <h2>
          Your business has its own story.
          <br />
          Let’s give it a better website.
        </h2>
        <a className="example-button" href="/contact">
          Discuss your website ↗
        </a>
        <p>
          These are fictional companies and illustrative content, not client
          projects or measured results.
        </p>
      </footer>
    </main>
  );
}
