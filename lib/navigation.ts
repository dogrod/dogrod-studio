"use client";

import type { ReadonlyURLSearchParams } from "next/navigation";

type Params = ReadonlyURLSearchParams | URLSearchParams | string | undefined;

export function mergeSearchParams(
  current: Params,
  updates: Record<string, string | number | null | undefined>,
  { resetPage = false }: { resetPage?: boolean } = {},
) {
  const params =
    typeof current === "string"
      ? new URLSearchParams(current)
      : new URLSearchParams(current?.toString());

  if (resetPage) {
    params.delete("page");
  }

  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === "") {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}
