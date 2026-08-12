/**
 * Phase 7 Sprint 7.4 — magic-byte MIME sniffing, never trusting a client-supplied
 * `Content-Type`/`mimeType` field. Scoped to exactly the 3 formats every upload flow in
 * this app's frontend actually offers (`accept="application/pdf,image/jpeg,image/png"` —
 * `apps/web/app/resources/new/page.tsx`, `profile/page.tsx`,
 * `register-organization/page.tsx`) rather than a general-purpose library — this app never
 * needs to recognize anything else, and pulling in a dependency (`file-type` is ESM-only,
 * this repo is CommonJS throughout) for 3 well-known signatures isn't worth it.
 */
export type SniffedMimeType = "application/pdf" | "image/jpeg" | "image/png" | null;

const SIGNATURES: { mimeType: SniffedMimeType; bytes: number[] }[] = [
  { mimeType: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mimeType: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mimeType: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
];

/** Returns the sniffed MIME type, or `null` if the buffer doesn't match any of the 3 known
 * signatures (including empty/truncated buffers). */
export function sniffMimeType(buffer: Buffer): SniffedMimeType {
  for (const { mimeType, bytes } of SIGNATURES) {
    if (buffer.length >= bytes.length && bytes.every((byte, i) => buffer[i] === byte)) {
      return mimeType;
    }
  }
  return null;
}
