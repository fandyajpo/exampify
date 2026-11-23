import { z } from "zod";

/**
 * `lib/env.ts` — the validated environment.
 *
 * Parses `process.env` once at module load with two separate Zod schemas, as
 * [DEPLOYMENT_AND_ENVIRONMENTS.md](../../docs/DEPLOYMENT_AND_ENVIRONMENTS.md) §4.2 requires:
 * a **public** schema holding the only variable that may reach a client bundle, and a
 * **server** schema holding everything else. A missing or malformed value throws at boot,
 * so a misconfigured deploy fails before it serves a request
 * ([OBSERVABILITY_AND_ANALYTICS.md](../../docs/OBSERVABILITY_AND_ANALYTICS.md) §3.1).
 *
 * Cross-field rules are the ones the docs state explicitly: the SMTP port/security pair
 * (`DEP` §4.1), the Google OAuth pair (optional together), the Sentry build trio, a Turso
 * token whenever the database is remote, and the production-only assertions (`DEP` §4.1,
 * `DEP-03`) — error tracking present, `JOBS_DEV_BYPASS` absent, and the Qdrant collection
 * matching the environment.
 *
 * `VERCEL_ENV` is read for those assertions but is **not** app configuration: Vercel
 * provides it, it is absent locally, and it is not one of the 33 names in `.env.example`.
 */

const isServer = typeof window === "undefined";

const message = (name: string, expectation: string) => `\`${name}\` ${expectation}`;

const required = (name: string, expectation = "is required") =>
  z.string().trim().min(1, message(name, expectation));

const url = (name: string) =>
  z.string().trim().url(message(name, "must be an absolute URL, e.g. https://example.com"));

/** Empty and whitespace-only values count as unset, matching how `.env.example` leaves placeholders blank. */
const optional = <S extends z.ZodTypeAny>(schema: S) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    schema.optional(),
  );

// ---------------------------------------------------------------------------
// Public schema — `NEXT_PUBLIC_*` only. Safe to import from a client component.
// ---------------------------------------------------------------------------

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: url("NEXT_PUBLIC_SITE_URL").refine(
    (value) => !value.endsWith("/"),
    message("NEXT_PUBLIC_SITE_URL", "must be an origin without a trailing slash"),
  ),
});

// ---------------------------------------------------------------------------
// Server schema — never inlined into a client bundle.
// ---------------------------------------------------------------------------

