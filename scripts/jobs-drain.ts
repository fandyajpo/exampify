/**
 * `bun run jobs:drain` — the local sweeper (`BACKGROUND_JOBS.md` §11).
 *
 * QStash cannot reach `localhost`, so local development drains the outbox directly. This
 * runs the **same** `sweepEmailJobs()` the cron route calls, in-process, until nothing is
 * left — no second implementation to drift from production.
 *
 * `server-only` modules are only importable under the React Server Components condition,
 * and the validated environment lives in `.env.local`, hence the flags in the script.
 */
import { sweepEmailJobs } from "../src/lib/jobs/email";

const MAX_PASSES = 10;

let total = 0;
let skipped = 0;
let failed = 0;

for (let pass = 1; pass <= MAX_PASSES; pass += 1) {
  const result = await sweepEmailJobs({ olderThanMs: 0 });
  total += result.processed;
  skipped += result.skipped;
  failed += result.failed;

  if (result.processed === 0) break;
  console.log(`jobs:drain pass ${pass}: processed=${result.processed} skipped=${result.skipped} failed=${result.failed}`);
}

console.log(`jobs:drain: processed=${total} skipped=${skipped} failed=${failed}`);
if (failed > 0) process.exit(1);
