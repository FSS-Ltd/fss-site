import type Stripe from "stripe";
import type { AgreementLine } from "../agreements/types";
import { totalLinePence } from "../agreements/validation";
import type { BillingSchedule } from "./domain-types";
import { stripeAmount } from "./stripe-obligation";
export type FutureAmendmentPreview = {
  invoice: Stripe.Invoice;
  change: {
    kind: "future_schedule";
    prorationPence: string;
    current: {
      startDate: string;
      amountPence: string;
      interval: string;
      intervalCount: number;
    };
    proposed: {
      startDate: string;
      endDate: string | null;
      amountPence: string;
      recurrenceMonths: AgreementLine["recurrenceMonths"];
    };
    firstPeriodTotalPence: string;
  };
};
export async function previewFutureAmendment(
  stripe: Stripe,
  provider: Stripe.SubscriptionSchedule,
  schedule: BillingSchedule,
  customerId: string,
  line: AgreementLine,
  effectiveAt: string,
): Promise<FutureAmendmentPreview> {
  if (
    provider.customer !== customerId ||
    provider.livemode !== (schedule.mode === "live") ||
    provider.metadata?.operations_schedule !== schedule.id
  )
    throw new Error("Provider schedule context mismatch.");
  if (
    provider.status !== "not_started" ||
    provider.phases.length !== 1 ||
    provider.phases[0].items.length !== 1
  )
    throw new Error(
      "Only a single future schedule phase supports this amendment preview.",
    );
  const phase = provider.phases[0];
  const item = phase.items[0];
  const price =
    typeof item.price === "string"
      ? await stripe.prices.retrieve(item.price)
      : item.price;
  if (
    price.deleted ||
    price.currency !== "gbp" ||
    price.unit_amount === null ||
    !price.recurring ||
    item.quantity !== 1
  )
    throw new Error("A fixed GBP recurring schedule price is required.");
  const start = Date.parse(`${line.startDate}T00:00:00Z`) / 1000;
  if (
    start <= Date.parse(effectiveAt) / 1000 ||
    phase.start_date <= Date.parse(effectiveAt) / 1000
  )
    throw new Error(
      "Schedule amendment must precede both service start dates.",
    );
  const product =
    typeof price.product === "string" ? price.product : price.product.id;
  const amount = stripeAmount(totalLinePence(line));
  const invoice = await stripe.invoices.createPreview({
    schedule: provider.id,
    schedule_details: {
      end_behavior: line.endDate ? "cancel" : "release",
      phases: [
        {
          start_date: start,
          ...(line.endDate
            ? { end_date: Date.parse(`${line.endDate}T00:00:00Z`) / 1000 }
            : {
                duration: {
                  interval: "month",
                  interval_count: line.recurrenceMonths,
                },
              }),
          proration_behavior: "none",
          automatic_tax: { enabled: false },
          items: [
            {
              quantity: 1,
              price_data: {
                product,
                currency: "gbp",
                unit_amount: amount,
                tax_behavior: "inclusive",
                recurring: {
                  interval: "month",
                  interval_count: line.recurrenceMonths,
                },
              },
            },
          ],
        },
      ],
    },
  });
  if (invoice.total !== amount)
    throw new Error(
      "Schedule preview total differs from the signed first period.",
    );
  return {
    invoice,
    change: {
      kind: "future_schedule" as const,
      prorationPence: "0",
      current: {
        startDate: new Date(phase.start_date * 1000).toISOString().slice(0, 10),
        amountPence: String(price.unit_amount),
        interval: price.recurring.interval,
        intervalCount: price.recurring.interval_count,
      },
      proposed: {
        startDate: line.startDate,
        endDate: line.endDate,
        amountPence: String(amount),
        recurrenceMonths: line.recurrenceMonths,
      },
      firstPeriodTotalPence: String(invoice.total),
    },
  };
}
