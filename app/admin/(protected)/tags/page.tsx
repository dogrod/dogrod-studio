import { TagManagerClient } from "./tag-manager-client";
import { fetchTagStats } from "@/lib/data/tags";

export const dynamic = "force-dynamic";

export default async function TagsPage() {
  const tags = await fetchTagStats();

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tags</h1>
          <p className="text-sm text-muted-foreground">
            Manage tags used across Gallery and Blog content.
          </p>
        </div>
      </div>

      <TagManagerClient initialTags={tags} />
    </div>
  );
}
