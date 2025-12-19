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

### Post List Page (Grouped Matrix View) - Updated 2024-12-18
- **View Model**: Posts are grouped by `translation_group_id` instead of flat list
- **Row Entity**: Each row represents a `PostGroup` (all translations of one article)
- **Table columns**:
  - Cover thumbnail (from primary post)
  - Title (from primary post, with fallback indicator if not zh-CN)
  - Translations Matrix (language badges)
  - Published Date
  - Created Date
- **Translations Matrix**:
  - Shows badges for each supported language (ZH, EN)
  - **Existing translation**: Solid colored badge (green=published, amber=draft)
  - **Missing translation**: Dashed ghost badge with "+" icon, 50% opacity
  - Click existing → Navigate to edit page
  - Click missing → Create translation and redirect
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

---

## 6. Multi-language Support (i18n) - Added 2024-12-18

### Database Fields Added
- `language` ('zh-CN' | 'en-US') - Post language
- `translation_group_id` (UUID) - Groups translations together

### Implementation

#### New Components
- `components/admin/blog/translations-sidebar.tsx` - Sidebar widget showing translation status and actions

#### Updated Files
- `types/posts.ts` - Added `PostLanguage`, `TranslationLink`, `PostGroup`, `SUPPORTED_LANGUAGES`
- `lib/data/posts.ts` - Added `fetchTranslations()`, `getExistingLanguages()`
- `app/admin/(protected)/blog/[post-id]/actions.ts` - Added `createTranslationAction()`
- `components/admin/blog/post-editor-form.tsx` - Added language selector, translation_group_id handling
- `components/admin/blog/post-table.tsx` - **Refactored to Grouped Matrix View**
- `app/admin/(protected)/blog/[post-id]/page.tsx` - Added translations sidebar

### Grouped Matrix View (Post List Refactor) - Added 2024-12-18

The post list now uses a "Grouped Matrix View" instead of a flat list:

#### Data Transformation
```typescript
interface PostGroup {
  groupId: string;           // translation_group_id
  primaryPost: PostListItem; // Prefer zh-CN, fallback to en-US
  variants: Partial<Record<PostLanguage, PostListItem>>;
  createdAt: string;         // Earliest created_at for sorting
}
```

#### Implementation Details
- `groupPostsByTranslation()` function transforms flat post list into groups
- Uses `useMemo` for performance optimization
- Groups sorted by `createdAt` descending (newest first)
- Primary post selection: zh-CN > en-US > first available
- Fallback indicator (amber icon) when primary is not zh-CN

#### Language Matrix Badges
| State | Appearance | Action |
|-------|------------|--------|
| Published | Green solid badge | Navigate to edit |
| Draft | Amber solid badge | Navigate to edit |
| Archived | Gray outline badge | Navigate to edit |
| Missing | Dashed ghost badge (+) | Create translation |

### UX Flow
1. **Creating a New Post**:
   - `translation_group_id` auto-generates a new UUID
   - Default `language`: 'zh-CN'
   - Language selector available (cannot be changed after creation)

2. **Translation Management (In Edit Page)**:
   - Translations sidebar shows current language and other translations
   - "Add English" or "Add 中文" button creates new translation
   - Translation copies: `translation_group_id`, `cover_asset_id`, `gallery_photo_id`, tags
   - Redirects to new translation editor after creation
