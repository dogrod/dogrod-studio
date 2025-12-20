"use client";

import { useState } from "react";
import { format } from "date-fns";
import { MoreHorizontal, Pencil, Trash2, ImageIcon, FileText } from "lucide-react";

import { deleteTagAction } from "@/app/admin/(protected)/tags/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import type { TagStats } from "@/types/tags";
import { getTagColorClass } from "@/types/tags";

interface TagTableProps {
  tags: TagStats[];
  onEdit: (tag: TagStats) => void;
}

export function TagTable({ tags, onEdit }: TagTableProps) {
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    tag: TagStats | null;
  }>({ open: false, tag: null });
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteDialog.tag) return;

    setIsDeleting(true);
    try {
      await deleteTagAction({ id: deleteDialog.tag.id });
      toast({
        title: "Tag deleted",
        description: `"${deleteDialog.tag.name}" has been removed.`,
      });
      setDeleteDialog({ open: false, tag: null });
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to delete tag",
        description:
          error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (tags.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 p-10 text-center text-sm text-muted-foreground">
        No tags found. Create your first tag to get started.
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead className="w-[120px]">Usage</TableHead>
            <TableHead className="w-[120px]">Created</TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tags.map((tag) => (
            <TableRow key={tag.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "h-3 w-3 rounded-full",
                      getTagColorClass(tag.color)
                    )}
                  />
                  <span className="font-medium">{tag.name}</span>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {tag.slug || "—"}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <ImageIcon className="h-3.5 w-3.5" />
                        <span>{tag.photo_count}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{tag.photo_count} photo{tag.photo_count !== 1 ? "s" : ""}</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" />
                        <span>{tag.post_count}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{tag.post_count} post{tag.post_count !== 1 ? "s" : ""}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TableCell>
              <TableCell>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(tag.created_at), "MMM d, yyyy")}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Created {format(new Date(tag.created_at), "PPpp")}</p>
                    {tag.updated_at !== tag.created_at && (
                      <p>Updated {format(new Date(tag.updated_at), "PPpp")}</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(tag)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleteDialog({ open: true, tag })}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, tag: open ? deleteDialog.tag : null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete tag?</DialogTitle>
            <DialogDescription>
              This will permanently delete &ldquo;{deleteDialog.tag?.name}&rdquo; and remove it from{" "}
              {(deleteDialog.tag?.photo_count ?? 0) + (deleteDialog.tag?.post_count ?? 0)} items.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, tag: null })}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
