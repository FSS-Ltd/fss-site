import assert from "node:assert/strict";
import test from "node:test";
import {
  exampleSectors,
  examplesForSector,
  findSectorExample,
  sectorExamples,
  type ExampleTheme,
} from "./catalog";

test("ten sectors each offer four distinct approaches", () => {
  assert.equal(exampleSectors.length, 10);
  assert.equal(new Set(sectorExamples.map(({ slug }) => slug)).size, 40);
  for (const { theme } of exampleSectors) {
    const examples = sectorExamples.filter(
      (example) => example.theme === theme,
    );
    assert.equal(examples.length, 4, theme);
    assert.deepEqual(examples.map((example) => example.approach).sort(), [
      "Booking first",
      "Cinematic experience",
      "Editorial brand",
      "Search & authority",
    ]);
    for (const example of examples)
      assert.equal(findSectorExample(example.slug), example);
  }
  assert.equal(findSectorExample("not-a-real-example"), undefined);
});
const labels: readonly [string, ExampleTheme][] = [
  ["Roofing", "roof"],
  ["Estate & letting agency", "estate"],
  ["Accountancy", "accounts"],
  ["Automotive workshop", "auto"],
  ["Plumbing, heating & drainage", "plumbing"],
  ["Electrical contractors", "electrical"],
  ["Hospitality & restaurants", "hospitality"],
  ["Landscape design", "landscape"],
  ["Office supplies", "supplies"],
  ["Garage equipment", "equipment"],
];
for (const [label, theme] of labels)
  test(`${label} resolves to all four ${theme} examples`, () => {
    const examples = examplesForSector(label);
    assert.equal(examples.length, 4);
    assert.ok(examples.every((example) => example.theme === theme));
  });
const aliases: readonly [string, ExampleTheme][] = [
  ["Hill & Wood Co.", "landscape"],
  ["Hill Wood", "landscape"],
  ["Paperstone", "supplies"],
  ["Kent Garage Equipment", "equipment"],
  ["Hardy Drainage", "plumbing"],
  ["Jaguar Plumbing", "plumbing"],
  ["Paragas", "plumbing"],
  ["Plumbing Angels", "plumbing"],
  ["ETE Electrical", "electrical"],
  ["TH Electrical", "electrical"],
];
for (const [name, theme] of aliases)
  test(`${name} resolves an ambiguous research sector`, () => {
    const examples = examplesForSector("General services", name);
    assert.equal(examples.length, 4);
    assert.ok(examples.every((example) => example.theme === theme));
  });
test("sector matching tolerates casing and separators without guessing unsupported sectors", () => {
  assert.equal(examplesForSector("OFFICE_SUPPLIES").length, 4);
  assert.equal(examplesForSector("garage-equipment")[0]?.theme, "equipment");
  assert.deepEqual(examplesForSector("unrecognised industry"), []);
  assert.deepEqual(examplesForSector(""), []);
  assert.equal(
    examplesForSector("Automotive", "Kent Garage Equipment Ltd")[0]?.theme,
    "equipment",
  );
});
