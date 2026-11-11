import type { ResourceMeta } from "@/lib/types/resource";

import { buttonVariants } from "@/components/ui/button";
import { GlowCard } from "@/components/ui/spotlight-card";
import { cn } from "@/lib/utils/cn";
import { getDeliveryAction, getDeliveryHeadline, getDeliveryNextStep } from "@/lib/resource-delivery";

type ResourceDeliveryPanelProps = {
  resource: ResourceMeta;
};

export function ResourceDeliveryPanel({ resource }: ResourceDeliveryPanelProps) {
  const action = getDeliveryAction(resource);
  const headline = getDeliveryHeadline(resource.delivery);
  const nextStep = getDeliveryNextStep(resource);

  return (
    <GlowCard customSize className="mt-6 p-5 text-left">
      <h2 className="text-2xl font-semibold text-foreground">{headline}</h2>
      <p className="mt-2 text-sm text-text-muted">{nextStep}</p>
      {resource.delivery.notes ? <p className="mt-2 text-sm text-text-subtle">{resource.delivery.notes}</p> : null}
      {resource.delivery.accessInstructions ? (
        <p className="mt-2 text-sm text-text-subtle">{resource.delivery.accessInstructions}</p>
      ) : null}
      {action ? (
        <div className="mt-5">
          <a
            href={action.href}
            target={action.external ? "_blank" : undefined}
            rel={action.external ? "noreferrer" : undefined}
            download={action.download}
            className={cn(buttonVariants({ variant: "primary", size: "lg" }), "w-full sm:w-auto")}
          >
            {action.label}
          </a>
        </div>
      ) : null}
    </GlowCard>
  );
}
