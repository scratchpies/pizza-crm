import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Scratch Pies CRM",
  description: "Customer relationship management for Scratch Pies",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="max-w-6xl mx-auto px-4 py-6 pb-20 md:pb-6">{children}</main>
      </body>
    </html>
  );
}
