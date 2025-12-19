import { PostEditor } from "@/components/admin/blog/post-editor";
import { fetchAllTags } from "@/lib/data/photos";

export default async function NewPostPage() {
  const allTags = await fetchAllTags();

  return <PostEditor post={null} allTags={allTags} />;
}
