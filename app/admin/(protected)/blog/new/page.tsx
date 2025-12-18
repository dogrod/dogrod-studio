import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PostEditorForm } from "@/components/admin/blog/post-editor-form";
import { Button } from "@/components/ui/button";
import { fetchAllTags } from "@/lib/data/photos";

export default async function NewPostPage() {
  const allTags = await fetchAllTags();

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
        <h1 className="text-2xl font-semibold tracking-tight">New Post</h1>
        <p className="text-sm text-muted-foreground">
          Create a new blog post with cover image, content, and publishing settings.
        </p>
      </div>

      <PostEditorForm post={null} allTags={allTags} />
    </div>
  );
}