export const serverEnvSchema = z
  .object({
    // Database (Turso / libSQL)
    TURSO_DATABASE_URL: z
      .string()
      .trim()
      .min(1, message("TURSO_DATABASE_URL", "is required"))
      .refine(
        (value) =>
          value.startsWith("libsql://") ||
          value.startsWith("http://") ||
          value.startsWith("https://") ||
          value.startsWith("file:"),
        message("TURSO_DATABASE_URL", "must start with libsql://, http(s):// or file:"),
      ),
    TURSO_AUTH_TOKEN: optional(
      required("TURSO_AUTH_TOKEN", "is required for a remote database"),
    ),

    // Auth (Better Auth)
    BETTER_AUTH_SECRET: required("BETTER_AUTH_SECRET").refine(
      (value) => value.length >= 32,
      message("BETTER_AUTH_SECRET", "must be at least 32 characters (≥ 32 random bytes)"),
    ),
    BETTER_AUTH_URL: url("BETTER_AUTH_URL").refine(
      (value) => !value.endsWith("/"),
      message("BETTER_AUTH_URL", "must be an exact origin without a trailing slash"),
    ),
    GOOGLE_CLIENT_ID: optional(required("GOOGLE_CLIENT_ID")),
    GOOGLE_CLIENT_SECRET: optional(required("GOOGLE_CLIENT_SECRET")),

    // Search (Qdrant Cloud)
    QDRANT_URL: url("QDRANT_URL"),
    QDRANT_API_KEY: required("QDRANT_API_KEY"),
    QDRANT_COLLECTION: required("QDRANT_COLLECTION"),

    // Media (Tigris)
    TIGRIS_BUCKET: required("TIGRIS_BUCKET"),
    TIGRIS_ENDPOINT: url("TIGRIS_ENDPOINT"),
    TIGRIS_ACCESS_KEY_ID: required("TIGRIS_ACCESS_KEY_ID"),
    TIGRIS_SECRET_ACCESS_KEY: required("TIGRIS_SECRET_ACCESS_KEY"),
    // Server + client in DEP §4.1, but not NEXT_PUBLIC_-prefixed: it reaches the
    // client through server-rendered props, never through the bundle.
    TIGRIS_PUBLIC_URL: url("TIGRIS_PUBLIC_URL"),

    // Jobs (Upstash QStash)
    QSTASH_TOKEN: required("QSTASH_TOKEN"),
    QSTASH_CURRENT_SIGNING_KEY: required("QSTASH_CURRENT_SIGNING_KEY"),
    QSTASH_NEXT_SIGNING_KEY: required("QSTASH_NEXT_SIGNING_KEY"),

    // Rate limits and locks (Upstash Redis)
    UPSTASH_REDIS_REST_URL: url("UPSTASH_REDIS_REST_URL"),
    UPSTASH_REDIS_REST_TOKEN: required("UPSTASH_REDIS_REST_TOKEN"),

    // Cron
    CRON_SECRET: required("CRON_SECRET"),

    // Email (transport: @sendust/ts; relay: Google SMTP)
    EMAIL_PROVIDER: z.enum(["sendust", "stub"], {
      message: message("EMAIL_PROVIDER", "must be `sendust` or `stub`"),
    }),
    EMAIL_SMTP_HOST: required("EMAIL_SMTP_HOST"),
    EMAIL_SMTP_PORT: z.coerce
      .number({ message: message("EMAIL_SMTP_PORT", "must be a number (465 or 587)") })
      .int(message("EMAIL_SMTP_PORT", "must be a whole number (465 or 587)"))
      .refine(
        (port) => port === 465 || port === 587,
        message("EMAIL_SMTP_PORT", "must be 465 (implicit TLS) or 587 (STARTTLS)"),
      ),
    EMAIL_SMTP_SECURE: z.enum(["tls", "starttls"], {
      message: message("EMAIL_SMTP_SECURE", "must be `tls` or `starttls`"),
    }),
    EMAIL_SMTP_USER: required("EMAIL_SMTP_USER"),
    EMAIL_SMTP_PASS: required("EMAIL_SMTP_PASS"),
    EMAIL_FROM: required("EMAIL_FROM").refine(
      (value) => /^.+<[^@\s<>]+@[^@\s<>]+>$/.test(value),
      message("EMAIL_FROM", 'must look like `Exampify <no-reply@mail.example.com>`'),
    ),

    // Error tracking (Sentry) — empty disables the SDK locally.
    ERROR_TRACKING_DSN: optional(url("ERROR_TRACKING_DSN")),

    // Build/CI only: read by withSentryConfig, never by the runtime.
    SENTRY_AUTH_TOKEN: optional(required("SENTRY_AUTH_TOKEN")),
    SENTRY_ORG: optional(required("SENTRY_ORG")),
    SENTRY_PROJECT: optional(required("SENTRY_PROJECT")),

    // Local-only escape hatch; production rejects it below.
    JOBS_DEV_BYPASS: optional(required("JOBS_DEV_BYPASS")),
  })
  .superRefine((value, ctx) => {
    const addIssue = (path: string, detail: string) =>
      ctx.addIssue({ code: "custom", path: [path], message: detail });

    // A remote database needs its token; `file:` URLs are local and do not.
    const isRemote = !value.TURSO_DATABASE_URL.startsWith("file:");
    if (isRemote && !value.TURSO_AUTH_TOKEN) {
      addIssue("TURSO_AUTH_TOKEN", "`TURSO_AUTH_TOKEN` is required when TURSO_DATABASE_URL is remote");
    }

    // Google OAuth is optional, but half a credential pair is a misconfiguration.
    const hasId = Boolean(value.GOOGLE_CLIENT_ID);
    const hasSecret = Boolean(value.GOOGLE_CLIENT_SECRET);
    if (hasId !== hasSecret) {
      const missing = hasId ? "GOOGLE_CLIENT_SECRET" : "GOOGLE_CLIENT_ID";
      addIssue(missing, `\`${missing}\` is required when the other Google OAuth variable is set`);
    }

    // The relay's port and security mode must agree (DEP §4.1).
    if (value.EMAIL_SMTP_PORT === 465 && value.EMAIL_SMTP_SECURE !== "tls") {
      addIssue("EMAIL_SMTP_SECURE", "`EMAIL_SMTP_SECURE` must be `tls` on port 465");
    }
    if (value.EMAIL_SMTP_PORT === 587 && value.EMAIL_SMTP_SECURE !== "starttls") {
      addIssue("EMAIL_SMTP_SECURE", "`EMAIL_SMTP_SECURE` must be `starttls` on port 587");
    }

    // A 16-character Google app password, checked only where it is actually used.
    if (value.EMAIL_PROVIDER === "sendust") {
      const password = value.EMAIL_SMTP_PASS.replace(/\s+/g, "");
      if (password.length !== 16) {
        addIssue(
          "EMAIL_SMTP_PASS",
          "`EMAIL_SMTP_PASS` must be a 16-character Google app password when EMAIL_PROVIDER is `sendust`",
        );
      }
    }

    // Source-map upload needs all three Sentry build variables.
    const sentryNames = ["SENTRY_AUTH_TOKEN", "SENTRY_ORG", "SENTRY_PROJECT"] as const;
    const sentrySet = sentryNames.filter((name) => Boolean(value[name]));
    if (sentrySet.length > 0 && sentrySet.length < sentryNames.length) {
      for (const name of sentryNames) {
        if (!value[name]) addIssue(name, `\`${name}\` is required once any Sentry build variable is set`);
      }
    }

    // Production-only assertions (DEP §4.1, DEP-03). `VERCEL_ENV` is platform-provided.
    if (process.env.VERCEL_ENV === "production") {
      if (!value.ERROR_TRACKING_DSN) {
        addIssue("ERROR_TRACKING_DSN", "`ERROR_TRACKING_DSN` is required in production");
      }
      if (value.JOBS_DEV_BYPASS) {
        addIssue("JOBS_DEV_BYPASS", "`JOBS_DEV_BYPASS` must be absent in production");
      }
      if (value.QDRANT_COLLECTION === "content_preview") {
        addIssue("QDRANT_COLLECTION", "production must not write to the preview Qdrant collection");
      }
    }
    if (process.env.VERCEL_ENV === "preview" && value.QDRANT_COLLECTION === "content_v1") {
      addIssue("QDRANT_COLLECTION", "preview must not write to the production Qdrant collection");
    }
  });

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

