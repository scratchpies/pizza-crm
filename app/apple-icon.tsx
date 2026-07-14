import { ImageResponse } from "next/og";

// The icon iOS uses when you "Add to Home Screen." Full-bleed, no
// transparency/rounding -- iOS applies its own corner mask.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 112,
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
    { ...size, emoji: "twemoji" }
  );
}
