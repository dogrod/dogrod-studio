import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PostEditorForm } from "@/components/admin/blog/post-editor-form";
import { TranslationsSidebar } from "@/components/admin/blog/translations-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchPostDetail, fetchTranslations } from "@/lib/data/posts";
import { fetchAllTags } from "@/lib/data/photos";

interface PostPageProps {
  params: Promise<{
    "post-id": string;
  }>;
}

const LANGUAGE_LABELS = {
  "zh-CN": "中文",
  "en-US": "English",
} as const;

export default async function PostDetailPage({ params }: PostPageProps) {
  const resolvedParams = await params;
  const id = resolvedParams["post-id"];

  if (!id) {
    notFound();
  }

  const [post, allTags] = await Promise.all([
    fetchPostDetail(id),
    fetchAllTags(),
  ]);

  if (!post) {
    notFound();
  }

  // Fetch translations for this post
  const translations = await fetchTranslations(post.translation_group_id, post.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/blog">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Blog
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Edit Post</h1>
          <Badge variant="outline">{LANGUAGE_LABELS[post.language]}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Update post details, content, and publishing settings.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <PostEditorForm post={post} allTags={allTags} />
        <div className="space-y-6">
          <TranslationsSidebar
            postId={post.id}
            currentLanguage={post.language}
            translations={translations}
          />
        </div>
      </div>
    </div>
  );
}
