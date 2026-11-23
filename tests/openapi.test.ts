import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildOpenApiDocument, serializeOpenApiDocument } from "@/lib/openapi/document";
import { OPERATIONS } from "@/lib/openapi/registry";
import { coverageProblems, discoverRoutes } from "@/lib/openapi/routes";

/**
 * The generated-contract gate (`API_CONTRACTS.md` §16.2, MVP_ROADMAP §4.6).
 *
 * Four things must stay true, and each one is a way the document has drifted in other
 * projects: the committed file matches the generator, every route is registered, the
 * registry documents nothing that does not exist, and the document is valid OpenAPI 3.1
 * with unique operation ids.
 */

const appDir = fileURLToPath(new URL("../src/app", import.meta.url));
const committedPath = new URL("../openapi.json", import.meta.url);

type BuiltOperation = {
  operationId: string;
  tags: string[];
  responses: Record<string, { $ref?: string; description?: string }>;
  requestBody?: { content: Record<string, { schema: Record<string, unknown> }> };
};

function document() {
  return buildOpenApiDocument();
}

describe("generated OpenAPI document", () => {
  it("matches the committed openapi.json byte for byte", () => {
    const committed = readFileSync(committedPath, "utf8");
    expect(serializeOpenApiDocument(document())).toBe(committed);
  });

  it("registers every exported route handler", () => {
    const problems = coverageProblems(discoverRoutes(appDir), OPERATIONS);
    expect(problems).toEqual([]);
  });

  it("is OpenAPI 3.1 with one operation id per operation and paths under /api/v1", () => {
    const built = document();
    expect(built.openapi).toBe("3.1.0");

    const operations = Object.entries(built.paths).flatMap(([path, methods]) =>
      Object.values(methods as Record<string, BuiltOperation>).map((operation) => ({ path, operation })),
    );

    expect(operations.length).toBe(OPERATIONS.length);

    const ids = operations.map(({ operation }) => operation.operationId);
    expect(new Set(ids).size).toBe(ids.length);

    for (const { path } of operations) expect(path.startsWith("/api/v1/")).toBe(true);
  });

  it("only references component responses it defines", () => {
    const built = document();
    const defined = new Set(Object.keys(built.components.responses));

    for (const [, methods] of Object.entries(built.paths)) {
      for (const operation of Object.values(methods as Record<string, BuiltOperation>)) {
        for (const response of Object.values(operation.responses)) {
          if (!response.$ref) continue;
          expect(response.$ref.startsWith("#/components/responses/")).toBe(true);
          expect(defined.has(response.$ref.split("/").at(-1)!)).toBe(true);
        }
      }
    }
  });

  it("builds request bodies from the schema the handler parses", () => {
    const events = document().paths["/api/v1/events"]?.post as unknown as BuiltOperation;
    const schema = events.requestBody?.content["application/json"]?.schema;

    // `clientEventBatchSchema`, not a hand-written description of it.
    expect(schema?.type).toBe("object");
    expect(JSON.stringify(schema)).toContain('"events"');
    expect(JSON.stringify(schema)).toContain("suggestion_selected");
  });
});
