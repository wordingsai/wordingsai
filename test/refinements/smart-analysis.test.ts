import { describe, it, expect } from "vitest";
import {
  generateInitialStructure,
  normalizeText,
} from "@/services/rule-engine";

describe("Analysis Unit Logic", () => {
  describe("generateInitialStructure (Document Mapping)", () => {
    it("should correctly identify Article and Section headings", () => {
      const mockDocAI = {
        text: "ARTICLE 1\nThis is the first article.\nSECTION 2.1\nThis is a subsection.\nCLAUSE 3: Random Text.",
        pages: [
          {
            pageNumber: 1,
            paragraphs: [
              {
                layout: {
                  textAnchor: {
                    textSegments: [{ startIndex: 0, endIndex: 9 }],
                  },
                },
              }, // ARTICLE 1
              {
                layout: {
                  textAnchor: {
                    textSegments: [{ startIndex: 10, endIndex: 36 }],
                  },
                },
              }, // This is the first article.
              {
                layout: {
                  textAnchor: {
                    textSegments: [{ startIndex: 37, endIndex: 48 }],
                  },
                },
              }, // SECTION 2.1
              {
                layout: {
                  textAnchor: {
                    textSegments: [{ startIndex: 49, endIndex: 70 }],
                  },
                },
              }, // This is a subsection.
              {
                layout: {
                  textAnchor: {
                    textSegments: [{ startIndex: 71, endIndex: 93 }],
                  },
                },
              }, // CLAUSE 3: Random Text.
            ],
          },
        ],
      };

      const structure = generateInitialStructure(mockDocAI);

      expect(structure.sections.length).toBe(3);
      expect(structure.sections[0].heading).toBe("ARTICLE 1");
      expect(structure.sections[1].heading).toBe("SECTION 2.1");
      expect(structure.sections[2].heading).toBe("CLAUSE 3: Random Text.");
    });

    it("should correctly group paragraphs under the preceding heading", () => {
      const mockDocAI = {
        text: "ARTICLE 1\nPara 1.\nPara 2.\nARTICLE 2\nPara 3.",
        pages: [
          {
            pageNumber: 1,
            paragraphs: [
              {
                layout: {
                  textAnchor: {
                    textSegments: [{ startIndex: 0, endIndex: 9 }],
                  },
                },
              },
              {
                layout: {
                  textAnchor: {
                    textSegments: [{ startIndex: 10, endIndex: 17 }],
                  },
                },
              },
              {
                layout: {
                  textAnchor: {
                    textSegments: [{ startIndex: 18, endIndex: 25 }],
                  },
                },
              },
              {
                layout: {
                  textAnchor: {
                    textSegments: [{ startIndex: 26, endIndex: 35 }],
                  },
                },
              },
              {
                layout: {
                  textAnchor: {
                    textSegments: [{ startIndex: 36, endIndex: 43 }],
                  },
                },
              },
            ],
          },
        ],
      };
      const structure = generateInitialStructure(mockDocAI);
      expect(structure.sections[0].heading).toBe("ARTICLE 1");
      expect(structure.sections[0].paragraphs.length).toBe(2);
      expect(structure.sections[0].paragraphs[0]).toBe("Para 1.");
      expect(structure.sections[1].heading).toBe("ARTICLE 2");
      expect(structure.sections[1].paragraphs.length).toBe(1);
    });
  });

  describe("normalizeText (Retrieval Optimization)", () => {
    it("should strip prefixes correctly", () => {
      expect(normalizeText("Article 1: Definitions")).toBe("definitions");
      expect(normalizeText("Section 12.1.2 - Indemnity")).toBe("indemnity");
      expect(normalizeText("1. Introduction")).toBe("introduction");
    });

    it("should handle mixed case and punctuation", () => {
      expect(normalizeText("  CLAUSE 5.2 (a) --- TAXATION!!!  ")).toBe(
        "taxation",
      );
    });
  });
});
