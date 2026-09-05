import { ImageResponse } from "next/og";

export function renderSocialImage(title: string): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        background: "#07182e",
        color: "#ffffff",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ color: "#46c7d8", fontSize: 44, fontWeight: 700 }}>
          FSS
        </div>
        <div style={{ fontSize: 24 }}>Faithful Software Solutions</div>
      </div>
      <div
        style={{
          fontSize: title.length > 90 ? 48 : 60,
          lineHeight: 1.15,
          fontWeight: 700,
          letterSpacing: "-1.5px",
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "flex",
          borderTop: "2px solid #14989e",
          paddingTop: 24,
          fontSize: 24,
          color: "#b7c4d3",
        }}
      >
        Custom software. Built faithfully, in the UK.
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
