import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Scratch Pies CRM",
  description: "Customer relationship management for Scratch Pies",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Scratch Pies",
  },
  icons: {
    // Static files (not the dynamic /apple-icon route) -- iOS Safari's
    // "Add to Home Screen" is unreliable about picking up icons served from
    // a dynamic route with a cache-busting query string.
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#7a3e1d",
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
