import "./tracing";
import type { EmailSender } from "@r2m/domain";
import { loadEnv } from "@r2m/env";
import { closeDb, getAppDb, getAppPool } from "@r2m/database";
import { sweepExpiredCaseInitiationRequests } from "./case-initiations/sweep-expired";
import { ConsoleEmailSender } from "./email/console-email-sender";
import { ResendEmailSender } from "./email/resend-email-sender";
import { SmtpEmailSender } from "./email/smtp-email-sender";
import { logger } from "./logger";
import { outboxDispatchLagSeconds, outboxDispatchTotal, registerDbPoolMetrics, startMetricsServer } from "./metrics";
import { computeOutboxLagSeconds, dispatchPendingEvents } from "./outbox-dispatcher";
import { sweepExpiredTransferManifests } from "./transfer-manifests/sweep-expired";
import { sweepExpiredVerificationDocuments } from "./verification-documents/sweep-expired";

const POLL_INTERVAL_MS = 2000;
// `case_initiation_request.expires_at` is a 14-day window — no need to check every
// 2s tick like the outbox loop; every 5 minutes is more than tight enough.
const EXPIRY_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

/** SMTP takes priority over Resend — added 2026-08 because the sending domain isn't
 * verified with Resend yet, SMTP has no such requirement (works through an existing
 * mailbox). Falls back to Resend if only that's configured, then to console logging. */
function buildEmailSender(env: ReturnType<typeof loadEnv>): EmailSender {
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD && env.EMAIL_FROM_ADDRESS) {
    return new SmtpEmailSender();
  }
  if (env.RESEND_API_KEY && env.EMAIL_FROM_ADDRESS && env.EMAIL_FROM_NAME) {
    return new ResendEmailSender();
  }
  logger.warn("Neither SMTP_HOST nor RESEND_API_KEY set — falling back to ConsoleEmailSender");
  return new ConsoleEmailSender();
}

/**
 * Phase 1 keeps this a plain polling loop against `outbox_event` rather than wiring
 * BullMQ/Redis — there is no queue-backed job yet (ingestion/embedding/notification
 * delivery land in later phases) and a poll loop is enough to satisfy "reliable event
 * delivery" for now. Revisit once a job needs Redis-backed retry/backoff scheduling.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  // Phase 7 Sprint 7.1 — runs as `r2m_app` (non-superuser), via getAppDb().
  const db = getAppDb();
  const emailSender = buildEmailSender(env);
  let stopping = false;

  const shutdown = async () => {
    stopping = true;
    await closeDb();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  registerDbPoolMetrics(getAppPool());
  startMetricsServer(env.WORKER_METRICS_PORT);

  logger.info("outbox dispatcher started");
  let msSinceLastSweep = EXPIRY_SWEEP_INTERVAL_MS; // sweep once on startup, then every interval
  while (!stopping) {
    try {
      const result = await dispatchPendingEvents(db, emailSender);
      if (result.processed > 0) outboxDispatchTotal.inc({ outcome: "published" }, result.processed);
      if (result.failed > 0) outboxDispatchTotal.inc({ outcome: "failed" }, result.failed);
      if (result.deadLetter > 0) outboxDispatchTotal.inc({ outcome: "dead_letter" }, result.deadLetter);
      outboxDispatchLagSeconds.set(await computeOutboxLagSeconds(db));
      if (result.processed > 0 || result.failed > 0 || result.deadLetter > 0) {
        logger.info(
          { processed: result.processed, failed: result.failed, deadLetter: result.deadLetter },
          "dispatch cycle complete",
        );
      }
    } catch (error) {
      logger.error({ err: error }, "dispatch loop error");
    }

    if (msSinceLastSweep >= EXPIRY_SWEEP_INTERVAL_MS) {
      msSinceLastSweep = 0;
      try {
        const expiredCount = await sweepExpiredCaseInitiationRequests(db);
        if (expiredCount > 0) {
          logger.info({ expiredCount }, "expired case initiation request(s)");
        }
      } catch (error) {
        logger.error({ err: error }, "expiry sweep error");
      }
      try {
        const expiredCount = await sweepExpiredTransferManifests(db);
        if (expiredCount > 0) {
          logger.info({ expiredCount }, "expired transfer manifest(s)/grant(s)");
        }
      } catch (error) {
        logger.error({ err: error }, "transfer manifest expiry sweep error");
      }
      try {
        const expiredCount = await sweepExpiredVerificationDocuments(db);
        if (expiredCount > 0) {
          logger.info({ expiredCount }, "expired verification document(s) — retention swept");
        }
      } catch (error) {
        logger.error({ err: error }, "verification document retention sweep error");
      }
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    msSinceLastSweep += POLL_INTERVAL_MS;
  }
}

main().catch((error) => {
  logger.fatal({ err: error }, "worker fatal error");
  process.exit(1);
});
