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
          background: "#FBF7F0",
          border: "1px solid #E4DACB",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: "#2B4EFF" }} />
          <div style={{ display: "flex", fontSize: 34, fontWeight: 600, color: "#141210" }}>
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
              color: "#141210",
              maxWidth: 900,
            }}
          >
            Know exactly what to study next.
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#4A423A", maxWidth: 860 }}>
            Syllabus-shaped study notes, lessons and practice tests.
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 24, color: "#6B6257" }}>
          Study material · Lessons · Practice tests
        </div>
      </div>
    ),
    size,
  );
}
