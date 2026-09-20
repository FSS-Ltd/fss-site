# FSS Studio Experience

**Client portal and founder operations · Specification and Figma wireframes · 15 September 2026**

Status: proposed product and design specification, grounded in the local FSS-Ltd/fss-site checkout at commit `65a49852`. Application changes and production verification are a separate implementation stage.

- [Product and delivery specification](./01-product-and-delivery-spec.md)
- [Workflow contracts](./02-workflow-contracts.md)
- [Screen-by-screen acceptance criteria](./03-screen-contracts.md)
- [Design system and interaction rules](./04-design-system.md)
- [Browse all 88 wireframes](./wireframes.html)
- [Handoff, validation and Figma status](./05-handoff-and-validation.md)
- [Figma foundations and five initial screens](https://www.figma.com/design/mfccE8T0vYDxTIpQUGBkFV)

Screen IDs match the local SVG atlas and the five initial named Figma frames. Figma's Starter MCP limit blocked the remaining upload. The complete local pack contains 88 editable SVG references, 88 rendered previews and exact screen contracts. Example organisations, people, dates and money shown in the wireframes are synthetic design content.

## Read this first

The redesign completes real journeys: request → triage → delivery → client review → completion; client record → engagement → agreement → signature; and welcome setup → approval → activation → monitoring → recovery. A polished shell without those end-to-end behaviours does not meet the specification.

Keep the existing domain services and security boundaries. Build the new experience over them and close the specific gaps documented here. Do not replace working billing, signing, authentication or scheduling foundations just to match the wireframes.
