export type QuoteRequestInput = {
  problem: string;
  postcode: string;
  urgency: string;
  name: string;
  phone: string;
};

export function normalizeVehicleRegistration(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

export function isQuoteRequestReady(input: QuoteRequestInput): boolean {
  return [
    input.problem,
    input.postcode,
    input.urgency,
    input.name,
    input.phone,
  ].every((value) => value.trim().length > 0);
}
