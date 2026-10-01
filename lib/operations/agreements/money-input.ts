import { decimalToMinor, minorToDecimal } from "../money";

/** Legacy GBP adapter retained for existing callers. New code uses minor units. */
export function gbpToPence(value: string): string {
  try {
    return decimalToMinor(value);
  } catch {
    throw new Error(
      "Use a nonnegative GBP amount with up to two decimal places.",
    );
  }
}

/** Format pence for an editable GBP control without converting through Number. */
export function penceToGbp(value: string): string {
  try {
    return minorToDecimal(value);
  } catch {
    throw new Error("Use nonnegative whole pence within the supported range.");
  }
}
