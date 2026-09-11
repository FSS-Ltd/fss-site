import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";

import "./globals.css";

export const metadata: Metadata = {
  icons: {
    icon: "/icon.PNG",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB" className="h-full">
      <body className="min-h-full overflow-x-hidden bg-background font-sans text-foreground antialiased">
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}
