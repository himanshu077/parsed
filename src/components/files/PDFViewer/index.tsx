"use client";

import { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  FileText,
  Columns2,
  ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

type ViewMode = "single" | "double" | "all";

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.25;
const GUTTER = 32; // horizontal padding around the page(s)

export function PDFViewer({ url }: { url: string }) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [containerWidth, setContainerWidth] = useState<number>();
  const [scale, setScale] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("single");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fit-to-width base, then apply the zoom multiplier. Double mode halves it.
  const baseWidth =
    containerWidth === undefined ? undefined : containerWidth - GUTTER;
  const pageWidth =
    baseWidth === undefined
      ? undefined
      : (viewMode === "double" ? (baseWidth - 16) / 2 : baseWidth) * scale;

  const zoomIn = () => setScale((s) => Math.min(MAX_SCALE, s + SCALE_STEP));
  const zoomOut = () => setScale((s) => Math.max(MIN_SCALE, s - SCALE_STEP));
  const resetZoom = () => setScale(1);

  const renderPage = (n: number) => (
    <Page
      key={n}
      pageNumber={n}
      width={pageWidth}
      renderTextLayer
      renderAnnotationLayer
      className="shadow-sm"
    />
  );

  const modeButton = (mode: ViewMode, Icon: typeof FileText, label: string) => (
    <Button
      variant={viewMode === mode ? "secondary" : "ghost"}
      size="icon"
      className="size-7"
      onClick={() => setViewMode(mode)}
      title={label}
    >
      <Icon className="size-4" />
    </Button>
  );

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 border-b px-3 py-1.5">
        {/* View mode */}
        <div className="flex items-center gap-0.5">
          {modeButton("single", FileText, "Single page")}
          {modeButton("double", Columns2, "Two pages")}
          {modeButton("all", ScrollText, "All pages")}
        </div>

        {/* Page nav (single mode) or page count */}
        {viewMode === "single" ? (
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={pageNumber <= 1}
              onClick={() => setPageNumber((p) => p - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              Page {pageNumber} of {numPages || "—"}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={pageNumber >= numPages}
              onClick={() => setPageNumber((p) => p + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">
            {numPages || "—"} pages
          </span>
        )}

        {/* Zoom */}
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={zoomOut}
            disabled={scale <= MIN_SCALE}
          >
            <ZoomOut className="size-4" />
          </Button>
          <button
            onClick={resetZoom}
            className="w-10 text-center text-xs tabular-nums text-muted-foreground hover:text-foreground"
            title="Reset zoom"
          >
            {Math.round(scale * 100)}%
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={zoomIn}
            disabled={scale >= MAX_SCALE}
          >
            <ZoomIn className="size-4" />
          </Button>
        </div>
      </div>

      {/* Document area */}
      <div
        ref={containerRef}
        className="min-h-0 flex-1 overflow-auto bg-muted/30"
      >
        <Document
          file={url}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          loading={
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              Loading…
            </div>
          }
        >
          {pageWidth && (
            <div
              className={cn(
                "p-4",
                viewMode === "single" && "flex justify-center",
                viewMode === "all" && "flex flex-col items-center gap-4",
                viewMode === "double" &&
                  "flex flex-wrap justify-center gap-4",
              )}
            >
              {viewMode === "single"
                ? renderPage(pageNumber)
                : Array.from({ length: numPages }, (_, i) => renderPage(i + 1))}
            </div>
          )}
        </Document>
      </div>
    </div>
  );
}
