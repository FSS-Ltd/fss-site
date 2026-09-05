import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function luminance(hex: string): number {
  const channels = hex
    .match(/[a-f\d]{2}/gi)!
    .map((part) => parseInt(part, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

test("cookie acceptance text meets WCAG AA contrast in normal and hover states", () => {
  const css = readFileSync(
    new URL("./cookie-consent.module.css", import.meta.url),
    "utf8",
  );
  for (const selector of [".primaryButton", ".primaryButton:hover"]) {
    const declaration = css.slice(css.indexOf(`${selector} {`)).split("}")[0];
    const foreground = declaration.match(/\n\s+color: (#\w{6})/)![1];
    const background = declaration.match(/\n\s+background: (#\w{6})/)![1];
    const values = [luminance(foreground), luminance(background)].sort(
      (a, b) => b - a,
    );
    assert.ok(
      (values[0] + 0.05) / (values[1] + 0.05) >= 4.5,
      `${selector} contrast must be at least 4.5:1`,
    );
  }
});
