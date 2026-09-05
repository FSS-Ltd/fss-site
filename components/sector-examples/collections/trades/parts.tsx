import { ExampleEnquiry } from "../../enquiry";
import { VariantServices, VariantProcess } from "../../variants/parts";

export const plumbingImage = "/prospect-previews/example-plumbing/hero-v1.png";
export const electricalImage =
  "/prospect-previews/bespoke/ete-electrical/hero-v1.png";

export function TradeDetails({
  theme,
  slug,
}: {
  theme: "plumbing" | "electrical";
  slug: string;
}) {
  return (
    <>
      <VariantServices
        theme={theme}
        slug={slug}
        title={
          theme === "plumbing"
            ? "For the everyday. And the unexpected."
            : "The work behind a better space."
        }
      />
      <VariantProcess
        title="A good result starts with a clear brief."
        steps={[
          [
            "Tell us what you’ve noticed",
            "Describe the problem or project, your property and what you want to achieve.",
          ],
          [
            "Understand the proposed work",
            "Review the assessment, scope and initial costs before agreeing to proceed.",
          ],
          [
            "Know what happens next",
            "Confirm access, timing and how the completed work will be explained.",
          ],
        ]}
      />
      <ExampleEnquiry theme={theme} />
    </>
  );
}
export function TradeLink({
  children = "Plan a visit",
}: {
  children?: React.ReactNode;
}) {
  return (
    <a className="trade-action" href="#enquire">
      {children}
      <span aria-hidden="true">↗</span>
    </a>
  );
}
