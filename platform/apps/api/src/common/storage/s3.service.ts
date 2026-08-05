import { createHash } from "node:crypto";
import { loadEnv } from "@r2m/env";
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable } from "@nestjs/common";
import type { Readable } from "node:stream";

export interface PresignedUrlResult {
  url: string;
  expiresIn: number;
}

/**
 * First real S3 client in the repo (Phase 1 declared the env vars but never used them).
 * `forcePathStyle: true` is required for MinIO — without it, the SDK addresses buckets as
 * a subdomain (`bucket.localhost:9000`), which does not resolve locally and fails
 * presigned URLs silently (the URL generates fine, only the actual PUT/GET 404s).
 */
@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly signedUrlTtlSeconds: number;
  private readonly verificationBucket: string;
  private readonly resourceBucket: string;
  private readonly ensuredBuckets = new Set<string>();

  constructor() {
    const env = loadEnv();
    this.signedUrlTtlSeconds = env.S3_SIGNED_URL_TTL_SECONDS;
    this.verificationBucket = env.S3_VERIFICATION_BUCKET;
    this.resourceBucket = env.S3_RESOURCE_BUCKET;
    this.client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
    });
  }

  /** Local MinIO has no bucket-provisioning step in docker-compose — create on first use
   * so `docker compose up` alone is enough for a fresh dev environment. */
  private async ensureBucket(bucket: string): Promise<void> {
    if (this.ensuredBuckets.has(bucket)) return;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: bucket }));
    }
    this.ensuredBuckets.add(bucket);
  }

  async createPresignedUploadUrl(
    bucket: string,
    key: string,
    contentType: string,
  ): Promise<PresignedUrlResult> {
    await this.ensureBucket(bucket);
    const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
    const url = await getSignedUrl(this.client, command, { expiresIn: this.signedUrlTtlSeconds });
    return { url, expiresIn: this.signedUrlTtlSeconds };
  }

  /** Reviewer-facing document access (UC-VER-02: "signed URL có TTL"). */
  async createPresignedDownloadUrl(bucket: string, key: string): Promise<PresignedUrlResult> {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const url = await getSignedUrl(this.client, command, { expiresIn: this.signedUrlTtlSeconds });
    return { url, expiresIn: this.signedUrlTtlSeconds };
  }

  /** Streams the object back and hashes it server-side instead of trusting a
   * client-supplied checksum — used to populate `checksum_sha256` for audit (UC-VER-01:
   * "Ghi loại tài liệu và object key hash; không ghi nội dung tài liệu"). */
  async computeObjectSha256(bucket: string, key: string): Promise<string> {
    const response = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const hash = createHash("sha256");
    for await (const chunk of response.Body as Readable) {
      hash.update(chunk as Buffer);
    }
    return hash.digest("hex");
  }

  // Bucket-aware convenience wrappers — callers never need to read S3_*_BUCKET / call
  // loadEnv() themselves, which also keeps them trivially mockable in unit tests (no env
  // vars required just to construct a service that depends on S3Service).

  createVerificationUploadUrl(key: string, contentType: string): Promise<PresignedUrlResult> {
    return this.createPresignedUploadUrl(this.verificationBucket, key, contentType);
  }

  createVerificationDownloadUrl(key: string): Promise<PresignedUrlResult> {
    return this.createPresignedDownloadUrl(this.verificationBucket, key);
  }

  computeVerificationDocumentSha256(key: string): Promise<string> {
    return this.computeObjectSha256(this.verificationBucket, key);
  }

  createResourceUploadUrl(key: string, contentType: string): Promise<PresignedUrlResult> {
    return this.createPresignedUploadUrl(this.resourceBucket, key, contentType);
  }

  computeResourceContentSha256(key: string): Promise<string> {
    return this.computeObjectSha256(this.resourceBucket, key);
  }
}
