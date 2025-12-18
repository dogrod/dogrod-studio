import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PostEditorForm } from "@/components/admin/blog/post-editor-form";
import { Button } from "@/components/ui/button";
import { fetchPostDetail } from "@/lib/data/posts";
import { fetchAllTags } from "@/lib/data/photos";

interface PostPageProps {
  params: Promise<{
    "post-id": string;
  }>;
}

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
        <h1 className="text-2xl font-semibold tracking-tight">Edit Post</h1>
        <p className="text-sm text-muted-foreground">
          Update post details, content, and publishing settings.
        </p>
      </div>

      <PostEditorForm post={post} allTags={allTags} />
    </div>
  );
}
