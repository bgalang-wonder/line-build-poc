import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Line Build Viewer",
  description: "DAG visualization for line builds",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-neutral-50 text-neutral-900">{children}</body>
    </html>
  );
}
