// Import the lib path directly, NOT the package root (`pdf-parse`) — 1.1.1's `index.js` has
// a `let isDebugMode = !module.parent` self-test block that reads a bundled sample PDF
// (`./test/data/05-versions-space.pdf`, relative to CWD) when that check is truthy. It's
// meant to detect "run directly via `node index.js`", but vitest's module loader trips it
// too, crashing every test that imports this module with an ENOENT for a fixture file this
// repo never had (it belongs to the pdf-parse package's own test suite, not ours). The lib
// path is the exact same function `index.js` re-exports (`module.exports = require('./lib/
// pdf-parse.js')`) minus that debug wrapper — zero behavior change, just skips the bug.
import pdfParse from "pdf-parse/lib/pdf-parse.js";

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
