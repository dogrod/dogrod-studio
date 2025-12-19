"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Trash2,
  Eye,
  Edit3,
  Maximize2,
  Minimize2,
  Settings2,
  ChevronLeft,
} from "lucide-react";
import Link from "next/link";

import {
  createPostAction,
  updatePostAction,
  deletePostAction,
  checkSlugAction,
} from "@/app/admin/(protected)/blog/[post-id]/actions";
import { CoverImageSelector } from "@/components/admin/blog/cover-image-selector";
import { MarkdownToolbar } from "@/components/admin/blog/markdown-toolbar";
import { MarkdownPreview } from "@/components/admin/blog/markdown-preview";
import { TagInput, type TagOption } from "@/components/admin/tag-input";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { PostDetail, PhotoPickerItem, PostLanguage } from "@/types/posts";
import type { AssetWithRenditions, Tag } from "@/types/photos";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(255)
    .regex(slugRegex, "Slug must be kebab-case (e.g., my-post-title)"),
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

function generateUUID(): string {
  return crypto.randomUUID();
}

interface PostEditorProps {
  post: PostDetail | null;
  allTags: Tag[];
}

const LANGUAGE_LABELS: Record<PostLanguage, string> = {
  "zh-CN": "中文 (Chinese)",
  "en-US": "English",
};

