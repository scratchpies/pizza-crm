import type { MetadataRoute } from "next";

// Powers "Add to Home Screen" on Android/Chrome. Next.js auto-links this at
// /manifest.webmanifest -- no manual <link> tag needed.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Scratch Pies CRM",
    short_name: "Scratch Pies",
    description: "Customer relationship management for Scratch Pies",
    start_url: "/",
    display: "standalone",
    background_color: "#faf9f7",
    theme_color: "#7a3e1d",
    icons: [
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
      { src: "/pwa-icon", sizes: "512x512", type: "image/png" },
    ],
  };
}
