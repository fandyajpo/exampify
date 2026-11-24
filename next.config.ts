import path from "node:path";
import type { NextConfig } from "next";

/**
 * The public bucket domain, so `next/image` may optimise a media asset
 * (`DEPLOYMENT_AND_ENVIRONMENTS.md` §5). Read straight from `process.env`: the Next config is
 * evaluated before the app's validated environment module and must not need every variable.
 */
function mediaRemotePattern(): NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]> {
  const configured = process.env.TIGRIS_PUBLIC_URL?.trim();
  if (!configured) return [];
  try {
    const url = new URL(configured);
    return [{ protocol: url.protocol === "http:" ? "http" : "https", hostname: url.hostname, pathname: "/**" }];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  images: { remotePatterns: mediaRemotePattern() },
  // `@sendust/ts` loads a per-platform Node-API addon at import time: bundling it breaks
  // the binary lookup, so it stays external and is traced into the function
  // (`EMAIL_AND_NOTIFICATIONS.md` §2.3).
  serverExternalPackages: ["@sendust/ts"],
  turbopack: {
    // Without an explicit root, Turbopack walks up to the nearest lockfile — which is a
    // yarn.lock in the home directory, one level above this project.
    root: path.resolve(import.meta.dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
