"use client";

import { useEffect, useMemo, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  createTagAction,
  updateTagAction,
} from "@/app/admin/(protected)/tags/actions";
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { TagStats } from "@/types/tags";
import { TAG_COLOR_PRESETS } from "@/types/tags";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: z
    .string()
    .max(100)
    .regex(slugRegex, "Slug must be kebab-case (e.g., my-tag)")
    .optional()
    .or(z.literal("")),
  description: z.string().max(500).optional(),
  color: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface TagFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tag to edit, or null for create mode */
  tag: TagStats | null;
  /** Full tag data for edit (includes description) */
  tagDetail?: {
    id: string;
    name: string;
    slug: string | null;
    description: string | null;
    color: string | null;
  } | null;
}

export function TagFormDialog({
  open,
  onOpenChange,
  tag,
  tagDetail,
}: TagFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  const isEditMode = !!tag;

  const defaultValues: FormValues = useMemo(
    () => ({
      name: tagDetail?.name ?? tag?.name ?? "",
      slug: tagDetail?.slug ?? tag?.slug ?? "",
      description: tagDetail?.description ?? "",
      color: tagDetail?.color ?? tag?.color ?? "",
    }),
    [tag, tagDetail]
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
    }
  }, [open, defaultValues, form]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleNameBlur = () => {
    const name = form.getValues("name");
    const currentSlug = form.getValues("slug");

    if (name && !currentSlug && !isEditMode) {
      form.setValue("slug", generateSlug(name));
    }
  };

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      try {
        if (isEditMode && tag) {
          await updateTagAction({
            id: tag.id,
            name: values.name,
            slug: values.slug || null,
            description: values.description || null,
            color: values.color || null,
          });

          toast({
            title: "Tag updated",
            description: `"${values.name}" has been saved.`,
          });
        } else {
          await createTagAction({
            name: values.name,
            slug: values.slug || null,
            description: values.description || null,
            color: values.color || null,
          });

          toast({
            title: "Tag created",
            description: `"${values.name}" has been added.`,
          });
        }

        onOpenChange(false);
      } catch (error) {
        console.error(error);
        toast({
          title: "Unable to save tag",
          description:
            error instanceof Error ? error.message : "An unexpected error occurred.",
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Tag" : "Create Tag"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update the tag details below."
              : "Add a new tag to organize your content."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Landscape"
                      {...field}
                      onBlur={() => {
                        field.onBlur();
                        handleNameBlur();
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., landscape"
                      {...field}
                      disabled={isEditMode && !!tag?.slug}
                    />
                  </FormControl>
                  <FormDescription>
                    {isEditMode && tag?.slug
                      ? "Slug cannot be changed after creation."
                      : "URL-friendly identifier. Auto-generated from name."}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      {TAG_COLOR_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => field.onChange(preset.value)}
                          className={cn(
                            "h-6 w-6 rounded-full transition-all",
                            preset.class,
                            field.value === preset.value
                              ? "ring-2 ring-offset-2 ring-primary"
                              : "hover:scale-110"
                          )}
                          title={preset.name}
                        />
                      ))}
                    </div>
                  </FormControl>
                  <FormDescription>
                    Choose a color for the tag badge.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="Optional description for this tag"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : isEditMode ? "Save changes" : "Create tag"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
