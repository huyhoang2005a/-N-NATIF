import { loadEnv } from "@r2m/env";
import { type ScanResult, type SniffedMimeType, scanForMalware, sniffMimeType } from "@r2m/file-safety";
import { Injectable } from "@nestjs/common";

/** Phase 7 Sprint 7.4 — thin injectable wrapper around `@r2m/file-safety`'s pure functions
 * (worker has no DI so it calls them directly; apps/api wraps them here purely so
 * `verification.service.spec.ts`/`author-verification.service.spec.ts` can mock a scan
 * result instead of needing a live ClamAV connection in unit tests — same reasoning as why
 * `S3Service`/`AuditService` are injectable rather than static imports). */
@Injectable()
export class FileSafetyService {
  sniffMimeType(buffer: Buffer): SniffedMimeType {
    return sniffMimeType(buffer);
  }

  scanForMalware(buffer: Buffer): Promise<ScanResult> {
    const env = loadEnv();
    return scanForMalware(buffer, { host: env.CLAMAV_HOST, port: env.CLAMAV_PORT });
  }
}
