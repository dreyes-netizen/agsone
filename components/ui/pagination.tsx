"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  pages: number;
  total?: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pages, total, onPageChange }: PaginationProps) {
  if (pages <= 1) return null;

  const pageNumbers: (number | "...")[] = [];
  if (pages <= 7) {
    for (let i = 1; i <= pages; i++) pageNumbers.push(i);
  } else {
    pageNumbers.push(1);
    if (page > 3) pageNumbers.push("...");
    for (
      let i = Math.max(2, page - 1);
      i <= Math.min(pages - 1, page + 1);
      i++
    ) {
      pageNumbers.push(i);
    }
    if (page < pages - 2) pageNumbers.push("...");
    pageNumbers.push(pages);
  }

  return (
    <div className="flex items-center justify-center gap-1">
      <button
        aria-label="Previous page"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="p-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pageNumbers.map((num, i) =>
        num === "..." ? (
          <span key={`ellipsis-${i}`} className="px-1.5 text-sm text-muted-foreground">
            ...
          </span>
        ) : (
          <button
            key={num}
            aria-label={`Go to page ${num}`}
            aria-current={num === page ? "page" : undefined}
            onClick={() => onPageChange(num)}
            className={`px-3 py-1.5 text-sm border rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring ${
              num === page
                ? "bg-primary text-primary-foreground border-primary"
                : "hover:bg-muted"
            }`}
          >
            {num}
          </button>
        )
      )}
      <button
        aria-label="Next page"
        onClick={() => onPageChange(Math.min(pages, page + 1))}
        disabled={page === pages}
        className="p-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      {total !== undefined && (
        <span className="ml-2 text-sm text-muted-foreground">{total} total</span>
      )}
    </div>
  );
}
