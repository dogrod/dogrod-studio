# Blog Management Module - MVP Implementation

**Date**: 2024-12-18  
**Author**: AI Assistant  
**Status**: Implementation in Progress

---

## 1. Pattern Analysis

### Architecture Patterns Observed in Gallery Module

After analyzing the existing Gallery module, the following patterns were identified:

#### 1.1 Data Fetching Pattern
- **Server Components**: Pages use async Server Components for data fetching
- **Data Layer**: Fetching functions are centralized in `lib/data/photos.ts`
- **Supabase Client**: Uses `createSupabaseServiceRoleClient()` for server-side database operations
- **Pagination**: Implemented via offset-based pagination with `page` and `pageSize`
- **Filtering**: URL searchParams are parsed in page components and passed to fetch functions

#### 1.2 Mutation Pattern
- **Server Actions**: Mutations use Next.js Server Actions with `'use server'` directive
- **Actions Location**: Placed in `actions.ts` adjacent to the page that uses them
- **Validation**: Input validated with Zod schemas before database operations
- **Auth Check**: `requireUser()` called at the start of each action
- **Cache Invalidation**: `revalidatePath()` called after mutations

#### 1.3 Form Pattern
- **Form Library**: `react-hook-form` with `@hookform/resolvers/zod`
- **UI Components**: Shadcn `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`
- **Transitions**: `useTransition` for pending states during form submission
- **Notifications**: `toast()` from `@/hooks/use-toast` for success/error feedback
- **Client Components**: Forms are `"use client"` components

#### 1.4 UI Component Pattern
- **Tables**: `Table` from `@/components/ui/table` with `TableHeader`, `TableBody`, `TableRow`, `TableCell`
- **Cards**: `Card` with `CardHeader`, `CardTitle`, `CardContent` for content sections
- **Badges**: `Badge` with `variant` prop for status indicators
- **Buttons**: `Button` with `asChild` for Link wrapping
- **Layout**: Grid-based responsive layouts using Tailwind classes

#### 1.5 File Structure Pattern
```
app/admin/(protected)/[module]/
├── page.tsx                    # List page (Server Component)
├── [id]/
│   ├── page.tsx               # Detail/Edit page (Server Component)
│   └── actions.ts             # Server Actions for mutations
components/admin/[module]/
├── [module]-table.tsx         # Table component (Client Component)
└── [module]-form.tsx          # Form component (Client Component)
lib/data/
└── [module].ts                # Data fetching functions
types/
└── [module].ts                # TypeScript interfaces
```

---

## 2. Implementation Plan

### Files to Create

#### Types
- `types/posts.ts` - Post, PostDetail, PostListItem interfaces

#### Data Layer
- `lib/data/posts.ts` - fetchPostList, fetchPostDetail, fetchPhotosForPicker

#### Pages
- `app/admin/(protected)/blog/page.tsx` - Post list page
- `app/admin/(protected)/blog/[post-id]/page.tsx` - Post detail/edit page
- `app/admin/(protected)/blog/[post-id]/actions.ts` - Server actions (create, update, delete)
- `app/admin/(protected)/blog/new/page.tsx` - New post page

#### Components
- `components/admin/blog/post-table.tsx` - Posts data table
- `components/admin/blog/post-filters.tsx` - Filter controls for post list
- `components/admin/blog/post-pagination.tsx` - Pagination (may reuse photo pattern)
- `components/admin/blog/post-editor-form.tsx` - Post editor form
- `components/admin/blog/cover-image-selector.tsx` - Cover image picker (dual-track)
- `components/admin/blog/markdown-editor.tsx` - Markdown content editor

---

## 3. Schema Usage Confirmation

### Target Table: `posts`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key, auto-generated |
| `title` | text | Required |
| `slug` | text | Required, unique, kebab-case validated |
| `excerpt` | text | Optional, short summary |
| `content` | text | Markdown content |
| `cover_asset_id` | uuid | Required, references `assets(id)` |
| `gallery_photo_id` | uuid | Optional, references `photos(id)` |
| `status` | content_status | 'draft' \| 'published' \| 'archived' |
| `published_at` | timestamptz | When status changed to published |
| `visibility` | visibility | 'public' \| 'unlisted' \| 'private' |
| `created_at` | timestamptz | Auto-set on creation |
| `updated_at` | timestamptz | Auto-set on update |

### Related Tables Used

- `assets` - Cover image storage with `blurhash` and `dominant_color`
- `asset_rendition` - Thumbnails for list view (variant: 'thumb')
- `photos` - For gallery photo references (optional)
- `tags` - Via `post_tag` junction table
- `post_tag` - Junction table for post-tag relationships

### Dual-Track Cover Logic

1. **When selecting a Gallery Photo**:
   - Set `cover_asset_id` to the photo's `asset_original_id`
   - Set `gallery_photo_id` to the photo's `id`

2. **When uploading a standalone image**:
   - Create a new `assets` record
   - Set `cover_asset_id` to the new asset's `id`
   - Set `gallery_photo_id` to `null`

---

## 4. UI/UX Decisions

### Post List Page
- Table columns: Thumbnail, Title, Status (Badge), Published Date, Actions
- Status filter dropdown: All, Draft, Published, Archived
- Sort options: Created Date (default), Published Date, Title
- "New Post" button in header

### Post Editor Page
- Two-column layout on large screens (preview | form)
- Form sections:
  1. Title + Slug (auto-generate from title)
  2. Cover Image Selector
  3. Excerpt (short textarea)
  4. Content (Markdown editor)
  5. Status + Visibility controls
  6. Tags multi-select
- Save button with pending state
- Delete button with confirmation dialog

### Slug Generation
- Auto-generate from title on blur (if slug is empty)
- Kebab-case transformation: `"My Blog Post"` → `"my-blog-post"`
- Regex validation: `^[a-z0-9]+(?:-[a-z0-9]+)*$`
- Manual override allowed

---

## 5. Dependencies

### Existing (No new packages needed)
- `react-hook-form` + `@hookform/resolvers` - Form handling
- `zod` - Validation
- `date-fns` - Date formatting
- `lucide-react` - Icons
- All Shadcn UI components already installed

### New Component Consideration
- Markdown editor: Will create a simple `<Textarea>` wrapper with preview toggle
- No external markdown editor library needed for MVP
