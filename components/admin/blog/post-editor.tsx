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
  Settings,
  ChevronLeft,
} from "lucide-react";
import Link from "next/link";

import {
  createPostAction,
  updatePostAction,
  deletePostAction,
  checkSlugAction,
} from "@/app/admin/(protected)/blog/[post-id]/actions";
import { MarkdownToolbar } from "@/components/admin/blog/markdown-toolbar";
import { MarkdownPreview } from "@/components/admin/blog/markdown-preview";
import { PostSettingsSheet } from "@/components/admin/blog/post-settings-sheet";
import type { TagOption } from "@/components/admin/tag-input";
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
import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { PostDetail, PhotoPickerItem, PostLanguage, TranslationLink } from "@/types/posts";
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
  translations?: TranslationLink[];
}

const LANGUAGE_LABELS: Record<PostLanguage, string> = {
  "zh-CN": "中文",
  "en-US": "EN",
};

export function PostEditor({ post, allTags, translations = [] }: PostEditorProps) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
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
            zenMode ? "fixed inset-0 z-50 bg-background" : "h-[calc(100vh-64px)]"
          )}
        >
          {/* Editor Header */}
          <div className="flex items-center justify-between border-b px-4 py-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {!zenMode && (
                <Button variant="ghost" size="icon" asChild className="shrink-0">
                  <Link href="/admin/blog">
                    <ChevronLeft className="h-4 w-4" />
                    <span className="sr-only">Back</span>
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
                    className="flex-1 border-0 bg-transparent text-lg font-semibold shadow-none focus-visible:ring-0"
                    onBlur={() => {
                      field.onBlur();
                      handleTitleBlur();
                    }}
                    disabled={isFormLocked}
                  />
                )}
              />
              {!isNewPost && post?.language && (
                <Badge variant="outline" className="shrink-0">
                  {LANGUAGE_LABELS[post.language]}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
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
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(true)}
                title="Post settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
              {!isNewPost && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isFormLocked}
                  title="Delete post"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button type="submit" disabled={isFormLocked} size="sm" className="ml-2">
                {isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>

          {/* Main Editor Area - Full Width Split */}
          <div className="flex flex-1 overflow-hidden">
            {/* Mobile Tabs */}
            <div className="flex flex-1 flex-col lg:hidden">
              <Tabs
                value={mobileTab}
                onValueChange={(v) => setMobileTab(v as "write" | "preview")}
                className="flex flex-1 flex-col"
              >
                <TabsList className="w-full rounded-none border-b">
                  <TabsTrigger value="write" className="flex-1">
                    <Edit3 className="mr-2 h-4 w-4" />
                    Write
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="flex-1">
                    <Eye className="mr-2 h-4 w-4" />
                    Preview
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="write" className="flex-1 mt-0 data-[state=inactive]:hidden">
                  <div className="flex h-full flex-col">
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
                          className="flex-1 resize-none rounded-none border-0 font-mono text-base leading-relaxed shadow-none focus-visible:ring-0 p-4"
                          disabled={isFormLocked}
                        />
                      )}
                    />
                  </div>
                </TabsContent>
                <TabsContent value="preview" className="flex-1 mt-0 data-[state=inactive]:hidden">
                  <MarkdownPreview content={watchedContent ?? ""} className="h-full" />
                </TabsContent>
              </Tabs>
            </div>

            {/* Desktop Split View - Full Width */}
            <div className="hidden flex-1 lg:grid lg:grid-cols-2">
              {/* Write Pane */}
              <div className="flex flex-col border-r overflow-hidden">
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
                      className="flex-1 resize-none rounded-none border-0 font-mono text-base leading-relaxed shadow-none focus-visible:ring-0 p-4"
                      disabled={isFormLocked}
                    />
                  )}
                />
              </div>

              {/* Preview Pane */}
              <div className="flex flex-col overflow-hidden bg-muted/20">
                <div className="flex h-10 items-center border-b bg-muted/30 px-4 shrink-0">
                  <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Preview
                  </span>
                </div>
                <div className="flex-1 overflow-auto">
                  <MarkdownPreview content={watchedContent ?? ""} />
                </div>
              </div>
            </div>
          </div>
        </form>
      </Form>

      {/* Settings Sheet */}
      <PostSettingsSheet
        open={showSettings}
        onOpenChange={setShowSettings}
        form={form}
        post={post}
        isNewPost={isNewPost}
        isFormLocked={isFormLocked}
        tagOptions={tagOptions}
        onTagCreated={handleTagCreated}
        selectedAsset={selectedAsset}
        selectedPhotoId={selectedPhotoId}
        onPhotoSelect={handlePhotoSelect}
        onClearCover={handleClearCover}
        slugChecking={slugChecking}
        slugAvailable={slugAvailable}
        onSlugCheck={checkSlugAvailability}
        translations={translations}
      />

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
