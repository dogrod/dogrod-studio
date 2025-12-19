"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Trash2 } from "lucide-react";

import {
  createPostAction,
  updatePostAction,
  deletePostAction,
  checkSlugAction,
} from "@/app/admin/(protected)/blog/[post-id]/actions";
import { CoverImageSelector } from "@/components/admin/blog/cover-image-selector";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import type { PostDetail, PhotoPickerItem, PostLanguage } from "@/types/posts";
import type { AssetWithRenditions, Tag } from "@/types/photos";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  slug: z.string().min(1, "Slug is required").max(255).regex(slugRegex, "Slug must be kebab-case (e.g., my-post-title)"),
  excerpt: z.string().max(500).optional(),
  content: z.string().optional(),
  coverAssetId: z.string().uuid("Cover image is required"),
  galleryPhotoId: z.string().uuid().nullable(),
  status: z.enum(["draft", "published", "archived"]),
  visibility: z.enum(["public", "unlisted", "private"]),
  language: z.enum(["zh-CN", "en-US"]),
  tagIds: z.array(z.string()),
});

type FormValues = z.infer<typeof formSchema>;

// Generate a UUID v4
function generateUUID(): string {
  return crypto.randomUUID();
}

interface PostEditorFormProps {
  /** Existing post for editing, or null for new post */
  post: PostDetail | null;
  /** All available tags */
  allTags: Tag[];
}

const LANGUAGE_LABELS: Record<PostLanguage, string> = {
  "zh-CN": "中文 (Chinese)",
  "en-US": "English",
};

