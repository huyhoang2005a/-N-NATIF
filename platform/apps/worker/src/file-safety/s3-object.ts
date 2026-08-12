import type { Readable } from "node:stream";
import { loadEnv } from "@r2m/env";
import { DeleteObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

/** Phase 7 Sprint 7.4 — minimal S3/MinIO client for the worker (mirrors
 * `apps/api/src/common/storage/s3.service.ts`'s config; the worker only ever needs
 * fetch-for-scanning + quarantine-delete, not the full upload/presign surface apps/api
 * has, so this is 2 plain functions rather than a full service class). */
function buildClient(): S3Client {
  const env = loadEnv();
  return new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: true,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  });
}

export async function getResourceObjectBuffer(key: string): Promise<Buffer> {
  const env = loadEnv();
  const client = buildClient();
  const response = await client.send(new GetObjectCommand({ Bucket: env.S3_RESOURCE_BUCKET, Key: key }));
  const chunks: Buffer[] = [];
  for await (const chunk of response.Body as Readable) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

/** Quarantine — the spec's line for both malware and MIME mismatch: "xoá quarantine object
 * và từ chối" (§Phase 2 upload flow, applies here per Sprint 7.4's "hoàn thiện" note). */
export async function deleteResourceObject(key: string): Promise<void> {
  const env = loadEnv();
  const client = buildClient();
  await client.send(new DeleteObjectCommand({ Bucket: env.S3_RESOURCE_BUCKET, Key: key }));
}

/** Phase 7 Sprint 7.4 — retention sweep (verification documents, separate bucket). */
export async function deleteVerificationObject(key: string): Promise<void> {
  const env = loadEnv();
  const client = buildClient();
  await client.send(new DeleteObjectCommand({ Bucket: env.S3_VERIFICATION_BUCKET, Key: key }));
}
