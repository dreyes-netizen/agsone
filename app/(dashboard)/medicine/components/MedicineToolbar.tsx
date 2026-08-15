"use client";

import { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SORT_OPTIONS, type SortOption } from "../types";

interface MedicineToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  sort: SortOption;
  onSortChange: (v: SortOption) => void;
  availableOnly: boolean;
  onAvailableOnlyChange: (v: boolean) => void;
}

function FilterToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-command-black ${
        active
          ? "bg-navy-50 border-navy-200 text-navy-700"
          : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );
}

export function MedicineToolbar({
  search,
  onSearchChange,
  sort,
  onSortChange,
  availableOnly,
  onAvailableOnlyChange,
}: MedicineToolbarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden="true" />
        <Input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search medicines..."
          aria-label="Search medicines"
          className="h-9 pl-8"
        />
      </div>

      {/* Desktop: inline controls */}
      <div className="hidden sm:flex items-center gap-2">
        <FilterToggle label="Available only" active={availableOnly} onClick={() => onAvailableOnlyChange(!availableOnly)} />
        <Select value={sort} onValueChange={(v) => onSortChange(v as SortOption)}>
          <SelectTrigger aria-label="Sort medicines" className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Mobile: Filters button opening a dialog */}
      <button
        type="button"
        onClick={() => setFiltersOpen(true)}
        className="sm:hidden relative flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-command-black"
      >
        <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
        Filters
        {availableOnly && (
          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-command-black text-white text-[10px] font-bold flex items-center justify-center">
            1
          </span>
        )}
      </button>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="max-w-sm w-full rounded-2xl">
          <DialogTitle>Filters</DialogTitle>
          <DialogDescription className="sr-only">Sort and filter the medicines you can browse</DialogDescription>
          <div className="space-y-4 pt-1">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block" htmlFor="mobile-medicine-sort">
                Sort by
              </label>
              <Select value={sort} onValueChange={(v) => onSortChange(v as SortOption)}>
                <SelectTrigger id="mobile-medicine-sort" className="w-full h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterToggle label="Available only" active={availableOnly} onClick={() => onAvailableOnlyChange(!availableOnly)} />
            </div>
            <div className="flex gap-2 pt-1">
              {availableOnly && (
                <button
                  onClick={() => onAvailableOnlyChange(false)}
                  className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg py-2 hover:bg-gray-50 transition-colors"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                  Clear filters
                </button>
              )}
              <button
                onClick={() => setFiltersOpen(false)}
                className="flex-1 text-sm font-semibold text-white bg-command-black rounded-lg py-2 hover:bg-gray-800 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
