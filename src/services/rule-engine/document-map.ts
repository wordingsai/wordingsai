/**
 * Document-map construction from Document AI output and coordinate lookup for
 * verbatim evidence. Extracted verbatim from the original
 * src/services/rule-engine.ts during modularization (no logic changes).
 */
import type { StructuredContract } from "@/lib/structured-contract";
import type { RuleDefinition } from "./types";

export function generateInitialStructure(docAI: any): StructuredContract {
  if (!docAI || !docAI.text) {
    return {
      title: "Document Content",
      sections: [
        {
          heading: "Main Text",
          number: null,
          subsections: [],
          paragraphs: ["No text extracted."],
        },
      ],
    };
  }

  const sections: any[] = [];

  // Strict noise filtering regexes for general OCR and MRC specific headers
  const NOISE_PATTERNS = [
    /^\s*page\s+\d+\s*$/i,
    /^\s*page\s+\d+\s*of(\s+\d+)?\s*$/i,
    /^\s*\d+\s+of\s+\d+\s*$/i,
    /^\s*wordings\s+ai\s+confidential\s*$/i,
    /^\s*\(c\)\s+\d{4}.*$/i,
    /^\s*ocr\s+error.*$/i,
    /^\s*\[ocr\s+error.*\]\s*$/i,
    /^\s*registration\s+no\.\s+[A-Z0-9]+\s*$/i,
    /^\s*\d+\s+[A-Z]{2,4}\s*$/i, // e.g. "775 BRE"
    /^\s*[\d\.\s\-]{1,10}$/, // Just numbers/dots/hyphens
    /^\s*[a-zA-Z]\s*$/, // Single character noise
    /^\s*market\s*reform\s*contract.*$/i,
    /^\s*risk\s*details\s*section.*$/i,
    /^\s*unique\s*market.*$/i,
    /^\s*taxes\s*payable.*$/i,
    /^\s*security\s*details.*$/i,
    /^\s*subscription\s*agreement.*$/i,
    /^\s*fiscal\s*and\s*regulatory.*$/i,
    /^\s*broker\s*remuneration.*$/i,
    /^\s*basis\s*of\s*(written|agreement).*$/i,
    /^\s*client\s*requirement.*$/i,
    /^\s*policy\s*number.*$/i,
    /^\s*expiring\s*policy.*$/i,
    /^\s*information\s*page\s*$/i,
    /^\s*claims\s*agreement.*$/i,
    /^[_\-\.]{5,}$/, // Horizontal lines or separators
    /^\s*[0-9A-Z]{2,}\s+[0-9A-Z]{2,}\s+[0-9A-Z]{2,}\s*$/i, // Suspiciously spaced caps
    /^\s*confidential\s*$/i,
    /Willis\s*Re\s*I{1,3}/i,
    /Willis\s*Limited/i,
    /Lloyd's\s*broker/i,
    /Registered\s*Office:/i,
    /Registered\s*Number/i,
    /Guy\s*Carpenter/i,
    /Aon\s*UK\s*Limited/i,
    /Paul\s*Smith\/LSR/i,
    /<<Authorised\s*Dt>>/i,
    /LR\/Date\s*created/i,
    /JLT\s*Page/i,
  ];

  function cleanText(text: string): string {
    if (!text) return "";
    let cleaned = text;

    // 1. Remove non-printable characters
    cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");

    // 2. Remove common OCR artifacts (random single characters or symbols isolated by spaces)
    // e.g. "A article B" -> "article" (if A and B are noise)
    // But we must be careful with legitimate single-char words like "a" or "I"
    // More focus on symbols: ~ | _ \ / [ ] { }
    cleaned = cleaned.replace(/(^|\s)[~|\\\/_{}\[\]](\s|$)/g, " ");

    // 3. Remove duplicated dots/hyphens/underscores often found in OCR
    cleaned = cleaned.replace(/\.{2,}/g, ".");
    cleaned = cleaned.replace(/-{2,}/g, "-");
    cleaned = cleaned.replace(/_{2,}/g, "_");

    // 4. Clean up whitespace
    cleaned = cleaned.replace(/\s+/g, " ").trim();

    return cleaned;
  }

  function isNoise(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) return true;

    // If it's just a single character that isn't a digit or 'a'/'i', it's noise
    if (
      trimmed.length === 1 &&
      !/[0-9ai]/i.test(trimmed) &&
      !/^[A-Z]$/.test(trimmed)
    )
      return true;

    // Reject lines that are strictly page numbers or "Page X of Y"
    if (/^\d+$/.test(trimmed)) return true;
    if (/^page\s+\d+$/i.test(trimmed)) return true;
    if (/^page\s+\d+\s+of\s+\d+$/i.test(trimmed)) return true;

    // Filter out long strings of non-alphanumeric characters
    if (/^[^a-zA-Z0-9]{2,}$/.test(trimmed)) return true;

    // Reject short lines that are strictly page headers/footers (UMR, etc)
    if (trimmed.length < 50) {
      const lower = trimmed.toLowerCase();
      // Common MRC Header noise
      if (
        lower === "unique market reference" ||
        lower === "umr" ||
        lower === "type"
      )
        return true;
      if (lower.includes("page") && lower.includes("of")) return true;
      if (lower === "confidential") return true;
    }

    // Pattern-based noise
    return NOISE_PATTERNS.some((pattern) => pattern.test(trimmed));
  }

  // Use entities if available (Document AI specialized parsers)
  if (docAI.entities && docAI.entities.length > 0) {
    const sortedEntities = [...docAI.entities].sort((a, b) => {
      const aStart = a.textAnchor?.textSegments?.[0]?.startIndex || 0;
      const bStart = b.textAnchor?.textSegments?.[0]?.startIndex || 0;
      return aStart - bStart;
    });

    let currentSection: any = null;
    for (const entity of sortedEntities) {
      const type = entity.type?.toLowerCase() || "";
      const rawText = entity.mentionText || entity.text || "";
      if (!rawText || isNoise(rawText)) continue;

      const text = cleanText(rawText);
      if (!text) continue;

      const isHeadingType =
        type.includes("heading") ||
        type.includes("header") ||
        type.includes("title") ||
        type.includes("article_number") ||
        type.includes("section_number");

      if (isHeadingType) {
        currentSection = {
          heading: text,
          number: null,
          subsections: [],
          paragraphs: [],
        };
        sections.push(currentSection);
      } else if (currentSection) {
        currentSection.paragraphs.push(text);
      } else {
        currentSection = {
          heading: "Introduction",
          number: null,
          subsections: [],
          paragraphs: [text],
        };
        sections.push(currentSection);
      }
    }
  } else if (docAI.pages) {
    let currentSection: any = null;
    let pendingLabel: string | null = null;

    for (const page of docAI.pages) {
      if (page.paragraphs) {
        for (const para of page.paragraphs) {
          const start = Number(
            para.layout?.textAnchor?.textSegments?.[0]?.startIndex || 0,
          );
          const end = Number(
            para.layout?.textAnchor?.textSegments?.[0]?.endIndex || 0,
          );
          let rawParaText = docAI.text.substring(start, end);

          if (!rawParaText || isNoise(rawParaText)) continue;

          let paraText = cleanText(rawParaText);
          if (!paraText) continue;

          // Logic to join orphan labels like (a), (b), or "Section 1"
          const isOrphanLabel = /^\s*(\([a-z0-9]\)|[a-z0-9]\))\s*$/i.test(
            paraText,
          );
          if (isOrphanLabel) {
            pendingLabel = paraText;
            continue;
          }

          if (pendingLabel) {
            paraText = pendingLabel + " " + paraText;
            pendingLabel = null;
          }

          // Strict heading detection
          const wordCount = paraText.split(/\s+/).length;
          const isAlphaNumericCode = /^[A-Z0-9]{8,}$/.test(paraText);

          const isArticleStyle =
            /^(article|section|clause|provision|item|schedule|annex|appendix|risk\s+details|subscription\s+agreement|information\s+page|fiscal\s+and\s+regulatory|security\s+details|broker\s+remuneration|premium|conditions|period|class\s+of\s+business|limits|unique\s+market|reinsured|type)\s*([0-9a-z\.]+)?/i.test(
              paraText,
            );

          const isNumberedHeading = /^\d+(\.\d+)*[\.\s]+[A-Z]/.test(paraText);

          const isAllcapsHeading =
            /^[^a-z]{3,100}$/.test(paraText) &&
            /[A-Z]/.test(paraText) &&
            wordCount < 10;

          const isHeading =
            (isArticleStyle || isNumberedHeading || isAllcapsHeading) &&
            !isAlphaNumericCode &&
            paraText.length < 150 &&
            wordCount < 22 &&
            (!paraText.includes(":") ||
              paraText.split(":").shift()?.split(/\s+/).length! < 4) &&
            !/\b(agrees|shall|will|hereby|between|referred|witnesseth|if\s+applicable|with\s+the\s+terms)\b/i.test(
              paraText,
            );

          if (isHeading) {
            const numberMatch = paraText.match(/\d+(\.\d+)*/);
            currentSection = {
              heading: paraText,
              number: numberMatch ? numberMatch[0] : null,
              subsections: [],
              paragraphs: [],
            };
            sections.push(currentSection);
          } else {
            if (!currentSection) {
              currentSection = {
                heading: "General Provisions",
                number: null,
                subsections: [],
                paragraphs: [],
              };
              sections.push(currentSection);
            }
            currentSection.paragraphs.push(paraText);
          }
        }
      }
    }
  }

  // Final cleanup: remove empty sections or those that are just noise
  const filteredSections = sections.filter(
    (s) => s.paragraphs.length > 0 || (s.heading && !isNoise(s.heading)),
  );

  if (filteredSections.length === 0) {
    return {
      title: "Initial Extraction Map",
      sections: [
        {
          heading: "Extracted Text",
          number: null,
          subsections: [],
          paragraphs: [docAI.text.substring(0, 20000)],
        },
      ],
    };
  }

  return {
    title: "Document Map",
    sections: filteredSections,
  };
}