export function PostEditorForm({ post, allTags }: PostEditorFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetWithRenditions | null>(
    post?.cover_asset ?? null
  );
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(
    post?.gallery_photo_id ?? null
  );
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);

  // For new posts, generate a translation_group_id once
  const [translationGroupId] = useState<string>(() => 
    post?.translation_group_id ?? generateUUID()
  );

  const isFormLocked = isPending || isDeleting;
  const isNewPost = !post;

  const defaultValues: FormValues = useMemo(
    () => ({
      title: post?.title ?? "",
      slug: post?.slug ?? "",
      excerpt: post?.excerpt ?? "",
      content: post?.content ?? "",
      coverAssetId: post?.cover_asset_id ?? "",
      galleryPhotoId: post?.gallery_photo_id ?? null,
      status: post?.status ?? "draft",
      visibility: post?.visibility ?? "public",
      language: post?.language ?? "zh-CN",
      tagIds: post?.tags.map((tag) => tag.id) ?? [],
    }),
    [post]
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
    setSelectedAsset(post?.cover_asset ?? null);
    setSelectedPhotoId(post?.gallery_photo_id ?? null);
  }, [defaultValues, form, post]);

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleTitleBlur = () => {
    const title = form.getValues("title");
    const currentSlug = form.getValues("slug");

    if (title && !currentSlug) {
      const newSlug = generateSlug(title);
      form.setValue("slug", newSlug);
      checkSlugAvailability(newSlug);
    }
  };

  const checkSlugAvailability = async (slug: string) => {
    if (!slug || !slugRegex.test(slug)) {
      setSlugAvailable(null);
      return;
    }

    setSlugChecking(true);
    try {
      const result = await checkSlugAction({
        slug,
        excludePostId: post?.id,
      });
      setSlugAvailable(result.available);
    } catch {
      setSlugAvailable(null);
    } finally {
      setSlugChecking(false);
    }
  };

  const handlePhotoSelect = (photo: PhotoPickerItem) => {
    // Build AssetWithRenditions from photo data
    const asset: AssetWithRenditions = {
      id: photo.asset_original_id,
      dominant_color: null,
      blurhash: null,
      asset_rendition: photo.renditions,
    };
    setSelectedAsset(asset);
    setSelectedPhotoId(photo.id);
    form.setValue("coverAssetId", photo.asset_original_id);
    form.setValue("galleryPhotoId", photo.id);
  };

  const handleClearCover = () => {
    setSelectedAsset(null);
    setSelectedPhotoId(null);
    form.setValue("coverAssetId", "");
    form.setValue("galleryPhotoId", null);
  };

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      try {
        if (isNewPost) {
          const result = await createPostAction({
            title: values.title,
            slug: values.slug,
            excerpt: normalizeField(values.excerpt),
            content: normalizeField(values.content),
            coverAssetId: values.coverAssetId,
            galleryPhotoId: values.galleryPhotoId,
            status: values.status,
            visibility: values.visibility,
            language: values.language,
            translationGroupId: translationGroupId,
            tagIds: values.tagIds,
          });

          toast({
            title: "Post created",
            description: "Your new post has been saved.",
          });

          router.push(`/admin/blog/${result.postId}`);
        } else {
          await updatePostAction({
            postId: post.id,
            title: values.title,
            slug: values.slug,
            excerpt: normalizeField(values.excerpt),
            content: normalizeField(values.content),
            coverAssetId: values.coverAssetId,
            galleryPhotoId: values.galleryPhotoId,
            status: values.status,
            visibility: values.visibility,
            tagIds: values.tagIds,
          });

          toast({
            title: "Post updated",
            description: "Changes saved successfully.",
          });

          router.refresh();
        }
      } catch (error) {
        console.error(error);
        toast({
          title: "Unable to save",
          description:
            error instanceof Error ? error.message : "An unexpected error occurred.",
        });
      }
    });
  };

  const handleDelete = async () => {
    if (!post) return;

    setIsDeleting(true);
    try {
      await deletePostAction({ postId: post.id });
      toast({
        title: "Post deleted",
        description: "The post has been permanently removed.",
      });
      router.push("/admin/blog");
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to delete",
        description:
          error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <fieldset className="space-y-6 rounded-lg border bg-card p-6" disabled={isFormLocked}>
            <legend className="px-1 text-sm font-semibold uppercase text-muted-foreground">
              Post Details
            </legend>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter post title"
                      {...field}
                      onBlur={() => {
                        field.onBlur();
                        handleTitleBlur();
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
                      placeholder="my-post-slug"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        setSlugAvailable(null);
                      }}
                      onBlur={(e) => {
                        field.onBlur();
                        checkSlugAvailability(e.target.value);
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    URL-friendly identifier. Auto-generated from title if left empty.
                    {slugChecking && " Checking..."}
                    {slugAvailable === true && (
                      <span className="text-emerald-600"> ✓ Available</span>
                    )}
                    {slugAvailable === false && (
                      <span className="text-destructive"> ✗ Already in use</span>
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="excerpt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Excerpt</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="A brief summary of the post (shown in listings)"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="coverAssetId"
              render={() => (
                <FormItem>
                  <FormLabel>Cover Image</FormLabel>
                  <FormControl>
                    <CoverImageSelector
                      selectedAsset={selectedAsset}
                      selectedPhotoId={selectedPhotoId}
                      onSelectPhoto={handlePhotoSelect}
                      onClear={handleClearCover}
                      disabled={isFormLocked}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={12}
                      placeholder="Write your post content in Markdown..."
                      className="font-mono text-sm"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormDescription>
                    Supports Markdown formatting.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </fieldset>

          <fieldset className="space-y-6 rounded-lg border bg-card p-6" disabled={isFormLocked}>
            <legend className="px-1 text-sm font-semibold uppercase text-muted-foreground">
              Publishing
            </legend>

            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="language"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Language</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isFormLocked || !isNewPost}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="zh-CN">{LANGUAGE_LABELS["zh-CN"]}</SelectItem>
                        <SelectItem value="en-US">{LANGUAGE_LABELS["en-US"]}</SelectItem>
                      </SelectContent>
                    </Select>
                    {!isNewPost && (
                      <FormDescription>
                        Language cannot be changed after creation.
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isFormLocked}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="visibility"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visibility</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isFormLocked}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="public">Public</SelectItem>
                        <SelectItem value="unlisted">Unlisted</SelectItem>
                        <SelectItem value="private">Private</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="tagIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <div className="grid gap-2">
                    {allTags.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No tags available. Create tags in Supabase to assign them here.
                      </p>
                    )}
                    {allTags.map((tag) => {
                      const isChecked = field.value.includes(tag.id);
                      return (
                        <label key={tag.id} className="flex items-center gap-3 text-sm">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              const next = checked
                                ? [...field.value, tag.id]
                                : field.value.filter((value) => value !== tag.id);
                              field.onChange(next);
                            }}
                          />
                          <span>{tag.name}</span>
                        </label>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </fieldset>

          <div className="flex items-center justify-between">
            {!isNewPost && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isFormLocked}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete post
              </Button>
            )}
            <div className="ml-auto flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/admin/blog")}
                disabled={isFormLocked}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isFormLocked}>
                {isPending ? "Saving..." : isNewPost ? "Create post" : "Save changes"}
              </Button>
            </div>
          </div>
        </form>
      </Form>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete post?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The post &ldquo;{post?.title}&rdquo; will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
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
    </>
  );
}

function normalizeField(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
