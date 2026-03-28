import "server-only";

import type { LeadCapturePayload } from "@/lib/forms/lead-capture";

type HubSpotConfig = {
  accessToken: string;
  challengeProperty?: string;
  sourceContextProperty?: string;
  sourcePathProperty?: string;
  resourceSlugProperty?: string;
};

type HubSpotContactResult = {
  contactId: string;
};

type HubSpotUpsertResponse = {
  results?: Array<{ id?: string }>;
};

type HubSpotErrorResponse = {
  errors?: Array<{ code?: string }>;
};

function getHubSpotHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

function buildHubSpotProperties(payload: LeadCapturePayload, config: HubSpotConfig): Record<string, string> {
  const properties: Record<string, string> = {
    email: payload.workEmail,
    firstname: payload.firstName,
    lastname: payload.lastName,
    company: payload.company,
  };

  if (config.challengeProperty) {
    properties[config.challengeProperty] = payload.challenge ?? "";
  }

  if (config.sourceContextProperty) {
    properties[config.sourceContextProperty] = payload.sourceContext;
  }

  if (config.sourcePathProperty) {
    properties[config.sourcePathProperty] = payload.sourcePath;
  }

  if (config.resourceSlugProperty) {
    properties[config.resourceSlugProperty] = payload.resourceSlug ?? "";
  }

  return properties;
}

export async function upsertLeadInHubSpot(
  payload: LeadCapturePayload,
  config: HubSpotConfig,
): Promise<HubSpotContactResult> {
  const fullProperties = buildHubSpotProperties(payload, config);

  const response = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert", {
    method: "POST",
    headers: getHubSpotHeaders(config.accessToken),
    body: JSON.stringify({
      inputs: [
        {
          idProperty: "email",
          id: payload.workEmail,
          properties: fullProperties,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let parsedError: HubSpotErrorResponse = {};

    try {
      parsedError = JSON.parse(errorBody) as HubSpotErrorResponse;
    } catch {
      parsedError = {};
    }

    const hasMissingPropertyError = parsedError.errors?.some(
      (error) => error.code === "PROPERTY_DOESNT_EXIST",
    );

    if (hasMissingPropertyError) {
      // Fallback to core HubSpot properties so lead capture still succeeds without custom fields.
      const fallbackResponse = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert", {
        method: "POST",
        headers: getHubSpotHeaders(config.accessToken),
        body: JSON.stringify({
          inputs: [
            {
              idProperty: "email",
              id: payload.workEmail,
              properties: {
                email: payload.workEmail,
                firstname: payload.firstName,
                lastname: payload.lastName,
                company: payload.company,
              },
            },
          ],
        }),
      });

      if (!fallbackResponse.ok) {
        const fallbackErrorBody = await fallbackResponse.text();
        throw new Error(
          `HubSpot fallback upsert failed (${fallbackResponse.status}): ${fallbackErrorBody}`,
        );
      }

      const fallbackData = (await fallbackResponse.json()) as HubSpotUpsertResponse;
      const fallbackContactId = fallbackData.results?.[0]?.id;

      if (!fallbackContactId) {
        throw new Error("HubSpot fallback upsert succeeded but no contact id was returned.");
      }

      return { contactId: fallbackContactId };
    }

    throw new Error(`HubSpot upsert failed (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as HubSpotUpsertResponse;
  const contactId = data.results?.[0]?.id;

  if (!contactId) {
    throw new Error("HubSpot upsert succeeded but no contact id was returned.");
  }

  return { contactId };
}
