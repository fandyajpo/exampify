/**
 * Runs once per server process, before any request is handled.
 *
 * Validating here is what turns `lib/env.ts` into a boot check rather than a first-use
 * error: a missing or malformed variable stops the process at startup
 * ([OBSERVABILITY_AND_ANALYTICS.md](../../docs/OBSERVABILITY_AND_ANALYTICS.md) §3.1,
 * [DEPLOYMENT_AND_ENVIRONMENTS.md](../../docs/DEPLOYMENT_AND_ENVIRONMENTS.md) §4.2).
 * `onRequestError` reporting belongs here too once error tracking is wired up.
 */
export async function register(): Promise<void> {
  const { getServerEnv } = await import("@/lib/env");
  getServerEnv();
}
