import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";

import { APP_NAME } from "@wordcast/shared";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: `${APP_NAME} — Admin`,
  description: "Word-of-the-Day video pipeline admin dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen bg-background text-foreground antialiased">
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
