"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { TagTable } from "@/components/admin/tags/tag-table";
import { TagFormDialog } from "@/components/admin/tags/tag-form-dialog";
import { Button } from "@/components/ui/button";
import type { TagStats } from "@/types/tags";

interface TagManagerClientProps {
  initialTags: TagStats[];
}

export function TagManagerClient({ initialTags }: TagManagerClientProps) {
  const [tags] = useState(initialTags);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagStats | null>(null);

  const handleEdit = (tag: TagStats) => {
    setEditingTag(tag);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingTag(null);
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingTag(null);
    }
  };

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New tag
        </Button>
      </div>

      <TagTable tags={tags} onEdit={handleEdit} />

      <TagFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        tag={editingTag}
      />
    </>
  );
}
