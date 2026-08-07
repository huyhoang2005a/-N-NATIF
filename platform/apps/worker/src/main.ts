import type { EmailSender } from "@r2m/domain";
import { loadEnv } from "@r2m/env";
import { closeDb, getDb } from "@r2m/database";
import { ConsoleEmailSender } from "./email/console-email-sender";
import { ResendEmailSender } from "./email/resend-email-sender";
import { dispatchPendingEvents } from "./outbox-dispatcher";

const POLL_INTERVAL_MS = 2000;

function buildEmailSender(env: ReturnType<typeof loadEnv>): EmailSender {
  if (env.RESEND_API_KEY && env.EMAIL_FROM_ADDRESS && env.EMAIL_FROM_NAME) {
    return new ResendEmailSender();
  }
  console.log("[worker] RESEND_API_KEY not set — falling back to ConsoleEmailSender");
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
  const db = getDb();
  const emailSender = buildEmailSender(env);
  let stopping = false;

  const shutdown = async () => {
    stopping = true;
    await closeDb();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log("[worker] outbox dispatcher started");
  while (!stopping) {
    try {
      const result = await dispatchPendingEvents(db, emailSender);
      if (result.processed > 0 || result.failed > 0) {
        console.log(`[worker] processed=${result.processed} failed=${result.failed}`);
      }
    } catch (error) {
      console.error("[worker] dispatch loop error", error);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

main().catch((error) => {
  console.error("[worker] fatal", error);
  process.exit(1);
});
