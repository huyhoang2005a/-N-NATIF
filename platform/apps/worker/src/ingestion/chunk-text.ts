const TARGET_CHUNK_CHARS = 1200;
const MAX_CHUNK_CHARS = 1800;

export interface TextChunk {
  chunkIndex: number;
  content: string;
  tokenCount: number;
}

/** Spec item 13: "chunk nội dung". Paragraph-aware — merges consecutive paragraphs up to
 * `TARGET_CHUNK_CHARS`, splits any single paragraph longer than `MAX_CHUNK_CHARS` on
 * sentence boundaries so no chunk ever cuts mid-sentence except as a last resort for a
 * single run-on sentence longer than the max itself. `tokenCount` is a rough estimate
 * (chars/4, the standard approximation for English/Vietnamese Latin-script text) — this
 * schema column is informational only, nothing downstream enforces an exact token budget. */
export function chunkText(text: string): TextChunk[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);

  const rawChunks: string[] = [];
  let buffer = "";
  for (const paragraph of paragraphs) {
    const pieces = paragraph.length > MAX_CHUNK_CHARS ? splitLongParagraph(paragraph) : [paragraph];
    for (const piece of pieces) {
      if (buffer.length > 0 && buffer.length + piece.length + 1 > TARGET_CHUNK_CHARS) {
        rawChunks.push(buffer);
        buffer = piece;
      } else {
        buffer = buffer.length > 0 ? `${buffer} ${piece}` : piece;
      }
    }
  }
  if (buffer.length > 0) rawChunks.push(buffer);

  return rawChunks.map((content, index) => ({
    chunkIndex: index,
    content,
    tokenCount: Math.ceil(content.length / 4),
  }));
}

function splitLongParagraph(paragraph: string): string[] {
  const sentences = paragraph.split(/(?<=[.!?])\s+/);
  const pieces: string[] = [];
  let buffer = "";
  for (const sentence of sentences) {
    if (buffer.length > 0 && buffer.length + sentence.length + 1 > MAX_CHUNK_CHARS) {
      pieces.push(buffer);
      buffer = sentence;
    } else {
      buffer = buffer.length > 0 ? `${buffer} ${sentence}` : sentence;
    }
  }
  if (buffer.length > 0) pieces.push(buffer);
  return pieces;
}
