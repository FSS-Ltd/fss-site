import localFont from "next/font/local";

export const portalFont = localFont({
  src: [
    { path: "./fonts/Geist-Variable.woff2", weight: "400" },
    { path: "./fonts/Geist-Variable.woff2", weight: "500" },
    { path: "./fonts/Geist-Variable.woff2", weight: "600" },
    { path: "./fonts/Geist-Variable.woff2", weight: "700" },
  ],
  display: "swap",
  variable: "--font-portal-geist",
});
