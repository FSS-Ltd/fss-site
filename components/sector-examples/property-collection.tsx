"use client";

import Image from "next/image";
import { useState } from "react";

const homes = [
  {
    name: "The Walled Garden",
    location: "A village setting, Kent",
    beds: 4,
    price: "£825,000",
    type: "For sale",
    image: "/prospect-previews/bespoke/stagg-homes/hero-v1.png",
    note: "Period character · Garden room · Village life",
  },
  {
    name: "Orchard House",
    location: "On the edge of the countryside",
    beds: 3,
    price: "£625,000",
    type: "For sale",
    image: "/prospect-previews/bespoke/foundation-estate-agents/hero-v1.png",
    note: "Light-filled rooms · Open views · Space to grow",
  },
  {
    name: "The Courtyard",
    location: "A quieter corner of town",
    beds: 2,
    price: "£1,650 pcm",
    type: "To let",
    image: "/prospect-previews/bespoke/jenkinson-estates/hero-v1.png",
    note: "A private entrance · Easy mornings · Town connections",
  },
];

export function PropertyCollection() {
  const [filter, setFilter] = useState("All homes");
  const [bedrooms, setBedrooms] = useState("Any");
  const visible = homes.filter(
    (home) =>
      (filter === "All homes" || home.type === filter) &&
      (bedrooms === "Any" || home.beds >= Number(bedrooms)),
  );
  return (
    <div className="estate-collection">
      <div className="estate-filters">
        <div role="group" aria-label="Property availability">
          {["All homes", "For sale", "To let"].map((value) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <label>
          Bedrooms{" "}
          <select
            value={bedrooms}
            onChange={(event) => setBedrooms(event.target.value)}
          >
            <option>Any</option>
            <option value="3">3+</option>
            <option value="4">4+</option>
          </select>
        </label>
      </div>
      <p className="example-eyebrow" role="status">
        {visible.length} illustrative {visible.length === 1 ? "home" : "homes"}{" "}
        · Sample listings, not available properties
      </p>
      <div className="estate-homes">
        {visible.map((home) => (
          <article key={home.name}>
            <div className="estate-home-image">
              <Image
                src={home.image}
                alt={`Illustrative exterior for ${home.name}`}
                fill
                sizes="(max-width: 760px) 100vw, 33vw"
              />
              <span>{home.type}</span>
            </div>
            <div className="estate-home-meta">
              <span>{home.beds} bedrooms</span>
              <span>{home.price}</span>
            </div>
            <h3>{home.name}</h3>
            <p>{home.location}</p>
            <p className="estate-home-note">{home.note}</p>
            <a href="#enquire">Plan a viewing conversation ↗</a>
          </article>
        ))}
      </div>
      {visible.length === 0 && (
        <div className="estate-empty">
          <h3>A little more room to explore.</h3>
          <p>
            No sample homes match these filters. Try a different combination.
          </p>
          <button
            onClick={() => {
              setFilter("All homes");
              setBedrooms("Any");
            }}
          >
            Show all homes ↗
          </button>
        </div>
      )}
    </div>
  );
}
