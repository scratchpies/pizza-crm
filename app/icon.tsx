import { ImageResponse } from "next/og";

// Browser tab favicon.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 22,
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
