import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { ClerkProvider, ClerkLoaded } from "@clerk/nextjs";

const outfit = Outfit({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "pixelthread | next-gen infra",
  description: "Payments and Auth built for performance.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={outfit.className}>
        <ClerkProvider>
          <ClerkLoaded>{children}</ClerkLoaded>
        </ClerkProvider>
      </body>
    </html>
  );
}
