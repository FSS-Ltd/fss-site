import { ExampleEnquiry } from "../../enquiry";
import { VariantProcess, VariantServices } from "../../variants/parts";

export const gardenImage = "/prospect-previews/bespoke/hill-wood/hero-v1.png";
export const diningImage = "/sector-examples/restaurant-interior.png";

export function CollectionEnd({
  theme,
  slug,
}: {
  theme: "hospitality" | "landscape";
  slug: string;
}) {
  const hospitality = theme === "hospitality";
  return (
    <>
      <VariantServices
        theme={theme}
        slug={slug}
        title={
          hospitality
            ? "A little planning. A lovely occasion."
            : "From the first idea to the last planting detail."
        }
      />
      <VariantProcess
        title={
          hospitality
            ? "Good things happen around a table."
            : "A thoughtful process. A place of your own."
        }
        steps={
          hospitality
            ? [
                [
                  "Tell us the occasion",
                  "A quiet lunch, a celebration or a room full of friends. Start with what you have in mind.",
                ],
                [
                  "Make it yours",
                  "Discuss menus, numbers, access and the details that matter to your guests.",
                ],
                [
                  "Know what comes next",
                  "Review availability and booking terms with the venue before confirming.",
                ],
              ]
            : [
                [
                  "Listen to the place",
                  "Understand the site, the way you live and the possibilities you see.",
                ],
                [
                  "Find the form",
                  "Explore a design direction, a realistic scope and a planting character.",
                ],
                [
                  "Give it room to grow",
                  "Agree the next design stage and the support needed to bring it to life.",
                ],
              ]
        }
      />
      <ExampleEnquiry theme={theme} />
    </>
  );
}
export function TableArt({ label = "A place for you" }: { label?: string }) {
  return (
    <div
      className="hl-table-art"
      role="img"
      aria-label="Illustrative overhead table setting with a ceramic plate, folded napkin and glass"
    >
      <div className="hl-napkin" />
      <div className="hl-plate">
        <span>{label}</span>
      </div>
      <div className="hl-glass" />
      <span className="hl-cutlery" />
      <span className="hl-art-note">THE ART OF COMING TOGETHER</span>
    </div>
  );
}
