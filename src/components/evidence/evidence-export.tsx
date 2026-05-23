"use client";

import React from "react";
import type { StructuredEvidenceResult } from "@/types/evidence";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";

interface EvidenceExportProps {
  evidence: StructuredEvidenceResult | null;
  contractName?: string;
  ruleName?: string;
}

export function EvidenceExport({
  evidence,
  contractName = "Contract",
  ruleName = "Rule",
}: EvidenceExportProps) {
  const generateHTML = () => {
    if (!evidence) return "";

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${contractName} - ${ruleName} Evidence Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #fafafa;
            padding: 40px 20px;
        }
        .container { max-width: 900px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 40px; }
        h1 { font-size: 28px; margin-bottom: 10px; color: #000; }
        .meta { font-size: 14px; color: #666; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #eee; }
        .meta p { margin: 5px 0; }
        .status-header {
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
            border-left: 4px solid;
        }
        .status-header.green { background: #ecfdf5; border-color: #10b981; }
        .status-header.amber { background: #fffbeb; border-color: #f59e0b; }
        .status-header.red { background: #fef2f2; border-color: #ef4444; }
        .status-header h3 { margin-bottom: 10px; font-size: 18px; }
        .status-header p { font-size: 14px; color: #666; }
        .stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-box {
            padding: 15px;
            background: #f5f5f5;
            border-radius: 6px;
            border: 1px solid #ddd;
        }
        .stat-box .label { font-size: 12px; text-transform: uppercase; color: #999; font-weight: 600; letter-spacing: 0.5px; }
        .stat-box .value { font-size: 28px; font-weight: bold; color: #2563eb; margin-top: 8px; }
        .section {
            margin-bottom: 30px;
        }
        .section-title {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #2563eb;
            color: #1f2937;
        }
        .evidence-item {
            margin-bottom: 20px;
            padding: 15px;
            background: #fafafa;
            border-left: 3px solid #2563eb;
            border-radius: 4px;
        }
        .evidence-text {
            font-size: 14px;
            line-height: 1.7;
            margin-bottom: 12px;
            font-style: italic;
            color: #555;
        }
        .evidence-meta {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin-bottom: 10px;
        }
        .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
        }
        .badge-type { background: #dbeafe; color: #1e40af; }
        .badge-match { background: #d1fae5; color: #047857; }
        .badge-confidence { background: #fef3c7; color: #92400e; }
        .source-text {
            font-size: 12px;
            background: white;
            border: 1px solid #ddd;
            padding: 10px;
            border-radius: 4px;
            font-family: 'Monaco', 'Courier New', monospace;
            color: #666;
            margin-top: 10px;
            overflow-x: auto;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 12px;
            color: #999;
        }
        @media (max-width: 600px) {
            .stats { grid-template-columns: repeat(2, 1fr); }
            .container { padding: 20px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${contractName}</h1>
        <div class="meta">
            <p><strong>Rule:</strong> ${ruleName}</p>
            <p><strong>Evaluated:</strong> ${new Date(evidence.evaluatedAt).toLocaleString()}</p>
            ${evidence.confidence ? `<p><strong>Confidence:</strong> ${(evidence.confidence * 100).toFixed(0)}%</p>` : ""}
        </div>

        <div class="status-header ${evidence.status.toLowerCase()}">
            <h3>Status: ${evidence.status}</h3>
            <p>${evidence.reasoning}</p>
        </div>

        <div class="stats">
            <div class="stat-box">
                <div class="label">Total Evidence</div>
                <div class="value">${evidence.statistics.totalEvidence}</div>
            </div>
            <div class="stat-box">
                <div class="label">Matched</div>
                <div class="value">${evidence.statistics.matchedToLibrary}</div>
            </div>
            <div class="stat-box">
                <div class="label">Sections</div>
                <div class="value">${evidence.statistics.totalSections}</div>
            </div>
            <div class="stat-box">
                <div class="label">Avg Confidence</div>
                <div class="value">${(evidence.statistics.averageConfidence * 100).toFixed(0)}%</div>
            </div>
        </div>

        ${evidence.groupedEvidence
          .map(
            (group) => `
        <div class="section">
            <h3 class="section-title">${group.section}</h3>
            ${group.items
              .map(
                (item) => `
            <div class="evidence-item">
                <p class="evidence-text">"${item.text}"</p>
                <div class="evidence-meta">
                    <span class="badge badge-type">${item.clauseType}</span>
                    <span class="badge badge-confidence">${(item.matchConfidence * 100).toFixed(0)}% match</span>
                    ${item.libraryClauseId ? '<span class="badge badge-match">✓ Linked to library</span>' : ""}
                </div>
                ${item.source?.chunk ? `<div class="source-text"><strong>Source:</strong> ${item.source.chunk}</div>` : ""}
            </div>
            `,
              )
              .join("")}
        </div>
        `,
          )
          .join("")}

        <div class="footer">
            <p>Generated by Wordings AI • ${new Date().toLocaleString()}</p>
        </div>
    </div>
</body>
</html>
    `;

    return html;
  };

  const downloadHTML = () => {
    const html = generateHTML();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${contractName}-${ruleName}-evidence-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const printHTML = () => {
    const html = generateHTML();
    const printWindow = window.open("", "", "width=900,height=800");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
    }
  };

  if (!evidence) {
    return null;
  }

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={downloadHTML}
        className="gap-2"
      >
        <Download className="w-4 h-4" />
        Export HTML
      </Button>
      <Button variant="outline" size="sm" onClick={printHTML} className="gap-2">
        <FileText className="w-4 h-4" />
        Print
      </Button>
    </div>
  );
}
