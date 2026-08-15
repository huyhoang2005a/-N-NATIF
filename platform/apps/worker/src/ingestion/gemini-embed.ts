import { loadEnv } from "@r2m/env";
import { logger } from "../logger";

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 1536;

/** Plain fetch-based client, same "no SDK just for one call" choice as
 * `apps/api/src/modules/assistant/gemini.client.ts` — not reused directly since that class
 * is NestJS-`@Injectable()` and this worker has no DI container. `outputDimensionality:
 * 1536` matches the pre-existing `resource_chunk.embedding vector(1536)` column exactly, so
 * no schema migration is needed (verified live against the model — default output is 3072
 * dims without this parameter). Returns `null` (never throws) when unconfigured or on
 * failure — embedding is an enrichment step, not core ingestion safety, so a Gemini outage
 * must not fail the whole ingestion job when chunk text was already extracted successfully. */
export async function embedChunkText(content: string): Promise<number[] | null> {
  const env = loadEnv();
  if (!env.GEMINI_API_KEY) {
    return null;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${env.GEMINI_API_KEY}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { parts: [{ text: content }] },
        outputDimensionality: EMBEDDING_DIMENSIONS,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      logger.warn({ status: response.status, errorText: errorText.slice(0, 500) }, "embedChunkText: Gemini embedContent failed");
      return null;
    }

    const data = (await response.json()) as { embedding?: { values?: number[] } };
    const values = data.embedding?.values;
    if (!values || values.length !== EMBEDDING_DIMENSIONS) {
      logger.warn({ length: values?.length }, "embedChunkText: unexpected embedding dimensions");
      return null;
    }
    return values;
  } catch (error) {
    logger.warn({ err: error }, "embedChunkText: request threw");
    return null;
  }
}
