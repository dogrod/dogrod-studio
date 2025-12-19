# Tag Management System

**Date**: 2024-12-18  
**Author**: AI Assistant  
**Status**: Implementation Complete

---

## Overview

A centralized Tag Management System for dogrod-studio, providing:
1. **Tag Manager Module** (`/admin/tags`) - CRUD interface for tags
2. **Smart Tag Input** (`TagInput.tsx`) - Reusable component with "magic create"

---

## 1. Database Schema (Strict Compliance)

### 1.1 Tags Table

```sql
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text unique,
  description text,
  color text, 

  -- Standard Audit Fields
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_by uuid references auth.users(id),
  updated_at timestamptz default now()
);
```

### 1.2 Tag Stats View (Security Invoker)

```sql
-- Accessed via: supabase.from('tag_stats').select('*')
-- Security: security_invoker = true (Respects RLS)
create view public.tag_stats as
select 
  t.id, t.name, t.slug, t.color, t.created_at, t.updated_at,
  (select count(*) from public.photo_tag pt where pt.tag_id = t.id) as photo_count,
  (select count(*) from public.post_tag pot where pot.tag_id = t.id) as post_count
from public.tags t;
```

### 1.3 Audit Field Compliance

| Operation | `created_by` | `updated_by` | `created_at` | `updated_at` |
|-----------|--------------|--------------|--------------|--------------|
| INSERT | Set to `user.id` | Set to `user.id` | DB default | DB default |
| UPDATE | — (unchanged) | Set to `user.id` | — (unchanged) | DB trigger |
| DELETE | N/A | N/A | N/A | N/A |

**Note**: The `updated_at` field is managed by a database trigger. We do NOT send it manually in update operations.

---

## 2. Files Created

### Types
- `types/tags.ts` - Tag, TagStats, CreateTagInput, UpdateTagInput, TAG_COLOR_PRESETS

### Data Layer
- `lib/data/tags.ts` - fetchTagStats, fetchTagById, fetchAllTags, isTagNameAvailable, isTagSlugAvailable

### Tag Manager Module
- `app/admin/(protected)/tags/page.tsx` - Tag list page (Server Component)
- `app/admin/(protected)/tags/tag-manager-client.tsx` - Client wrapper with state
- `app/admin/(protected)/tags/actions.ts` - Server Actions (create, update, delete, quickCreate)

### Components
- `components/admin/tags/tag-table.tsx` - Data table with usage stats
- `components/admin/tags/tag-form-dialog.tsx` - Create/Edit dialog with color picker
- `components/admin/tag-input.tsx` - Smart Tag Input combobox

### UI Components Added
- `components/ui/command.tsx` - Command component from Shadcn (for combobox)

---

## 3. Tag Manager Module (`/admin/tags`)

### Features
- **Data Table Columns**: Name (with color badge), Slug, Usage (photo/post counts), Created At, Actions
- **Usage Stats**: Displays photo_count and post_count from tag_stats view
- **Tooltips**: Hover on dates shows full timestamp; hover on counts shows details
- **Actions**: Edit (opens dialog), Delete (with confirmation)
- **Security**: Uses tag_stats view with `security_invoker` for RLS compliance

### Create/Edit Dialog
- **Fields**: Name, Slug (auto-generated, lockable after creation), Color (preset picker), Description
- **Validation**: Zod schema with unique name/slug checks
- **Auto-slug**: Generated from name on blur (kebab-case)

### Color Presets
18 Tailwind-based color options:
- Gray, Red, Orange, Amber, Yellow, Lime, Green, Emerald
- Teal, Cyan, Sky, Blue, Indigo, Violet, Purple, Fuchsia, Pink, Rose

---

## 4. Smart Tag Input (`TagInput.tsx`)

### Features
- **Multi-select**: Pills display with remove button
- **Search**: Filter existing tags
- **Magic Create**: Type new name → Enter or click "Create" → Instant tag creation
- **Keyboard Support**: Enter to create, click to select/deselect

### Props
```typescript
interface TagInputProps {
  options: TagOption[];           // Available tags
  value: string[];                // Selected tag IDs
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  allowCreate?: boolean;          // Enable magic create (default: true)
  onTagCreated?: (tag) => void;   // Callback when new tag created
}
```

### Magic Create Flow
1. User types a name not in the list
2. "Create [name]" option appears
3. User presses Enter or clicks
4. `quickCreateTagAction` called:
   - Checks if name exists (returns existing if so)
   - Generates slug
   - Creates with audit fields
5. Tag added to selection
6. Toast notification shown

---

## 5. Security Considerations

### RLS Compliance
- `tag_stats` view uses `security_invoker = true`
- All data fetching respects RLS policies
- Empty states handled gracefully if RLS filters out tags

### Audit Trail
- All write operations include `created_by` / `updated_by`
- User ID obtained via `requireUser()` before mutations
- `updated_at` managed by DB trigger (not sent in requests)

### Authentication
- Server actions call `requireUser()` first
- Unauthenticated requests will fail

---

## 6. Integration Points

### Using TagInput in Post Editor
```tsx
import { TagInput, TagOption } from "@/components/admin/tag-input";

// In your form:
const [tagOptions, setTagOptions] = useState<TagOption[]>(allTags);

<TagInput
  options={tagOptions}
  value={form.watch("tagIds")}
  onChange={(ids) => form.setValue("tagIds", ids)}
  onTagCreated={(tag) => setTagOptions(prev => [...prev, tag])}
/>
```

### Fetching Tags for Selection
```typescript
import { fetchAllTags } from "@/lib/data/tags";

// In Server Component:
const tags = await fetchAllTags();
```

---

## 7. Admin Dashboard Entry

Added to `/admin` dashboard:
```tsx
<AppCard
  title="Tags"
  icon="tags"
  href="/admin/tags"
/>
```

New icon "tags" added to `AppIconName` type and `iconMap` in `app-card.tsx`.
