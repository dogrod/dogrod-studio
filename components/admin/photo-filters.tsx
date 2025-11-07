"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mergeSearchParams } from "@/lib/navigation";

type Visibility = "all" | "visible" | "hidden";

interface PhotoFiltersProps {
  visibility: Visibility;
  year: number | null;
  availableYears: number[];
}

export function PhotoFilters({ visibility, year, availableYears }: PhotoFiltersProps) {
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

  const hasFilters = visibility !== "all" || year !== null;

  const clearFilters = () => {
    applyFilter({ visibility: null, year: null });
  };

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
