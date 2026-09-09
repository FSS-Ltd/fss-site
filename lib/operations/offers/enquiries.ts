import { offerEnquirySchema } from "./types";

export function parseOfferEnquiry(input: unknown) {
  return offerEnquirySchema.parse(input);
}

export function enquiryCreatesCharge(): false {
  return false;
}
