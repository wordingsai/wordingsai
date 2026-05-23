export function mdToPlain(md: string): string {
  if (!md) return "";
  let s = md;

  // Replace common page break markers with double newlines
  s = s.replace(/<!--\s*PAGE_BREAK\s*-->/gi, "\n\n");
  s = s.replace(/--- DOCUMENT: .*? ---/g, "\n\n");

  // Links: [text](url) -> text
  s = s.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");

  // Images: ![alt](url) -> alt
  s = s.replace(/!\[([^\]]*)\]\([^\)]+\)/g, "$1");

  // Remove MD headings (keep the text)
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, "");

  // Bold/italic/inline code markers
  s = s.replace(/\*\*(.*?)\*\*/g, "$1");
  s = s.replace(/__(.*?)__/g, "$1");
  s = s.replace(/\*(.*?)\*/g, "$1");
  s = s.replace(/_(.*?)_/g, "$1");
  s = s.replace(/`{1,3}([^`]+)`{1,3}/g, "$1");

  // Remove list markers
  s = s.replace(/^\s*[-*+]\s+/gm, "");
  s = s.replace(/^\s*\d+\.\s+/gm, "");
  s = s.replace(/•/g, "");

  // Remove HTML comments
  s = s.replace(/<!--([\s\S]*?)-->/g, "");

  // Collapse multiple blank lines to two
  s = s.replace(/\n{3,}/g, "\n\n");

  // Trim
  return s.trim();
}
