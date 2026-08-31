"use client";

import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";

type PropertyRouteId = "selling" | "letting" | "buying" | "renting";

type PropertyRoute = {
  actionLabel: string;
  detail: string;
  id: PropertyRouteId;
  label: string;
  shortLabel: string;
};

const propertyRoutes: readonly PropertyRoute[] = [
  {
    id: "selling",
    label: "Selling",
    shortLabel: "Sell",
    detail:
      "Start with a local conversation about your home, timing and a valuation.",
    actionLabel: "Plan a selling conversation",
  },
  {
    id: "letting",
    label: "Letting a property",
    shortLabel: "Let",
    detail:
      "Choose the landlord support that fits your property, then share the area and timing when you are ready.",
    actionLabel: "Compare landlord services",
  },
  {
    id: "buying",
    label: "Buying",
    shortLabel: "Buy",
    detail:
      "Focus the next conversation on the area, kind of home and move that you have in mind.",
    actionLabel: "Plan a buying conversation",
  },
  {
    id: "renting",
    label: "Renting",
    shortLabel: "Rent",
    detail:
      "Begin with the area and timing that matter to you, ready for a more useful property conversation.",
    actionLabel: "Plan a renting conversation",
  },
];

function getNextRouteIndex(
  key: KeyboardEvent<HTMLButtonElement>["key"],
  currentIndex: number,
): number | null {
  if (key === "ArrowDown" || key === "ArrowRight") {
    return (currentIndex + 1) % propertyRoutes.length;
  }

  if (key === "ArrowUp" || key === "ArrowLeft") {
    return (currentIndex - 1 + propertyRoutes.length) % propertyRoutes.length;
  }

  if (key === "Home") return 0;
  if (key === "End") return propertyRoutes.length - 1;

  return null;
}

export function DoorknobsPropertyNavigator() {
  const [selectedRouteId, setSelectedRouteId] =
    useState<PropertyRouteId>("letting");
  const routeButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedRoute = propertyRoutes.find(
    (route) => route.id === selectedRouteId,
  );

  if (!selectedRoute) return null;

  function selectRoute(route: PropertyRoute, shouldFocus = false) {
    setSelectedRouteId(route.id);
    if (shouldFocus) {
      routeButtons.current[propertyRoutes.indexOf(route)]?.focus();
    }
  }

  function handleRouteKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    route: PropertyRoute,
  ) {
    const nextIndex = getNextRouteIndex(
      event.key,
      propertyRoutes.indexOf(route),
    );
    if (nextIndex === null) return;

    event.preventDefault();
    selectRoute(propertyRoutes[nextIndex], true);
  }

  return (
    <section
      aria-labelledby="property-journey-title"
      className="doorknobsJourneySection"
      id="property-journey"
    >
      <div className="doorknobsSectionInner">
        <div className="doorknobsSectionIntro">
          <p className="doorknobsEyebrow">Choose your property journey</p>
          <h2 id="property-journey-title">
            One local conversation, shaped around your next move.
          </h2>
          <p>
            Start in the right place. Your choice changes the detail below, so
            the next action stays clear without taking you away from this page.
          </p>
        </div>

        <div
          className="doorknobsNavigator"
          data-selected-route={selectedRoute.id}
        >
          <div
            aria-label="Your property journey"
            className="doorknobsRouteList"
            role="radiogroup"
          >
            {propertyRoutes.map((route, index) => {
              const isSelected = route.id === selectedRoute.id;

              return (
                <button
                  aria-checked={isSelected}
                  aria-controls="doorknobs-route-detail"
                  className="doorknobsRouteOption"
                  data-active={isSelected}
                  key={route.id}
                  onClick={() => selectRoute(route)}
                  onKeyDown={(event) => handleRouteKeyDown(event, route)}
                  ref={(element) => {
                    routeButtons.current[index] = element;
                  }}
                  role="radio"
                  tabIndex={isSelected ? 0 : -1}
                  type="button"
                >
                  <span className="doorknobsRouteNumber" aria-hidden="true">
                    0{index + 1}
                  </span>
                  <span>
                    <strong>{route.label}</strong>
                    <small>{route.shortLabel}</small>
                  </span>
                </button>
              );
            })}
          </div>

          <div
            aria-live="polite"
            className="doorknobsRouteDetail"
            id="doorknobs-route-detail"
            key={selectedRoute.id}
          >
            <p className="doorknobsEyebrow">Your selected route</p>
            <h3>{selectedRoute.label}</h3>
            <p>{selectedRoute.detail}</p>
            <a href="#property-enquiry">
              {selectedRoute.actionLabel}
              <span aria-hidden="true"> →</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
