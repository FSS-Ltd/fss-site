/** Convert a decimal GBP form value to the register's integer-pence contract. */
export function gbpToPence(value: string): string {
  const amount = value.trim();
  if (!/^\d{1,16}(?:\.\d{1,2})?$/.test(amount)) {
    throw new Error(
      "Use a nonnegative GBP amount with up to two decimal places.",
    );
  }
  const [pounds, fraction = ""] = amount.split(".");
  return (
    BigInt(pounds) * BigInt(100) +
    BigInt(fraction.padEnd(2, "0"))
  ).toString();
}

/** Format pence for an editable GBP control without converting through Number. */
export function penceToGbp(value: string): string {
  if (!/^(0|[1-9]\d{0,29})$/.test(value)) {
    throw new Error("Use nonnegative whole pence within the supported range.");
  }
  const pence = BigInt(value);
  return `${pence / BigInt(100)}.${(pence % BigInt(100)).toString().padStart(2, "0")}`;
}