export function PostEditor({ post, allTags }: PostEditorProps) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const [zenMode, setZenMode] = useState(false);
  const [mobileTab, setMobileTab] = useState<"write" | "preview">("write");
  const [selectedAsset, setSelectedAsset] = useState<AssetWithRenditions | null>(
    post?.cover_asset ?? null
  );
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(
    post?.gallery_photo_id ?? null
  );
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);

  // Tag options state (can be updated when new tags are created)
  const [tagOptions, setTagOptions] = useState<TagOption[]>(() =>
    allTags.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      color: t.color,
    }))
  );

  const [translationGroupId] = useState<string>(
    () => post?.translation_group_id ?? generateUUID()
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

  const watchedContent = form.watch("content");

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

  // Markdown toolbar handlers
  const handleInsert = useCallback(
    (text: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentContent = form.getValues("content") || "";

      const newContent =
        currentContent.substring(0, start) + text + currentContent.substring(end);

      form.setValue("content", newContent);

      // Set cursor position after inserted text
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + text.length, start + text.length);
      }, 0);
    },
    [form]
  );

  const handleWrap = useCallback(
    (wrappedText: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentContent = form.getValues("content") || "";

      const newContent =
        currentContent.substring(0, start) +
        wrappedText +
        currentContent.substring(end);

      form.setValue("content", newContent);

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + wrappedText.length, start + wrappedText.length);
      }, 0);
    },
    [form]
  );

  const handleTagCreated = useCallback((tag: TagOption) => {
    setTagOptions((prev) => {
      if (prev.some((t) => t.id === tag.id)) return prev;
      return [...prev, tag];
    });
  }, []);

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
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className={cn(
            "flex flex-col",
            zenMode ? "fixed inset-0 z-50 bg-background" : "h-[calc(100vh-120px)]"
          )}
        >
          {/* Editor Header */}
          <div className="flex items-center justify-between border-b px-4 py-2">
            <div className="flex items-center gap-3">
              {!zenMode && (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/admin/blog">
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Back
                  </Link>
                </Button>
              )}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <Input
                    {...field}
                    placeholder="Post title..."
                    className="border-0 bg-transparent text-lg font-semibold shadow-none focus-visible:ring-0"
                    onBlur={() => {
                      field.onBlur();
                      handleTitleBlur();
                    }}
                    disabled={isFormLocked}
                  />
                )}
              />
              {!isNewPost && post?.language && (
                <Badge variant="outline">{LANGUAGE_LABELS[post.language]}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setZenMode(!zenMode)}
                title={zenMode ? "Exit focus mode" : "Focus mode"}
              >
                {zenMode ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
              {!zenMode && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSettings(!showSettings)}
                  title="Toggle settings"
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
              )}
              <Button type="submit" disabled={isFormLocked} size="sm">
                {isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>

          {/* Main Editor Area */}
          <div className="flex flex-1 overflow-hidden">
            {/* Editor + Preview Split */}
            <div
              className={cn(
                "flex flex-1 flex-col lg:flex-row",
                !zenMode && showSettings ? "lg:mr-80" : ""
              )}
            >
              {/* Mobile Tabs */}
              <div className="lg:hidden">
                <Tabs
                  value={mobileTab}
                  onValueChange={(v) => setMobileTab(v as "write" | "preview")}
                >
                  <TabsList className="w-full">
                    <TabsTrigger value="write" className="flex-1">
                      <Edit3 className="mr-2 h-4 w-4" />
                      Write
                    </TabsTrigger>
                    <TabsTrigger value="preview" className="flex-1">
                      <Eye className="mr-2 h-4 w-4" />
                      Preview
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="write" className="flex-1">
                    <div className="flex h-[calc(100vh-200px)] flex-col">
                      <MarkdownToolbar
                        textareaRef={textareaRef}
                        onInsert={handleInsert}
                        onWrap={handleWrap}
                        disabled={isFormLocked}
                      />
                      <FormField
                        control={form.control}
                        name="content"
                        render={({ field }) => (
                          <Textarea
                            {...field}
                            ref={textareaRef}
                            value={field.value ?? ""}
                            placeholder="Write your story..."
                            className="flex-1 resize-none rounded-none border-0 font-mono text-base shadow-none focus-visible:ring-0"
                            disabled={isFormLocked}
                          />
                        )}
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="preview" className="h-[calc(100vh-200px)]">
                    <MarkdownPreview content={watchedContent ?? ""} />
                  </TabsContent>
                </Tabs>
              </div>

              {/* Desktop Split View */}
              <div className="hidden flex-1 lg:flex">
                {/* Write Pane */}
                <div className="flex flex-1 flex-col border-r">
                  <MarkdownToolbar
                    textareaRef={textareaRef}
                    onInsert={handleInsert}
                    onWrap={handleWrap}
                    disabled={isFormLocked}
                  />
                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <Textarea
                        {...field}
                        ref={textareaRef}
                        value={field.value ?? ""}
                        placeholder="Write your story..."
                        className="flex-1 resize-none rounded-none border-0 font-mono text-base shadow-none focus-visible:ring-0"
                        disabled={isFormLocked}
                      />
                    )}
                  />
                </div>

                {/* Preview Pane */}
                <div className="flex-1 overflow-hidden bg-muted/20">
                  <div className="flex h-10 items-center border-b bg-muted/30 px-4">
                    <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">
                      Preview
                    </span>
                  </div>
                  <MarkdownPreview
                    content={watchedContent ?? ""}
                    className="h-[calc(100%-40px)]"
                  />
                </div>
              </div>
            </div>

            {/* Settings Sidebar */}
            {!zenMode && showSettings && (
              <div className="fixed right-0 top-[64px] hidden h-[calc(100vh-64px)] w-80 overflow-y-auto border-l bg-background p-4 lg:block">
                <div className="space-y-6">
                  {/* Slug */}
                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Slug</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="post-slug"
                            disabled={isFormLocked}
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
                          {slugChecking && "Checking..."}
                          {slugAvailable === true && (
                            <span className="text-emerald-600">✓ Available</span>
                          )}
                          {slugAvailable === false && (
                            <span className="text-destructive">✗ Taken</span>
                          )}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Excerpt */}
                  <FormField
                    control={form.control}
                    name="excerpt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Excerpt</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            value={field.value ?? ""}
                            rows={2}
                            placeholder="Brief summary..."
                            disabled={isFormLocked}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Cover Image */}
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

                  {/* Status & Visibility */}
                  <div className="grid grid-cols-2 gap-3">
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
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Language (only for new posts) */}
                  {isNewPost && (
                    <FormField
                      control={form.control}
                      name="language"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Language</FormLabel>
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
                              <SelectItem value="zh-CN">
                                {LANGUAGE_LABELS["zh-CN"]}
                              </SelectItem>
                              <SelectItem value="en-US">
                                {LANGUAGE_LABELS["en-US"]}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Tags */}
                  <FormField
                    control={form.control}
                    name="tagIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tags</FormLabel>
                        <FormControl>
                          <TagInput
                            options={tagOptions}
                            value={field.value}
                            onChange={field.onChange}
                            onTagCreated={handleTagCreated}
                            disabled={isFormLocked}
                            placeholder="Select or create tags..."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Delete Button */}
                  {!isNewPost && (
                    <div className="border-t pt-4">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="w-full"
                        onClick={() => setShowDeleteDialog(true)}
                        disabled={isFormLocked}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete post
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </form>
      </Form>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete post?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The post &ldquo;{post?.title}&rdquo;
              will be permanently deleted.
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
