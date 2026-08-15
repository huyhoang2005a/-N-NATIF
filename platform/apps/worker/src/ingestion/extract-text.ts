import pdfParse from "pdf-parse";

/** Spec item 13 (`01_workflow_theo_phase.md` §Phase 2): "extract text từ file". Only PDF
 * carries extractable text among the 3 MIME types `sniffMimeType` accepts (PDF/JPEG/PNG) —
 * images have no text layer, so `extractText` returns `null` for them (not an error, just
 * nothing to chunk). Pinned to `pdf-parse@1.1.1` deliberately — v2 is ESM-only and requires
 * a heavier `new PDFParse(...).getText()` API pulling in pdfjs-dist/canvas; v1's plain
 * `pdfParse(buffer) -> { text }` matches this repo's CommonJS-throughout convention (see
 * the comment in `packages/file-safety/src/sniff-mime-type.ts` for the same rationale). */
export async function extractText(buffer: Buffer, mimeType: string): Promise<string | null> {
  if (mimeType !== "application/pdf") {
    return null;
  }
  const parsed = await pdfParse(buffer);
  const text = parsed.text.trim();
  return text.length > 0 ? text : null;
}
