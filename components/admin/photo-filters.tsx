"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ArrowDownAZ, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mergeSearchParams } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type Visibility = "all" | "visible" | "hidden";
type SortBy = "added" | "taken";

interface PhotoFiltersProps {
  visibility: Visibility;
  year: number | null | undefined;
  availableYears: number[];
  sortBy: SortBy;
}

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "added", label: "Date added" },
  { value: "taken", label: "Date taken" },
];

export function PhotoFilters({ visibility, year, availableYears, sortBy }: PhotoFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const applyFilter = (updates: Record<string, string | number | null | undefined>) => {
    startTransition(() => {
      const query = mergeSearchParams(searchParams, updates, { resetPage: true });
      router.push(`${pathname}${query}`);
    });
  };

  const handleVisibilityChange = (value: string) => {
    applyFilter({ visibility: value === "all" ? null : value });
  };

  const handleYearChange = (value: string) => {
    applyFilter({ year: value === "all" ? null : value });
  };

  const handleSortChange = (value: SortBy) => {
    applyFilter({ sort: value === "added" ? null : value });
  };

  const hasFilters = visibility !== "all" || year != null;

  const clearFilters = () => {
    applyFilter({ visibility: null, year: null });
  };

  const currentSortLabel = SORT_OPTIONS.find((opt) => opt.value === sortBy)?.label ?? "Date added";

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Select value={visibility} onValueChange={handleVisibilityChange} disabled={isPending}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Visibility" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All visibility</SelectItem>
          <SelectItem value="visible">Visible only</SelectItem>
          <SelectItem value="hidden">Hidden only</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={year ? String(year) : "all"}
        onValueChange={handleYearChange}
        disabled={isPending || availableYears.length === 0}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All years</SelectItem>
          {availableYears.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={isPending}>
          <Button variant="outline" className="gap-2">
            <ArrowDownAZ className="h-4 w-4" />
            <span>{currentSortLabel}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {SORT_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleSortChange(option.value)}
              className="gap-2"
            >
              <Check
                className={cn(
                  "h-4 w-4",
                  sortBy === option.value ? "opacity-100" : "opacity-0",
                )}
              />
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {hasFilters && (
        <Button
          variant="ghost"
          className="text-sm"
          onClick={clearFilters}
          disabled={isPending}
        >
          Reset filters
        </Button>
      )}
    </div>
  );
}
