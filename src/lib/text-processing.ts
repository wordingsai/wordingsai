/**
 * Unified text chunking utility for Wordings AI.
 */

export interface DocumentChunk {
  content: string;
  sourceFileName?: string;
}

/**
 * Splits a long text into smaller chunks for embedding and analysis.
 * Preserves paragraph structure where possible.
 *
 * @param text The full text to chunk
 * @param sourceFileName Optional filename to associate with each chunk
 * @param maxChunkSize Maximum character length for a single chunk
 * @returns Array of DocumentChunk objects
 */
export function chunkText(
  text: string,
  sourceFileName?: string,
  maxChunkSize: number = 4000,
): DocumentChunk[] {
  if (!text?.trim()) return [];

  // First split by double newlines for clear paragraph separation
  // Filter out very short noise (< 15 chars)
  const initialParagraphs = text
    .split(/\n\s*\n/)
    .filter((p) => p.trim().length > 15);

  const paragraphs: string[] = [];

  // For each large paragraph, if it still exceeds maxChunkSize, split it by single newlines
  for (const p of initialParagraphs) {
    if (p.length > maxChunkSize) {
      const subParagraphs = p
        .split(/\n/)
        .filter((line) => line.trim().length > 0);
      paragraphs.push(...subParagraphs);
    } else {
      paragraphs.push(p);
    }
  }

  const chunks: DocumentChunk[] = [];
  let currentAccumulator = "";

  for (const para of paragraphs) {
    if (
      (currentAccumulator + para).length > maxChunkSize &&
      currentAccumulator
    ) {
      chunks.push({
        content: currentAccumulator.trim(),
        sourceFileName,
      });
      currentAccumulator = para;
    } else {
      currentAccumulator += (currentAccumulator ? "\n\n" : "") + para;
    }

    // Safety split for extremely long lines that don't have newlines
    while (currentAccumulator.length > maxChunkSize * 1.5) {
      chunks.push({
        content: currentAccumulator.substring(0, maxChunkSize).trim(),
        sourceFileName,
      });
      currentAccumulator = currentAccumulator.substring(maxChunkSize).trim();
    }
  }

  if (currentAccumulator.trim()) {
    chunks.push({
      content: currentAccumulator.trim(),
      sourceFileName,
    });
  }

  return chunks;
}
