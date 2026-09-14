import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClinicRAG",
  description: "Ask questions about your practice's clinical documents",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU">
      <body>{children}</body>
    </html>
  );
}
