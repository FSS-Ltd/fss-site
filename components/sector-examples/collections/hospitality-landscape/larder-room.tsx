import { VariantImage } from "../../variants/parts";
import Link from "next/link";
import { CollectionEnd, diningImage } from "./parts";
export function LarderRoomExample() {
  return (
    <div className="hl-site hl-larder">
      <section className="hl-larder-hero">
        <div>
          <p className="hl-kicker">The Larder Room / Kent</p>
          <h1>
            Good food.
            <br />
            The right place.
            <br />
            <em>Your kind of day.</em>
          </h1>
          <p>
            A restaurant, a cafe and a place to gather. Find the details you
            need, then make yourself at home.
          </p>
          <a className="hl-button" href="#enquire">
            Plan a visit ↗
          </a>
        </div>
        <VariantImage
          priority
          src={diningImage}
          alt="Illustrative dining room with a welcoming shared table and seasonal food"
        />
      </section>
      <nav className="hl-larder-index" aria-label="Plan your visit">
        <a href="#services">01 &nbsp; Dining & menus ↗</a>
        <a href="#visit-notes">02 &nbsp; Before you visit ↗</a>
        <a href="#enquire">03 &nbsp; Tables & occasions ↗</a>
      </nav>
      <section className="hl-visit" id="visit-notes">
        <div>
          <p className="hl-kicker">A good visit starts here</p>
          <h2>
            Less guessing.
            <br />
            <em>More enjoying.</em>
          </h2>
        </div>
        <div className="hl-visit-answers">
          {[
            [
              "Coming with a group?",
              "Start with your guest count and preferred date. Larger groups may need a set menu or a separate dining space.",
            ],
            [
              "Dietary or access needs?",
              "Discuss your requirements with the venue before booking. Menus and room arrangements can change.",
            ],
            [
              "Planning something private?",
              "Ask about the room, menus, timings and what is included in any minimum spend.",
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
          <Link href="/examples/larder-room/restaurant-and-table-bookings">
            Read the table booking guide ↗
          </Link>
        </div>
      </section>
      <CollectionEnd theme="hospitality" slug="larder-room" />
    </div>
  );
}
