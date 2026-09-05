import { CollectionEnd, TableArt } from "./parts";
export function SundayTableExample() {
  return (
    <div className="hl-site hl-sunday">
      <section className="hl-sunday-hero">
        <p className="hl-kicker">A neighbourhood cafe. An open invitation.</p>
        <h1>
          A little
          <br />
          <em>more Sunday.</em>
        </h1>
        <div className="hl-sunday-stamp">
          GOOD
          <br />
          COMPANY
          <br />
          <span>ALWAYS IN SEASON</span>
        </div>
        <div className="hl-sunday-caption">
          <p>
            For the coffee that becomes a conversation.
            <br />
            And the people you never run out of things to say to.
          </p>
          <a href="#enquire" className="hl-button">
            Come together ↗
          </a>
        </div>
        <TableArt label="Pull up a chair" />
      </section>
      <section className="hl-sunday-letter" data-reveal>
        <span className="hl-kicker">A note from the table</span>
        <h2>
          Not every day is a Sunday.
          <br />
          <em>It can still feel like one.</em>
        </h2>
        <div>
          <p>
            A slow start. Something seasonal. Another cup. This is a place for
            making a little space in the middle of a busy week.
          </p>
          <p>
            And when the occasion needs more chairs, there is a conversation to
            be had about making the place yours.
          </p>
        </div>
      </section>
      <CollectionEnd theme="hospitality" slug="sunday-table" />
    </div>
  );
}
