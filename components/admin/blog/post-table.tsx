"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import { Plus, AlertCircle } from "lucide-react";

import { createTranslationAction } from "@/app/admin/(protected)/blog/[post-id]/actions";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type {
  PostListItem,
  PostLanguage,
  PostGroup,
} from "@/types/posts";

interface PostTableProps {
  posts: PostListItem[];
}

/** Supported languages in display order */
const LANGUAGES: PostLanguage[] = ["zh-CN", "en-US"];

const LANGUAGE_LABELS: Record<PostLanguage, string> = {
  "zh-CN": "ZH",
  "en-US": "EN",
};

const LANGUAGE_FULL_LABELS: Record<PostLanguage, string> = {
  "zh-CN": "中文",
  "en-US": "English",
};

/**
 * Groups posts by translation_group_id into PostGroup objects.
 */
function groupPostsByTranslation(posts: PostListItem[]): PostGroup[] {
  const groupMap = new Map<string, PostListItem[]>();

  // Group posts by translation_group_id
  for (const post of posts) {
    const groupId = post.translation_group_id;
    const existing = groupMap.get(groupId);
    if (existing) {
      existing.push(post);
    } else {
      groupMap.set(groupId, [post]);
    }
  }

  // Transform into PostGroup objects
  const groups: PostGroup[] = [];

  for (const [groupId, groupPosts] of groupMap) {
    // Build variants map
    const variants: Partial<Record<PostLanguage, PostListItem>> = {};
    for (const post of groupPosts) {
      variants[post.language] = post;
    }

    // Select primary post (prefer zh-CN, then en-US, then first available)
    const primaryPost =
      variants["zh-CN"] ??
      variants["en-US"] ??
      groupPosts[0];

    // Find earliest created_at for sorting
    const createdAt = groupPosts.reduce((earliest, post) => {
      return post.created_at < earliest ? post.created_at : earliest;
    }, groupPosts[0].created_at);

    groups.push({
      groupId,
      primaryPost,
      variants,
      createdAt,
    });
  }

  // Sort by createdAt descending (newest first)
  groups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return groups;
}

export function PostTable({ posts }: PostTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [creatingFor, setCreatingFor] = useState<{
    groupId: string;
    language: PostLanguage;
  } | null>(null);

  // Group posts by translation_group_id
  const postGroups = useMemo(() => groupPostsByTranslation(posts), [posts]);

  const handleCreateTranslation = (
    sourcePost: PostListItem,
    targetLanguage: PostLanguage
  ) => {
    setCreatingFor({ groupId: sourcePost.translation_group_id, language: targetLanguage });
    startTransition(async () => {
      try {
        const result = await createTranslationAction({
          sourcePostId: sourcePost.id,
          targetLanguage,
        });

        toast({
          title: "Translation created",
          description: `A new ${LANGUAGE_FULL_LABELS[targetLanguage]} version has been created.`,
        });

        router.push(`/admin/blog/${result.postId}`);
      } catch (error) {
        console.error(error);
        toast({
          title: "Unable to create translation",
          description:
            error instanceof Error ? error.message : "An unexpected error occurred.",
        });
      } finally {
        setCreatingFor(null);
      }
    });
  };

  if (posts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 p-10 text-center text-sm text-muted-foreground">
        No posts found. Create your first post to get started.
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">Cover</TableHead>
            <TableHead>Title</TableHead>
            <TableHead className="w-[140px]">Translations</TableHead>
            <TableHead>Published</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {postGroups.map((group) => {
            const { primaryPost, variants, groupId } = group;
            const rendition = pickRendition(primaryPost);
            const isPrimaryFallback = primaryPost.language !== "zh-CN";

            return (
              <TableRow key={groupId}>
                <TableCell>
                  <div className="relative h-12 w-16 overflow-hidden rounded-md bg-muted">
                    {rendition ? (
                      <Image
                        src={rendition.url}
                        alt={primaryPost.title ?? "Post cover"}
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
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground">
                        {primaryPost.title}
                      </span>
                      {isPrimaryFallback && (
                        <Tooltip>
                          <TooltipTrigger>
                            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Showing {LANGUAGE_FULL_LABELS[primaryPost.language]} title (no Chinese version)</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      /{primaryPost.slug}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {LANGUAGES.map((lang) => {
                      const variant = variants[lang];
                      const isCreating =
                        isPending &&
                        creatingFor?.groupId === groupId &&
                        creatingFor?.language === lang;

                      if (variant) {
                        // Variant exists - show solid badge
                        return (
                          <Tooltip key={lang}>
                            <TooltipTrigger asChild>
                              <Link href={`/admin/blog/${variant.id}`}>
                                <Badge
                                  variant={getStatusBadgeVariant(variant.status)}
                                  className={cn(
                                    "cursor-pointer transition-opacity hover:opacity-80",
                                    getStatusBadgeClass(variant.status)
                                  )}
                                >
                                  {LANGUAGE_LABELS[lang]}
                                </Badge>
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {LANGUAGE_FULL_LABELS[lang]} • {variant.status}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      } else {
                        // Variant missing - show ghost badge
                        return (
                          <Tooltip key={lang}>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() =>
                                  handleCreateTranslation(primaryPost, lang)
                                }
                                className={cn(
                                  "inline-flex items-center gap-0.5 rounded-full border border-dashed px-2 py-0.5 text-xs font-medium transition-colors",
                                  "text-muted-foreground opacity-50 hover:opacity-100 hover:border-primary hover:text-primary",
                                  "disabled:cursor-not-allowed disabled:opacity-30"
                                )}
                              >
                                <Plus className="h-3 w-3" />
                                {isCreating ? "..." : LANGUAGE_LABELS[lang]}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Add {LANGUAGE_FULL_LABELS[lang]} translation</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      }
                    })}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {getPublishedDate(variants)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(group.createdAt), "MMM d, yyyy")}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TooltipProvider>
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

function getStatusBadgeVariant(
  status: string
): "default" | "secondary" | "outline" | "destructive" {
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

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "published":
      return "bg-emerald-600 hover:bg-emerald-700 border-emerald-600";
    case "draft":
      return "bg-amber-500 hover:bg-amber-600 border-amber-500 text-white";
    case "archived":
      return "text-muted-foreground";
    default:
      return "";
  }
}

/**
 * Get the published date from any variant, preferring zh-CN.
 */
function getPublishedDate(
  variants: Partial<Record<PostLanguage, PostListItem>>
): string {
  const zhPost = variants["zh-CN"];
  const enPost = variants["en-US"];

  const publishedAt = zhPost?.published_at ?? enPost?.published_at;

  if (publishedAt) {
    return format(new Date(publishedAt), "MMM d, yyyy");
  }

  return "—";
}
