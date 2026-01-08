import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CopilotKitProvider } from "@/components/CopilotKitProvider";
import { Navigation } from "@/components/Navigation";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Line Build MVP",
  description: "Line build authoring tool with chat and validation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <CopilotKitProvider>
          <Navigation />
          {children}
        </CopilotKitProvider>
      </body>
    </html>
  );
}
