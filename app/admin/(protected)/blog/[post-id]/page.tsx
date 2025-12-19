import { notFound } from "next/navigation";

import { PostEditor } from "@/components/admin/blog/post-editor";
import { TranslationsSidebar } from "@/components/admin/blog/translations-sidebar";
import { fetchPostDetail, fetchTranslations } from "@/lib/data/posts";
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

  // Fetch translations for this post
  const translations = await fetchTranslations(post.translation_group_id, post.id);

  return (
    <div className="relative">
      <PostEditor post={post} allTags={allTags} />
      
      {/* Translations Sidebar - positioned in the settings area */}
      <div className="fixed bottom-4 right-4 z-40 hidden lg:block">
        <div className="w-64">
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
