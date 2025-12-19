"use client";

import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PostListItem, PostLanguage } from "@/types/posts";

interface PostTableProps {
  posts: PostListItem[];
}

const LANGUAGE_LABELS: Record<PostLanguage, string> = {
  "zh-CN": "中文",
  "en-US": "EN",
};

export function PostTable({ posts }: PostTableProps) {
  if (posts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 p-10 text-center text-sm text-muted-foreground">
        No posts found. Create your first post to get started.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[80px]">Cover</TableHead>
          <TableHead>Title</TableHead>
          <TableHead className="w-[70px]">Lang</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Published</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {posts.map((post) => {
          const rendition = pickRendition(post);

          return (
            <TableRow key={post.id}>
              <TableCell>
                <div className="relative h-12 w-16 overflow-hidden rounded-md bg-muted">
                  {rendition ? (
                    <Image
                      src={rendition.url}
                      alt={post.title ?? "Post cover"}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                      No cover
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">
                    {post.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    /{post.slug}
                  </span>
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Badge variant="outline">{LANGUAGE_LABELS[post.language]}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={getStatusVariant(post.status)} className="capitalize">
                  {post.status}
                </Badge>
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {post.published_at
                    ? format(new Date(post.published_at), "MMM d, yyyy")
                    : "—"}
                </span>
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {format(new Date(post.created_at), "MMM d, yyyy")}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <Link
                  href={`/admin/blog/${post.id}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Edit
                </Link>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function pickRendition(post: PostListItem) {
  if (!post.cover_asset?.asset_rendition) {
    return null;
  }
  const lookup = new Map(
    post.cover_asset.asset_rendition.map((r) => [r.variant_name, r])
  );
  return lookup.get("thumb") ?? lookup.get("list") ?? lookup.get("og_card") ?? null;
}

function getStatusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "published":
      return "default";
    case "draft":
      return "secondary";
    case "archived":
      return "outline";
    default:
      return "secondary";
  }
}
