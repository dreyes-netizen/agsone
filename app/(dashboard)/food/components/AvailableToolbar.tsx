"use client";

import { useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { FoodSortOption } from "../types";

const SORT_OPTIONS: { value: FoodSortOption; label: string }[] = [
  { value: "cutoffSoonest", label: "Closing soonest" },
  { value: "newest", label: "Newest listed" },
  { value: "priceLow", label: "Price: low to high" },
  { value: "priceHigh", label: "Price: high to low" },
];

// Sentinel used for the department Select's "All departments" item — base-ui
// Select doesn't accept an empty-string or null item value.
const ALL_DEPARTMENTS = "__all__";

interface AvailableToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  department: string | null;
  onDepartmentChange: (v: string | null) => void;
  departments: string[];
  sort: FoodSortOption;
  onSortChange: (v: FoodSortOption) => void;
}

export function AvailableToolbar(props: AvailableToolbarProps) {
  const { search, onSearchChange, department, onDepartmentChange, departments, sort, onSortChange } = props;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const showDepartmentFilter = departments.length > 1;

  const departmentSelect = (
    <Select
      value={department ?? ALL_DEPARTMENTS}
      onValueChange={(v) => onDepartmentChange(v === ALL_DEPARTMENTS ? null : v)}
    >
      <SelectTrigger aria-label="Filter by department" className="h-9 w-full sm:w-auto">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_DEPARTMENTS}>All departments</SelectItem>
        {departments.map((d) => (
          <SelectItem key={d} value={d}>{d}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const sortSelect = (
    <Select value={sort} onValueChange={(v) => onSortChange(v as FoodSortOption)}>
      <SelectTrigger aria-label="Sort listings" className="h-9 w-full sm:w-auto">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden="true" />
        <Input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search food or seller..."
          aria-label="Search food or seller"
          className="h-9 pl-8"
        />
      </div>

      {/* Desktop: inline controls */}
      <div className="hidden sm:flex items-center gap-2">
        {showDepartmentFilter && departmentSelect}
        {sortSelect}
      </div>

      {/* Mobile: collapse into a Filters dialog */}
      <button
        type="button"
        onClick={() => setFiltersOpen(true)}
        className="sm:hidden flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-command-black"
      >
        <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
        Filters
      </button>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="max-w-sm w-full rounded-2xl">
          <DialogTitle>Filters</DialogTitle>
          <DialogDescription className="sr-only">Sort and filter food listings</DialogDescription>
          <div className="space-y-4 pt-1">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block" htmlFor="mobile-food-sort">
                Sort by
              </label>
              <div id="mobile-food-sort">{sortSelect}</div>
            </div>
            {showDepartmentFilter && (
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block" htmlFor="mobile-food-department">
                  Department
                </label>
                <div id="mobile-food-department">{departmentSelect}</div>
              </div>
            )}
            <button
              onClick={() => setFiltersOpen(false)}
              className="w-full text-sm font-semibold text-white bg-command-black rounded-lg py-2 hover:bg-gray-800 transition-colors"
            >
              Done
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
