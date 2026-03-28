import type { ResourceDelivery, ResourceMeta } from "@/lib/types/resource";

export type DeliveryAction = {
  href: string;
  label: string;
  external: boolean;
  download?: string;
};

export function getDeliveryAction(resource: ResourceMeta): DeliveryAction | null {
  const delivery = resource.delivery;

  if (delivery.type === "email_later") {
    return null;
  }

  const href = delivery.url ?? "";
  const fallbackLabel =
    delivery.type === "direct_download" ? `Download ${resource.format}` : `Open ${resource.format}`;

  return {
    href,
    label: delivery.label ?? fallbackLabel,
    external: delivery.type === "external_link",
    download: delivery.type === "direct_download" ? delivery.fileName : undefined,
  };
}

export function getDeliveryHeadline(delivery: ResourceDelivery): string {
  if (delivery.type === "direct_download") {
    return "Your resource is ready now";
  }

  if (delivery.type === "email_later") {
    return "Delivery is on the way";
  }

  return "Access your resource";
}

export function getDeliveryNextStep(resource: ResourceMeta): string {
  const delivery = resource.delivery;

  if (delivery.type === "email_later") {
    return `Next step: our team will send this ${resource.format.toLowerCase()} to your inbox shortly.`;
  }

  if (delivery.type === "direct_download") {
    return `Next step: use the button below to download your ${resource.format.toLowerCase()} immediately.`;
  }

  return `Next step: use the button below to open your ${resource.format.toLowerCase()}.`;
}

export function getDeliveryPromise(resource: ResourceMeta): string {
  const delivery = resource.delivery;

  if (delivery.type === "direct_download") {
    return "Submit once to unlock immediate download access.";
  }

  if (delivery.type === "email_later") {
    return "Submit once and we will deliver this resource by email.";
  }

  return "Submit once to access the resource.";
}
