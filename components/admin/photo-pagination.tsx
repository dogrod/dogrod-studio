"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { mergeSearchParams } from "@/lib/navigation";

interface PhotoPaginationProps {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
}

export function PhotoPagination({ page, pages, total, pageSize }: PhotoPaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const goToPage = (next: number) => {
    const query = mergeSearchParams(
      searchParams,
      { page: next <= 1 ? null : next },
      { resetPage: false },
    );
    router.push(`${pathname}${query}`);
  };

  const hasPrevious = page > 1;
  const hasNext = page < pages;
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col items-center justify-between gap-4 border-t pt-4 text-sm text-muted-foreground sm:flex-row">
      <p>
        Showing <span className="font-medium text-foreground">{start}</span>–
        <span className="font-medium text-foreground">{end}</span> of
        <span className="font-medium text-foreground"> {total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(page - 1)}
          disabled={!hasPrevious}
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Previous
        </Button>
        <span>
          Page <span className="font-medium text-foreground">{page}</span> of
          <span className="font-medium text-foreground"> {pages}</span>
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(page + 1)}
          disabled={!hasNext}
        >
          Next <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
