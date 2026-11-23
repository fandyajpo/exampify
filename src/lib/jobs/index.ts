import "server-only";

/**
 * `lib/jobs` — the transactional outbox, the QStash client and the job handlers
 * ([BACKGROUND_JOBS.md](../../../docs/BACKGROUND_JOBS.md)).
 *
 * The pattern, for every job: write a durable row first, publish the id second, and let
 * the worker claim the row. A publish that never happens is repaired by the sweeper; a
 * publish that happens twice finds the row already finished.
 *
 * Today only `send-email` exists (`./email.ts`, with the worker at
 * `/api/v1/internal/jobs/send-email` and the sweeper at
 * `/api/v1/internal/cron/sweep-jobs`); content indexing and the scheduled jobs arrive with
 * the phases that produce their input.
 */
export {
  EMAIL_JOB,
  enqueueEmail,
  runEmailJob,
  sweepEmailJobs,
  type EmailJobOutcome,
  type EmailJobPayload,
} from "./email";
export { verifyCronRequest } from "./cron";
export { jobUrl, publishJobRun, verifyQstashSignature } from "./qstash";
