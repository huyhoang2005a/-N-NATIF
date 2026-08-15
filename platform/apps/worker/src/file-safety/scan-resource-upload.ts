import { loadEnv } from "@r2m/env";
import { scanForMalware, sniffMimeType } from "@r2m/file-safety";
import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { eq } from "drizzle-orm";
import { logger } from "../logger";
import { deleteResourceObject, getResourceObjectBuffer } from "./s3-object";
import { extractText } from "../ingestion/extract-text";
import { chunkText } from "../ingestion/chunk-text";
import { embedChunkText } from "../ingestion/gemini-embed";

/** Phase 7 Sprint 7.4 — the `ResourceIngestionQueued` handler was a no-op through Phase 2
 * (see the "Phase 2 simplification" comment group in outbox-dispatcher.ts) — this is where
 * real MIME sniffing + malware scanning finally lands, closing spec §7.4 item 13's
 * "hoàn thiện từ hook đã chuẩn bị ở Phase 2". */
export async function scanResourceUpload(db: Database, resourceVersionId: string, ingestionJobId: string): Promise<void> {
  const version = await db.query.resourceVersion.findFirst({ where: eq(schema.resourceVersion.id, resourceVersionId) });
  if (!version) {
    logger.warn({ resourceVersionId }, "scanResourceUpload: resource_version not found, skipping");
    return;
  }

  await db.update(schema.resourceIngestionJob).set({ status: "PROCESSING", startedAt: new Date() }).where(eq(schema.resourceIngestionJob.id, ingestionJobId));

  // Pure external link (sourceUrl, no storageObjectKey) — nothing was uploaded to this
  // app's storage, so there's nothing to scan. Matches the pre-existing "exactly one of
  // sourceUrl/storageObjectKey" invariant from Phase 2.
  if (!version.storageObjectKey) {
    await db.update(schema.resourceIngestionJob).set({ status: "COMPLETED", completedAt: new Date() }).where(eq(schema.resourceIngestionJob.id, ingestionJobId));
    return;
  }

  const env = loadEnv();
  let buffer: Buffer;
  try {
    buffer = await getResourceObjectBuffer(version.storageObjectKey);
  } catch (error) {
    logger.error({ err: error, storageObjectKey: version.storageObjectKey }, "scanResourceUpload: failed to fetch object from storage");
    await db
      .update(schema.resourceIngestionJob)
      .set({ status: "FAILED", completedAt: new Date(), errorCode: "OBJECT_FETCH_FAILED", errorMessage: error instanceof Error ? error.message : String(error) })
      .where(eq(schema.resourceIngestionJob.id, ingestionJobId));
    return;
  }

  const sniffed = sniffMimeType(buffer);
  if (!sniffed) {
    logger.warn({ resourceVersionId, storageObjectKey: version.storageObjectKey }, "scanResourceUpload: MIME mismatch, rejecting");
    await deleteResourceObject(version.storageObjectKey);
    await db
      .update(schema.resourceIngestionJob)
      .set({ status: "FAILED", completedAt: new Date(), errorCode: "MIME_MISMATCH", errorMessage: "Uploaded content does not match any accepted file type (PDF/JPEG/PNG)." })
      .where(eq(schema.resourceIngestionJob.id, ingestionJobId));
    return;
  }

  const scanResult = await scanForMalware(buffer, { host: env.CLAMAV_HOST, port: env.CLAMAV_PORT });
  if (!scanResult.clean) {
    logger.warn({ resourceVersionId, signature: scanResult.signature }, "scanResourceUpload: malware detected, quarantining");
    await deleteResourceObject(version.storageObjectKey);
    await db
      .update(schema.resourceIngestionJob)
      .set({ status: "FAILED", completedAt: new Date(), errorCode: "MALWARE_DETECTED", errorMessage: scanResult.signature ?? "malware detected" })
      .where(eq(schema.resourceIngestionJob.id, ingestionJobId));
    return;
  }

  await ingestResourceChunks(db, resourceVersionId, buffer, sniffed);

  await db.update(schema.resourceIngestionJob).set({ status: "COMPLETED", completedAt: new Date() }).where(eq(schema.resourceIngestionJob.id, ingestionJobId));
}

/** Spec items 13-14 (`01_workflow_theo_phase.md` §Phase 2): "extract text từ file → chunk
 * nội dung → lưu resource_chunk" + "sinh embedding cho từng chunk". Was never implemented
 * (see the doc comment on `resourceChunk` in `packages/database/src/schema/resource.ts`) —
 * `resource_chunk` was always empty, so the FTS-based recommendation engine
 * (`generate-recommendation-run.ts`) could never surface any results. Runs after the
 * malware scan passes, inside the same ingestion job. Non-PDF (image) or extraction-empty
 * resources simply produce 0 chunks — not a failure, matches "MIME mismatch"/"no text
 * layer" being a legitimate outcome, not an error. */
async function ingestResourceChunks(db: Database, resourceVersionId: string, buffer: Buffer, mimeType: string): Promise<void> {
  let text: string | null;
  try {
    text = await extractText(buffer, mimeType);
  } catch (error) {
    logger.warn({ err: error, resourceVersionId }, "ingestResourceChunks: text extraction failed, skipping chunking");
    return;
  }
  if (!text) return;

  const chunks = chunkText(text);
  if (chunks.length === 0) return;

  for (const chunk of chunks) {
    const embedding = await embedChunkText(chunk.content);
    await db.insert(schema.resourceChunk).values({
      resourceVersionId,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      embedding,
    });
  }
  logger.info({ resourceVersionId, chunkCount: chunks.length }, "ingestResourceChunks: chunks stored");
}
