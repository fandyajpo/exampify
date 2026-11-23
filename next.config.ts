import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
