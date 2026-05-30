"use client";

import { useState, useCallback, memo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  AlertTriangle,
  FileText,
  Download,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Configure pdfjs worker. Served same-origin from /public (copied from the
// installed pdfjs-dist 5.4.296 that react-pdf@10.4.1 bundles) instead of the
// unpkg CDN — removes a cross-origin round-trip on every first render and
// avoids depending on unpkg uptime. Keep the file in sync with the dep
// version on upgrades.
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

interface PdfViewerProps {
  fileUrl: string;
  contractId: string;
}

export const PdfViewer = memo(function PdfViewer({
  fileUrl,
  contractId,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const proxyUrl =
    contractId && contractId !== "undefined"
      ? `/api/contracts/${contractId}/pdf`
      : null;

  const onDocumentLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setNumPages(numPages);
      setLoading(false);
      setError(null);
    },
    [],
  );

  const onDocumentLoadError = useCallback((err: Error) => {
    setError(err.message);
    setLoading(false);
  }, []);

  if (!fileUrl || !proxyUrl) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-black border border-dashed border-outline-variant rounded-xl text-on-surface-variant gap-4">
        <AlertTriangle className="size-12 opacity-20" />
        <p className="text-sm font-semibold uppercase tracking-widest">
          {!fileUrl ? "No PDF Source Available" : "Initializing..."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <FileText className="size-5 text-primary" />
          </div>
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wider text-primary">
              Original Document
            </h3>
            <p className="text-sm font-semibold text-on-surface uppercase tracking-tight">
              PDF Source View
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl border-outline-variant text-xs font-medium uppercase tracking-wider h-10 px-4"
          onClick={() => window.open(fileUrl, "_blank")}
        >
          <Download className="size-3 mr-2" /> Open
        </Button>
      </div>

      {/* Toolbar */}
      {!loading && !error && numPages && (
        <div className="flex items-center justify-between bg-white dark:bg-black border border-outline-variant/30 rounded-2xl px-4 py-2.5 shadow-sm">
          {/* Pagination */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-xl"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant px-2">
              {currentPage} / {numPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-xl"
              onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
              disabled={currentPage >= numPages}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          {/* Zoom & Rotate */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-xl"
              onClick={() =>
                setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)))
              }
            >
              <ZoomOut className="size-3.5" />
            </Button>
            <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant w-12 text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-xl"
              onClick={() =>
                setScale((s) => Math.min(3, +(s + 0.25).toFixed(2)))
              }
            >
              <ZoomIn className="size-3.5" />
            </Button>
            <div className="w-px h-4 bg-outline-variant mx-1" />
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-xl"
              onClick={() => setRotation((r) => (r + 90) % 360)}
            >
              <RotateCw className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* PDF Container */}
      <div
        className={cn(
          "relative min-h-[700px] lg:min-h-[900px] bg-white dark:bg-black",
          "border border-outline-variant/30 rounded-xl overflow-hidden shadow-sm",
        )}
      >
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-white dark:bg-black gap-5">
            <div className="relative size-20 flex items-center justify-center">
              <Loader2 className="absolute size-14 text-primary animate-spin" />
              <div className="size-20 rounded-full border-4 border-primary/10 border-t-primary animate-spin [animation-duration:3s]" />
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
                Loading document
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">
                Rendering PDF...
              </span>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-white dark:bg-black gap-4 text-on-surface-variant">
            <AlertTriangle className="size-12 opacity-30 text-destructive" />
            <p className="text-sm font-semibold uppercase tracking-widest">
              Failed to Load PDF
            </p>
            <p className="text-[10px] text-on-surface-variant opacity-60 max-w-xs text-center">
              {error}
            </p>
          </div>
        )}

        {/* Scrollable page area */}
        <div className="h-full overflow-auto flex flex-col items-center py-8 gap-6">
          <Document
            file={proxyUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={null}
          >
            <Page
              pageNumber={currentPage}
              scale={scale}
              rotate={rotation}
              loading={null}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="shadow-2xl"
            />
          </Document>
        </div>
      </div>
    </div>
  );
});
