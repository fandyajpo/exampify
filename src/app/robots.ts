import type { MetadataRoute } from "next";

import { publicEnv } from "@/lib/env";

/**
 * robots.txt (`SEO_AND_CONTENT_STRATEGY.md` §3.5): content paths allowed, the studio,
 * account, practice surfaces and the API disallowed. `/search` is excluded because its
 * result pages are not indexable; `/sitemap.xml` is advertised.
 */
export default function robots(): MetadataRoute.Robots {
  const origin = publicEnv.NEXT_PUBLIC_SITE_URL;

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/studio", "/dashboard", "/practice", "/api", "/search"],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
