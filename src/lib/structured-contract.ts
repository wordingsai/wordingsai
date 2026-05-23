/**
 * Contract document map types and pure helpers.
 * Safe for Client Components — no Node/GCP/AI imports.
 */

export interface StructuredContract {
  title: string | null;
  sections: Array<{
    heading: string;
    number: string | null;
    subsections: Array<{
      heading: string;
      number: string | null;
      paragraphs: string[];
    }>;
    paragraphs: string[];
  }>;
}

const FALLBACK_HEADINGS = new Set([
  "Unstructured Extract",
  "Extraction Failed (Partial)",
  "Raw Text",
  "Extracted Text",
  "Main Text",
]);

export function isFallbackSectionHeading(
  heading: string | null | undefined,
): boolean {
  if (!heading?.trim()) return true;
  return FALLBACK_HEADINGS.has(heading.trim());
}

export function isQualityStructuredMap(
  map: StructuredContract | null | undefined,
): boolean {
  if (!map?.sections?.length) return false;
  const real = map.sections.filter(
    (s) => s.heading && !isFallbackSectionHeading(s.heading),
  );
  return real.length > 0;
}

/** Headings shown in the document map outline (sections + subsections, excluding fallbacks). */
export function countDocumentMapHeadings(
  map: StructuredContract | null | undefined,
): number {
  if (!map?.sections?.length) return 0;
  let count = 0;
  for (const section of map.sections) {
    if (section.heading && !isFallbackSectionHeading(section.heading)) {
      count += 1;
    }
    for (const sub of section.subsections || []) {
      if (sub.heading && !isFallbackSectionHeading(sub.heading)) {
        count += 1;
      }
    }
  }
  return count;
}

export function sanitizeStructuredMap(
  map: StructuredContract,
): StructuredContract {
  const sections = (map.sections || []).filter(
    (s) => s.heading && !isFallbackSectionHeading(s.heading),
  );
  if (sections.length > 0) {
    return { title: map.title, sections };
  }
  return map;
}
