import { estimateTokens } from "./ai-router";

interface ChunkingOptions {
  maxTokens?: number;
  overlapTokens?: number;
  separator?: string;
}

/**
 * Splits text into semantic chunks based on token estimation.
 * Prioritizes splitting at double newlines (paragraphs/articles),
 * then single newlines, then spaces.
 */
export function semanticChunking(
  text: string,
  options: ChunkingOptions = {},
): string[] {
  const { maxTokens = 4000, overlapTokens = 200, separator = "\n\n" } = options;

  if (!text) return [];

  const chunks: string[] = [];
  const parts = text.split(separator);

  let currentChunk = "";
  let currentTokens = 0;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const partWithSeparator = i < parts.length - 1 ? part + separator : part;
    const partTokens = estimateTokens(partWithSeparator);

    if (partTokens > maxTokens) {
      // If a single part is too big, we must split it by single newlines
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
        currentTokens = 0;
      }

      const subParts = partWithSeparator.split("\n");
      for (const subPart of subParts) {
        const subPartWithNewline = subPart + "\n";
        const subPartTokens = estimateTokens(subPartWithNewline);

        if (currentTokens + subPartTokens > maxTokens) {
          if (currentChunk) chunks.push(currentChunk.trim());
          currentChunk = subPartWithNewline;
          currentTokens = subPartTokens;
        } else {
          currentChunk += subPartWithNewline;
          currentTokens += subPartTokens;
        }
      }
    } else if (currentTokens + partTokens > maxTokens) {
      chunks.push(currentChunk.trim());

      // Handle overlap: take a portion of the end of the previous chunk if possible
      const overlapText = currentChunk.slice(-overlapTokens * 4); // rough estimate
      currentChunk = overlapText + partWithSeparator;
      currentTokens = estimateTokens(currentChunk);
    } else {
      currentChunk += partWithSeparator;
      currentTokens += partTokens;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
