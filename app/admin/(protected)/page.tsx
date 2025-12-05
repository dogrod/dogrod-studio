import Link from "next/link";

import { PhotoFilters } from "@/components/admin/photo-filters";
import { PhotoPagination } from "@/components/admin/photo-pagination";
import { PhotoTable } from "@/components/admin/photo-table";
import { Button } from "@/components/ui/button";
import { fetchPhotoList } from "@/lib/data/photos";

type SearchParams = {
  page?: string;
  visibility?: string;
  year?: string;
};

export const dynamic = "force-dynamic";

export default async function AdminPhotosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const actualSearchParams = await searchParams;
  const page = Math.max(1, Number.parseInt(actualSearchParams.page ?? "1", 10) || 1);
  const visibilityParam = parseVisibility(actualSearchParams.visibility);
  const yearParam = parseYear(actualSearchParams.year);

  let result = await fetchPhotoList({
    page,
    visibility: visibilityParam,
    year: yearParam,
  });

  if (page > result.pages && result.total > 0) {
    result = await fetchPhotoList({
      page: result.pages,
      visibility: visibilityParam,
      year: yearParam,
    });
  }

  const { items, total, pages, availableYears, pageSize, page: resolvedPage } = result;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Photos</h1>
          <p className="text-sm text-muted-foreground">
            Upload, review, and curate dogrod Studio photo library.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/upload">Upload photos</Link>
        </Button>
      </div>

      <PhotoFilters
        visibility={visibilityParam}
        year={yearParam}
        availableYears={availableYears}
      />

      <PhotoTable photos={items} />

      <PhotoPagination
        page={resolvedPage}
        pages={pages}
        total={total}
        pageSize={pageSize}
      />
    </div>
  );
}

function parseVisibility(value: string | undefined) {
  if (value === "visible" || value === "hidden") {
    return value;
  }
  return "all" as const;
}

function parseYear(value: string | undefined) {
  if (!value) return undefined;
  const year = Number.parseInt(value, 10);
  return Number.isFinite(year) ? year : undefined;
}
