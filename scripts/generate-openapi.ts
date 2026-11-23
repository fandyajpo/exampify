/**
 * Regenerates `openapi.json` from the route registry
 * ([API_CONTRACTS.md](../docs/API_CONTRACTS.md) §16.2).
 *
 *   bun run openapi:generate   # rewrite the committed file
 *   bun run openapi:check      # fail when it differs (CI) or a route is unregistered
 *
 * The check is a reviewed gate, not a convenience: changing a Zod schema without
 * regenerating the document fails the build, exactly like a stale lockfile.
 *
 * Runs outside the Next runtime, so it imports the registry through relative paths and
 * never touches `server-only` modules or the database.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildOpenApiDocument, serializeOpenApiDocument } from "../src/lib/openapi/document";
import { OPERATIONS } from "../src/lib/openapi/registry";
import { coverageProblems, discoverRoutes } from "../src/lib/openapi/routes";

const root = fileURLToPath(new URL("..", import.meta.url));
const target = join(root, "openapi.json");

const problems = coverageProblems(discoverRoutes(join(root, "src", "app")), OPERATIONS);
if (problems.length > 0) {
  console.error("openapi: the registry and the route tree disagree");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

const document = buildOpenApiDocument();
const next = serializeOpenApiDocument(document);

if (!process.argv.includes("--check")) {
  writeFileSync(target, next);
  console.log(`openapi: wrote ${Object.keys(document.paths).length} paths to openapi.json`);
  process.exit(0);
}

let current = "";
try {
  current = readFileSync(target, "utf8");
} catch {
  console.error("openapi: openapi.json is missing; run `bun run openapi:generate`");
  process.exit(1);
}

if (current !== next) {
  console.error(
    "openapi: openapi.json is out of date with the registry; run `bun run openapi:generate` and commit the result",
  );
  process.exit(1);
}

console.log("openapi: openapi.json matches the registry");
