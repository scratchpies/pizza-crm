import { ImageResponse } from "next/og";

// Larger icon (512x512) referenced from the web manifest for Android's
// "Add to Home Screen" -- Chrome expects at least a 192x192/512x512 icon
// before it'll treat the site as installable rather than falling back to
// a screenshot thumbnail.
export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 320,
          background: "#7a3e1d",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        🍕
      </div>
    ),
    { width: 512, height: 512, emoji: "twemoji" }
  );
}
