/**
 * The closed product-event vocabulary (`OBSERVABILITY_AND_ANALYTICS.md` §6, ADR-029).
 *
 * Adding an event means editing this file, not calling `track('whatever')`: the union is
 * the contract, and `recordEvent()` accepts nothing else. Properties are ids, enums,
 * numbers and booleans only — no free text, no PII (§6.1 rules 4–5).
 *
 * `CLIENT_EVENT_NAMES` is the only subset a browser may report (§6.3). Everything else is
 * written server-side by the service that performed the action.
 */
import { z } from "zod";

export const CLIENT_EVENT_NAMES = ["suggestion_selected", "search_result_clicked"] as const;

export type ClientEventName = (typeof CLIENT_EVENT_NAMES)[number];

export const SERVER_EVENT_NAMES = [
  "resource_viewed",
  "attempt_started",
  "attempt_submitted",
  "attempt_abandoned",
  "answer_revealed",
  "search_performed",
  "user_signed_up",
  "user_signed_in",
  "content_published",
  "media_uploaded",
  "email_sent",
  "email_failed",
  "job_failed",
] as const;

export type ServerEventName = (typeof SERVER_EVENT_NAMES)[number];
export type EventName = ClientEventName | ServerEventName;

export const EVENT_NAMES: readonly EventName[] = [...CLIENT_EVENT_NAMES, ...SERVER_EVENT_NAMES];

const shortCode = z.string().min(1).max(64);
const position = z.number().int().min(0).max(50);
const queryLength = z.number().int().min(0).max(500);

/** Per-event property schemas: unknown keys are stripped, so a client cannot smuggle free text. */
export const CLIENT_EVENT_PROPS = {
  suggestion_selected: z.object({
    position,
    queryLength,
    type: z.enum(["subject", "chapter", "topic", "resource"]),
  }),
  search_result_clicked: z.object({
    position,
    queryLength,
    entityType: z.enum(["learning_resource", "assessment", "topic", "subject"]),
  }),
} as const satisfies Record<ClientEventName, z.ZodTypeAny>;

export const clientEventSchema = z.discriminatedUnion("name", [
  z.object({
    name: z.literal("suggestion_selected"),
    occurredAt: z.number().int().min(0),
    props: CLIENT_EVENT_PROPS.suggestion_selected,
  }),
  z.object({
    name: z.literal("search_result_clicked"),
    occurredAt: z.number().int().min(0),
    props: CLIENT_EVENT_PROPS.search_result_clicked,
  }),
]);

export const clientEventBatchSchema = z.object({
  events: z.array(clientEventSchema).min(1).max(20),
});

export type ClientEvent = z.infer<typeof clientEventSchema>;

/** Largest body §16.1 accepts; checked before parsing so a huge payload is never buffered. */
export const MAX_EVENTS_BODY_BYTES = 16 * 1024;

/**
 * Property values that may be stored: scalars and short id/enum strings. Records and
 * arrays are dropped rather than stringified, because a nested value is exactly how a
 * query string or an email address would sneak into `props_json`.
 */
export type EventProps = Record<string, string | number | boolean>;
export type EventEntityType = "learning_resource" | "assessment" | "attempt" | "topic";

const MAX_STRING_VALUE = 64;

export function redactProps(input: unknown): EventProps {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return {};

  const output: EventProps = {};
  for (const [key, value] of Object.entries(input)) {
    if (!/^[a-z][a-zA-Z0-9]{0,31}$/.test(key)) continue;
    if (typeof value === "boolean") {
      output[key] = value;
    } else if (typeof value === "number" && Number.isFinite(value)) {
      output[key] = value;
    } else if (typeof value === "string" && value.length <= MAX_STRING_VALUE) {
      // A long string is prose, not an id or an enum member.
      output[key] = value;
    }
  }
  return output;
}

/** The stored shape for one event, before it reaches the database. */
export type RecordedEvent = {
  name: EventName;
  props: EventProps;
  entityType: EventEntityType | null;
  entityId: string | null;
};

export function isClientEventName(name: string): name is ClientEventName {
  return (CLIENT_EVENT_NAMES as readonly string[]).includes(name);
}

/** Kept for callers that need a cheap runtime guard over the whole vocabulary. */
export function isEventName(name: string): name is EventName {
  return isClientEventName(name) || (SERVER_EVENT_NAMES as readonly string[]).includes(name);
}

export { shortCode };
