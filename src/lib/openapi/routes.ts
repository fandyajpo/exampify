import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { METHODS, type Method, type Operation } from "./registry";

/**
 * Route coverage for the generated contract ([API_CONTRACTS.md](../../../docs/API_CONTRACTS.md)
 * §16.2): a route that exists without a registry row is a review failure, and a registry
 * row without a route is a document that lies.
 *
 * Discovery is scoped to `src/app/api/v1`, which is the whole documented surface. Everything
 * else under `app/api` is Better Auth's tree (`/api/auth/*`), mounted by the library and
 * described in prose rather than in this document — so it needs no exemption list.
 *
 * Build-time only — `scripts/generate-openapi.ts` and the unit suite import it; no route
 * handler may. That is why `node:fs` is acceptable here and why the module is pure: it
 * reads files and returns strings, it never touches the network or the database.
 */

const HTTP_METHODS = METHODS.map((method) => method.toUpperCase()).join("|");

export type DiscoveredOperation = {
  method: Method;
  path: string;
  /** Project-relative file that exports the handler, for the failure message. */
  file: string;
};

const EXPORT_RE = new RegExp(`^\\s*export\\s+(?:async\\s+)?(?:function|const)\\s+(${HTTP_METHODS})\\b`);

function routeFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...routeFiles(full));
      continue;
    }
    if (/^route\.(?:ts|tsx|js|mjs)$/.test(entry.name)) found.push(full);
  }
  return found;
}

/** `src/app/api/v1/topics/[topicId]/route.ts` → `/api/v1/topics/{topicId}`. */
function operationPath(v1Dir: string, file: string): string {
  const segments = relative(v1Dir, file).split(sep);
  segments.pop(); // `route.ts`
  const template = segments.map((segment) =>
    segment.replace(/^\[+\.{0,3}(.+?)\]+$/, "{$1}"),
  );
  return `/api/v1/${template.join("/")}`;
}

export function discoverRoutes(appDir: string): DiscoveredOperation[] {
  const operations: DiscoveredOperation[] = [];
  const v1Dir = join(appDir, "api", "v1");
  const projectRoot = join(appDir, "..", "..");

  for (const file of routeFiles(v1Dir).sort()) {
    const source = readFileSync(file, "utf8");
    const path = operationPath(v1Dir, file);
    const fileLabel = relative(projectRoot, file).split(sep).join("/");

    for (const line of source.split("\n")) {
      const direct = EXPORT_RE.exec(line);
      if (!direct) continue;
      operations.push({
        method: direct[1]!.toLowerCase() as Method,
        path,
        file: fileLabel,
      });
    }
  }

  return operations;
}

/** Both directions of drift plus duplicate operation ids. An empty list is the gate. */
export function coverageProblems(
  discovered: readonly DiscoveredOperation[],
  operations: readonly Operation[],
): string[] {
  const problems: string[] = [];

  const registered = new Set(operations.map((operation) => `${operation.method.toUpperCase()} ${operation.path}`));
  const implemented = new Set(discovered.map((entry) => `${entry.method.toUpperCase()} ${entry.path}`));

  for (const entry of discovered) {
    const key = `${entry.method.toUpperCase()} ${entry.path}`;
    if (!registered.has(key)) {
      problems.push(`${key} is exported by ${entry.file} but has no row in src/lib/openapi/registry.ts`);
    }
  }

  for (const operation of operations) {
    const key = `${operation.method.toUpperCase()} ${operation.path}`;
    if (!implemented.has(key)) {
      problems.push(`src/lib/openapi/registry.ts documents ${key} but no route handler exports it`);
    }
  }

  const seenIds = new Map<string, string>();
  for (const operation of operations) {
    if (seenIds.has(operation.operationId)) {
      problems.push(
        `operationId "${operation.operationId}" is used twice (${seenIds.get(operation.operationId)} and ${operation.path})`,
      );
    } else {
      seenIds.set(operation.operationId, operation.path);
    }
  }

  return problems;
}