export function findCoordinatesForSubstring(
  structuredJSON: any,
  substring: string,
) {
  if (!structuredJSON || !structuredJSON.text || !substring) return null;

  const docText = structuredJSON.text;
  const startIndex = docText.indexOf(substring);
  if (startIndex === -1) return null;
  const endIndex = startIndex + substring.length;

  const results: any[] = [];

  // Iterate through pages to find bounding boxes that overlap with the substring range
  if (structuredJSON.pages) {
    for (const page of structuredJSON.pages) {
      const pageNum = page.pageNumber;

      // Look into tokens/lines/paragraphs/blocks. Lines are usually a good balance of detail.
      if (page.lines) {
        for (const line of page.lines) {
          const segments = line.layout?.textAnchor?.textSegments || [];
          for (const seg of segments) {
            const segStart = Number(seg.startIndex || 0);
            const segEnd = Number(seg.endIndex || 0);

            // Check for overlap
            if (
              (segStart >= startIndex && segStart < endIndex) ||
              (segEnd > startIndex && segEnd <= endIndex) ||
              (segStart <= startIndex && segEnd >= endIndex)
            ) {
              results.push({
                page: pageNum,
                boundingPoly: line.layout.boundingPoly,
                confidence: line.layout.confidence,
              });
            }
          }
        }
      }
    }
  }

  // Aggregate results by page
  const pageMap = new Map<number, any[]>();
  for (const res of results) {
    if (!pageMap.has(res.page)) pageMap.set(res.page, []);
    pageMap.get(res.page)!.push(res.boundingPoly);
  }

  return Array.from(pageMap.entries()).map(([page, polys]) => ({
    page,
    polygons: polys,
  }));
}
