"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type SentimentFilter = "all" | "red" | "yellow" | "green" | "pending";

interface FilterBarProps {
  selectedFilter: SentimentFilter;
  onFilterChange: (filter: SentimentFilter) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const filterOptions: { value: SentimentFilter; label: string; color: string }[] = [
  { value: "all", label: "All", color: "" },
  { value: "red", label: "At Risk", color: "data-[state=on]:bg-red-100 data-[state=on]:text-red-700 data-[state=on]:border-red-200" },
  { value: "yellow", label: "Attention", color: "data-[state=on]:bg-yellow-100 data-[state=on]:text-yellow-700 data-[state=on]:border-yellow-200" },
  { value: "green", label: "Healthy", color: "data-[state=on]:bg-green-100 data-[state=on]:text-green-700 data-[state=on]:border-green-200" },
  { value: "pending", label: "Pending", color: "data-[state=on]:bg-gray-100 data-[state=on]:text-gray-700 data-[state=on]:border-gray-200" },
];

export function FilterBar({
  selectedFilter,
  onFilterChange,
  searchQuery,
  onSearchChange,
}: FilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-4">
      {/* Filter Buttons */}
      <div className="flex gap-1 flex-wrap">
        {filterOptions.map((option) => (
          <Button
            key={option.value}
            variant="outline"
            size="sm"
            data-state={selectedFilter === option.value ? "on" : "off"}
            onClick={() => onFilterChange(option.value)}
            className={`
              h-8 px-3 text-xs font-medium transition-colors
              ${option.color}
              ${selectedFilter === option.value ? "border-2" : ""}
            `}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {/* Search Input */}
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search accounts..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8 pl-8 text-sm"
        />
      </div>
    </div>
  );
}
