import { z } from "zod";

import { ERROR_RESPONSES, METHODS, OPERATIONS, type Operation, type ResponseSpec } from "./registry";
import { errorEnvelopeSchema } from "./schemas";

/**
 * Builds `openapi.json` from the registry ([API_CONTRACTS.md](../../../docs/API_CONTRACTS.md)
 * §16.2). Nothing here is hand-written spec text: paths, methods, request bodies and
 * response shapes all come from the registry, and request bodies come from the Zod
 * schemas the handlers parse.
 *
 * Output is deterministic — sorted paths, fixed method order, two-space JSON — so the
 * committed file changes only when a schema or an operation does. That is what makes
 * `bun run openapi:check` a meaningful diff gate.
 *
 * The document carries no `security` block: every operation is either public or
 * authenticated by a QStash signature / cron bearer, neither of which OpenAPI can express,
 * so the operation descriptions state the auth and the document does not pretend otherwise.
 */

const TAG_DESCRIPTIONS: Record<string, string> = {
  meta: "Health and the document itself.",
  analytics: "Client-side product events.",
  internal: "Worker and cron endpoints; authenticated by signature or bearer token, never a session.",
  practice: "Student practice and attempts. Session-authenticated and email-verified; every row is owned by the caller.",
  studio: "Authoring studio. Session-authenticated; reads need `author`+, taxonomy writes need `admin`.",
};

type JsonObject = Record<string, unknown>;

function toJsonSchema(schema: z.ZodType, io: "input" | "output"): JsonObject {
  const json = { ...(z.toJSONSchema(schema, { io, unrepresentable: "any" }) as JsonObject) };
  // `$schema` describes a standalone JSON Schema document; inside an OpenAPI 3.1
  // component it is noise that would differ between zod patch releases.
  delete json.$schema;
  return json;
}

function buildResponse(spec: ResponseSpec): JsonObject {
  if (spec.schema) {
    return {
      description: spec.description,
      content: { "application/json": { schema: toJsonSchema(spec.schema, "output") } },
    };
  }
  // Bodyless error statuses share one component; the ref is derived from the status, so it
  // cannot point at a component that `components.responses` does not define.
  if (spec.status in ERROR_RESPONSES) {
    return { $ref: `#/components/responses/${spec.status}` };
  }
  return { description: spec.description };
}

function buildOperation(operation: Operation): JsonObject {
  const responses: JsonObject = {};
  for (const spec of operation.responses) {
    responses[String(spec.status)] = buildResponse(spec);
  }

  const built: JsonObject = {
    tags: [operation.tag],
    summary: operation.summary,
    operationId: operation.operationId,
    responses,
  };

  if (operation.description) built.description = operation.description;

  if (operation.request) {
    built.requestBody = {
      required: true,
      content: { "application/json": { schema: toJsonSchema(operation.request, "input") } },
    };
  }

  return built;
}

export type OpenApiDocument = {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
    license: { name: string };
  };
  servers: { url: string; description: string }[];
  tags: { name: string; description: string }[];
  paths: Record<string, JsonObject>;
  components: { responses: Record<string, JsonObject> };
};

export function buildOpenApiDocument(): OpenApiDocument {
  const paths: Record<string, JsonObject> = {};
  const tags = new Set<string>();

  for (const path of [...new Set(OPERATIONS.map((operation) => operation.path))].sort()) {
    const methods: JsonObject = {};
    for (const method of METHODS) {
      const operation = OPERATIONS.find((entry) => entry.path === path && entry.method === method);
      if (!operation) continue;
      methods[method] = buildOperation(operation);
      tags.add(operation.tag);
    }
    paths[path] = methods;
  }

  const responses: Record<string, JsonObject> = {};
  for (const [status, description] of Object.entries(ERROR_RESPONSES)) {
    responses[status] = {
      description,
      content: {
        "application/json": { schema: toJsonSchema(errorEnvelopeSchema, "output") },
      },
    };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Exampify API",
      version: "1.0.0",
      description:
        "Generated from the route registry in `src/lib/openapi/registry.ts`. docs/API_CONTRACTS.md is the human contract; this file is the machine one and is never edited by hand.",
      license: { name: "Proprietary" },
    },
    servers: [{ url: "http://localhost:3000", description: "Local development" }],
    tags: [...tags].sort().map((name) => ({ name, description: TAG_DESCRIPTIONS[name] ?? name })),
    paths,
    components: { responses },
  };
}

/** Two-space JSON with a trailing newline: stable under `git diff` and under every editor. */
export function serializeOpenApiDocument(document: OpenApiDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}
