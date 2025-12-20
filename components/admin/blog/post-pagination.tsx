"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

interface PostPaginationProps {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
}

export function PostPagination({
  page,
  pages,
  total,
  pageSize,
}: PostPaginationProps) {
  const searchParams = useSearchParams();

  if (pages <= 1) {
    return null;
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const buildHref = (targetPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (targetPage === 1) {
      params.delete("page");
    } else {
      params.set("page", String(targetPage));
    }
    const query = params.toString();
    return query ? `?${query}` : "/admin/blog";
  };

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        Showing {start}–{end} of {total} posts
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          asChild
          disabled={page <= 1}
        >
          <Link href={buildHref(page - 1)} aria-disabled={page <= 1}>
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Previous page</span>
          </Link>
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {page} of {pages}
        </span>
        <Button
          variant="outline"
          size="icon"
          asChild
          disabled={page >= pages}
        >
          <Link href={buildHref(page + 1)} aria-disabled={page >= pages}>
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Next page</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
