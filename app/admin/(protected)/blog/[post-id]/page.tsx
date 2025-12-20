import { notFound } from "next/navigation";

import { PostEditor } from "@/components/admin/blog/post-editor";
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

  return <PostEditor post={post} allTags={allTags} translations={translations} />;
}
