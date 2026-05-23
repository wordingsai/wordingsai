import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  detectMandatoryClauses,
  generateInitialStructure,
} from "@/services/rule-engine";
import { db } from "@/db/drizzle";
import { analysisEvents, contracts, workspaces } from "@/db/schema";

// Mock DB
const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/db/drizzle", () => ({
  db: dbMock,
}));

describe("Wordings AI V5 Pipeline Updates", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default workspace mock
    (dbMock.select as any).mockImplementation((fields: any) => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => {
        if (fields.mandatoryRegistry) {
          return Promise.resolve([
            {
              id: "ws_123",
              organizationId: "org_123",
              mandatoryRegistry: [
                {
                  name: "Termination",
                  keywords: ["terminate", "termination"],
                  category: "Termination",
                  standardText: "Standard termination clause",
                  status: "Approved",
                },
                {
                  name: "Confidentiality",
                  regex: "confidential|secrecy",
                  category: "Compliance",
                  standardText: "Standard confidentiality",
                  status: "Not Approved",
                },
              ],
            },
          ]);
        }
        return Promise.resolve([{ id: "contract_123", workspaceId: "ws_123" }]);
      }),
    }));

    dbMock.delete.mockReturnValue({ where: vi.fn().mockResolvedValue({}) });
    dbMock.insert.mockReturnValue({ values: vi.fn().mockResolvedValue({}) });
    dbMock.update.mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue({}),
    });
  });

  describe.skip("Multi-Occurrence Clause Matching (MIGRATED TO PYTHON)", () => {
    it("should detect multiple occurrences of the same clause", async () => {
      // Logic moved to backend/services/analyzer.py
    });

    it("should include library status (Approved/Not Approved) in the results", async () => {
      // Logic moved to backend/services/analyzer.py
    });
  });

  describe("Document Map & Noise Filtering", () => {
    it("should filter out noise like page numbers and OCR artifacts", () => {
      const mockDocAI = {
        text: "ARTICLE 1\nSome text here.\nPage 1 of 10\nARTICLE 2\nMore text.\n[OCR ERROR]\n775 BRE",
        pages: [
          {
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
                    textSegments: [{ startIndex: 10, endIndex: 25 }],
                  },
                },
              }, // Some text here.
              {
                layout: {
                  textAnchor: {
                    textSegments: [{ startIndex: 26, endIndex: 38 }],
                  },
                },
              }, // Page 1 of 10
              {
                layout: {
                  textAnchor: {
                    textSegments: [{ startIndex: 39, endIndex: 48 }],
                  },
                },
              }, // ARTICLE 2
              {
                layout: {
                  textAnchor: {
                    textSegments: [{ startIndex: 49, endIndex: 59 }],
                  },
                },
              }, // More text.
              {
                layout: {
                  textAnchor: {
                    textSegments: [{ startIndex: 60, endIndex: 71 }],
                  },
                },
              }, // [OCR ERROR]
              {
                layout: {
                  textAnchor: {
                    textSegments: [{ startIndex: 72, endIndex: 79 }],
                  },
                },
              }, // 775 BRE
            ],
          },
        ],
      };

      const structure = generateInitialStructure(mockDocAI);

      // Should have 2 main sections (ARTICLE 1 and ARTICLE 2)
      // Note: "ARTICLE 1" is joined with "Some text here." because it's considered an orphan label
      const sectionHeadings = structure.sections.map((s) => s.heading);
      expect(sectionHeadings[0]).toBe("ARTICLE 1 Some text here.");
      expect(sectionHeadings[1]).toBe("ARTICLE 2 More text.");

      // Noise should be filtered out of paragraphs
      const allParagraphs = structure.sections.flatMap((s) => s.paragraphs);
      expect(allParagraphs).not.toContain("Page 1 of 10");
      expect(allParagraphs).not.toContain("[OCR ERROR]");
      expect(allParagraphs).not.toContain("775 BRE");
    });

    it("should correctly identify structured headings", () => {
      const mockDocAI = {
        text: "Section 1. Definitions\nThese are the definitions.\n2.1 Payment Terms\nPay within 30 days.",
        pages: [
          {
            paragraphs: [
              {
                layout: {
                  textAnchor: {
                    textSegments: [{ startIndex: 0, endIndex: 22 }],
                  },
                },
              },
              {
                layout: {
                  textAnchor: {
                    textSegments: [{ startIndex: 23, endIndex: 49 }],
                  },
                },
              },
              {
                layout: {
                  textAnchor: {
                    textSegments: [{ startIndex: 50, endIndex: 67 }],
                  },
                },
              },
              {
                layout: {
                  textAnchor: {
                    textSegments: [{ startIndex: 68, endIndex: 87 }],
                  },
                },
              },
            ],
          },
        ],
      };

      const structure = generateInitialStructure(mockDocAI);
      expect(structure.sections[0].heading).toBe("Section 1. Definitions");
      expect(structure.sections[1].heading).toBe("2.1 Payment Terms");
    });
  });
});
