import { ImageResponse } from "next/og";

/**
 * Social card (`SEO_AND_CONTENT_STRATEGY.md` §3.2: a generated 1200×630 OG image on every
 * indexable page). Inherited by every route from the root segment, so no page needs its own
 * unless it deserves a bespoke card.
 */
export const alt = "Exampify — study notes, lessons and practice questions";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "72px",
          // Satori cannot read CSS custom properties, so these mirror §3.1 by hand.
          background: "#F5F5F7",
          border: "1px solid #E3E3E8",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "#0066CC" }} />
          <div style={{ display: "flex", fontSize: 34, fontWeight: 600, color: "#1D1D1F" }}>
            Exampify
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              display: "flex",
              fontSize: 68,
              lineHeight: 1.1,
              fontWeight: 600,
              color: "#1D1D1F",
              maxWidth: 900,
            }}
          >
            Know exactly what to study next.
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#4A4A52", maxWidth: 860 }}>
            Syllabus-shaped study notes, lessons and practice tests.
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 24, color: "#6E6E73" }}>
          Study material · Lessons · Practice tests
        </div>
      </div>
    ),
    size,
  );
}
