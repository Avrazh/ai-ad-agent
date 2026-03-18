"use client";

// Live preview of a star_review card, scaled proportionally to the canvas container.
// Mirrors the HTML structure from lib/templates/starReview.tsx so the live
// preview matches the server-rendered PNG exactly.

interface Props {
  quote: string;
  attribution: string;
  containerW: number;
}

export function StarCardPreview({ quote, attribution, containerW }: Props) {
  // Reference canvas is 1080px wide; scale all absolute pixel values accordingly.
  const s = containerW / 1080;

  const nameMatch = attribution.match(/^—\s*([^,]+)/);
  const fullName = nameMatch ? nameMatch[1].trim() : "";
  const firstName = fullName.split(/\s+/)[0] ?? "";
  const avatarLetter = firstName.charAt(0).toUpperCase() || "V";
  const roleLabel = attribution.includes(",")
    ? attribution.split(",").slice(1).join(",").trim()
    : "Verified customer";

  const r = (n: number) => Math.round(n * s);

  return (
    <div style={{
      background: "#FFFFFF",
      borderRadius: r(24),
      padding: `${r(28)}px ${r(32)}px ${r(24)}px`,
      display: "flex",
      flexDirection: "column",
      gap: 0,
      boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
    }}>
      {/* Stars */}
      <div style={{
        fontSize: r(50),
        color: "#FBD04A",
        letterSpacing: r(4),
        lineHeight: 1,
        marginBottom: r(16),
      }}>
        ★★★★★
      </div>

      {/* Quote text */}
      <p style={{
        fontFamily: "Inter, sans-serif",
        fontSize: Math.max(10, r(28)),
        fontWeight: 400,
        color: "#1a1a1a",
        lineHeight: 1.45,
        margin: 0,
        wordBreak: "normal" as const,
        overflowWrap: "normal" as const,
      }}>
        {quote}
      </p>

      {/* Divider */}
      <div style={{
        height: 1,
        background: "#E8E8E8",
        margin: `${r(18)}px 0 ${r(16)}px`,
        flexShrink: 0,
      }} />

      {/* Attribution row */}
      <div style={{ display: "flex", alignItems: "center", gap: r(12), flexShrink: 0 }}>
        <div style={{
          width: r(52), height: r(52),
          borderRadius: "50%",
          background: "#4CAF50",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: "Inter, sans-serif",
            fontSize: r(26),
            fontWeight: 700,
            color: "#FFFFFF",
          }}>
            {avatarLetter}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: r(2) }}>
          <span style={{
            fontFamily: "Inter, sans-serif",
            fontSize: Math.max(8, r(28)),
            fontWeight: 700,
            color: "#1a1a1a",
            lineHeight: 1.2,
          }}>
            {fullName || "Verified Customer"}
          </span>
          <span style={{
            fontFamily: "Inter, sans-serif",
            fontSize: Math.max(8, r(28)),
            fontWeight: 400,
            color: "#888888",
            lineHeight: 1.2,
          }}>
            {roleLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