function describe(error: z.ZodError): string {
  const lines = error.issues.map((issue) => {
    const name = issue.path.join(".") || "(root)";
    return `  - ${name}: ${issue.message}`;
  });
  return lines.join("\n");
}

export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const result = publicEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid public environment:\n${describe(result.error)}`);
  }
  return result.data;
}

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid server environment:\n${describe(result.error)}`);
  }
  return result.data;
}

/** Parsed at module load, so a missing canonical origin fails the build or the boot. */
export const publicEnv: PublicEnv = parsePublicEnv(process.env);

let cachedServerEnv: ServerEnv | null = null;

function serverEnv(): ServerEnv {
  if (!isServer) {
    throw new Error(
      "`lib/env` was accessed from a client bundle: only `publicEnv` may be read there. " +
        "Use `publicEnv` or move the access to a server component.",
    );
  }
  cachedServerEnv ??= parseServerEnv(process.env);
  return cachedServerEnv;
}

/**
 * Validates the server environment once per process. `instrumentation.ts` calls this at
 * boot so a misconfigured deploy fails before it serves a request.
 */
export function getServerEnv(): ServerEnv {
  return serverEnv();
}

/** The validated server environment; throws on first access in a browser. */
export const env: ServerEnv = new Proxy({} as ServerEnv, {
  get(_target, property) {
    return serverEnv()[property as keyof ServerEnv];
  },
  has(_target, property) {
    return property in serverEnv();
  },
});
