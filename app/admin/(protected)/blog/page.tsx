import Link from "next/link";

import { PostFilters } from "@/components/admin/blog/post-filters";
import { PostPagination } from "@/components/admin/blog/post-pagination";
import { PostTable } from "@/components/admin/blog/post-table";
import { Button } from "@/components/ui/button";
import { fetchPostList } from "@/lib/data/posts";
import type { ContentStatus } from "@/types/posts";

type SearchParams = {
  page?: string;
  status?: string;
  sort?: string;
};

export const dynamic = "force-dynamic";

export default async function BlogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const actualSearchParams = await searchParams;
  const page = Math.max(1, Number.parseInt(actualSearchParams.page ?? "1", 10) || 1);
  const statusParam = parseStatus(actualSearchParams.status);
  const sortParam = parseSort(actualSearchParams.sort);

  let result = await fetchPostList({
    page,
    status: statusParam,
    sortBy: sortParam,
  });

  if (page > result.pages && result.total > 0) {
    result = await fetchPostList({
      page: result.pages,
      status: statusParam,
      sortBy: sortParam,
    });
  }

  const { items, total, pages, pageSize, page: resolvedPage } = result;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Blog</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage blog posts for dogrod Studio.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/blog/new">New post</Link>
        </Button>
      </div>

      <PostFilters status={statusParam} sortBy={sortParam} />

      <PostTable posts={items} />

      <PostPagination
        page={resolvedPage}
        pages={pages}
        total={total}
        pageSize={pageSize}
      />
    </div>
  );
}

function parseStatus(value: string | undefined): "all" | ContentStatus {
  if (value === "draft" || value === "published" || value === "archived") {
    return value;
  }
  return "all";
}

function parseSort(value: string | undefined): "created" | "published" | "title" {
  if (value === "published" || value === "title") {
    return value;
  }
  return "created";
}
