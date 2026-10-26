# Smart Gallery — Handoff for New Session

## Current State
- **Branch:** `main`, clean working tree
- **Last commits:**
  - `ab8b10d` — refactor: remove duplicate toolbar buttons, SpeedDial handles all actions
  - `049070e` — fix: SpeedDial with 5 actions, removed public-link card, fixed header alignment
  - `e506901` — chore: remove unused Copy import
  - `0bfc0c1` — feat: SpeedDial panel v1
- **Deploy:** Vercel auto-deploys from `main` → `aleksandr-faraonov.vercel.app`
- **Working dir:** `C:/Users/Александр/projects/smart-gallery/lovable-export`

## What We Did (Addressing 4 User Comments)

### Comment 1: Header Height Alignment
- **Problem:** "Назад в кабинет" + "Съёмка #0023E8" высота не выровнена с h1
- **Fix:** Wrapped both in `flex items-center gap-2` div, removed `mt-3` from `d-kicker`
- **File:** `src/routes/gallery/$id.tsx` (around line 735)

### Comment 2: Public Link Card Removal
- **Problem:** "Публичная ссылка" плашка не должна быть на странице
- **Fix:** Removed the card entirely, button moved into SpeedDial
- **File:** `src/routes/gallery/$id.tsx`

### Comment 3: SpeedDial Replacement
- **Problem:** Replace "Перезапустить AI-отбор" button with SpeedDial
- **Fix:** 
  - `SpeedDial.tsx` rewritten with 5 actions (no framer-motion, CSS animations only)
  - Actions: AI-отбор, AI-описание, Скачать ZIP, Публичная ссылка, Удалить всё
  - Buttons appear upward from bottom-right corner
- **Files:** `src/components/SpeedDial.tsx`, `src/routes/gallery/$id.tsx`

### Comment 4: Current State Screenshot
- User showed Comment 4: "Вот как все сейчас выглядит"
- Removed duplicate toolbar buttons (download ZIP, delete session) — now only in SpeedDial

## Watermark Implementation

### Requirement
- Client downloads ALL photos without filtering
- Watermark must work
- Question: download with or without watermark?
- **Decision:** Client (public-gallery) downloads WITH watermark; Photographer (gallery) downloads WITHOUT

### Implementation
- `getWatermarkedUrl(imageUrl, profile)` in `src/lib/cloudinary.ts`
  - Text watermark: `l_text:FontFamily_Size_bold:Text,co_white,o_OPACITY,g_gravity,x_OFFSET,y_OFFSET`
  - Image watermark: `l_image:publicId,o_OPACITY,g_gravity,x_OFFSET,y_OFFSET`
  - Always adds `q_auto` for optimization
- `public-gallery/$id.tsx`: `downloadAsZip` and `downloadSinglePhoto` now accept `profile` param
  - Wraps URLs with `getWatermarkedUrl` if `profile.watermarkEnabled && profile.watermarkType !== "none"`
- `gallery/$id.tsx`: Downloads remain clean (no watermark param)

### Remaining Questions
- Watermark design needs review (font, size, position, opacity) — user mentioned settings in `settings.tsx`
- Logo upload workflow needs testing

## SpeedDial Component

**Interface:**
```typescript
interface SpeedDialProps {
  shootId: string
  hasAiResults?: boolean
  publicUrl?: string
  loading?: { curate: boolean; describe: boolean; download: boolean; deleteAll: boolean }
  onCurate: () => void
  onDescribeAll: () => void
  onDownloadZip: () => void
  onDeleteAll: () => void
}
```

**Usage in gallery/$id.tsx:**
```tsx
<SpeedDial
  shootId={record.shootId}
  hasAiResults={!!record?.aiResults?.length}
  publicUrl={publicUrl}
  loading={{
    curate: curating,
    describe: aiDescriptionLoading,
    download: zipping,
    deleteAll: deleting,
  }}
  onCurate={runCurate}
  onDescribeAll={fetchAiDescription}
  onDownloadZip={handleDownloadZip}
  onDeleteAll={clearCloudinaryFolder}
/>
```

## AI Evaluation Status

- `/api/curate` endpoint handles AI scoring for all photos in session
- `/api/all-photos-with-ai` endpoint also exists
- `/api/ai-description` endpoint for photo descriptions
- `gallery/$id.tsx`: `runCurate()` handles AI evaluation for entire session
- `fetchAiDescription()` handles AI descriptions
- SpeedDial calls both of these via `onCurate` and `onDescribeAll` props

## What's NOT Done / Remaining Issues

1. **AI описание (onDescribeAll)**: `fetchAiDescription` is currently designed for single photo (lightbox context). Need to create a mass description handler for all photos in session.
2. **AI-отбор reliability**: User commented "не стоит сильно полагаться на ИИ отбор" — it's optional, photographer's judgment takes precedence.
3. **SpeedDial direction**: User said "в какую сторону выезжать будет не понятно еще" — currently buttons expand upward, but user may want to change this.

## Key Files

| File | Purpose |
|------|---------|
| `src/components/SpeedDial.tsx` | Floating action menu, 5 actions |
| `src/routes/gallery/$id.tsx` | Photographer's gallery page (clean, SpeedDial) |
| `src/routes/public-gallery/$id.tsx` | Client page (watermark CSS overlay + watermarked downloads) |
| `src/lib/cloudinary.ts` | `getWatermarkedUrl()` function |
| `src/lib/firebase.ts` | UserProfile type with watermark settings |
| `src/routes/api/curate.ts` | AI curation endpoint |
| `src/routeTree.gen.ts` | Auto-generated routes (DO NOT EDIT) |

## User Preferences (from derzkij-composition skill)
- One concrete next command, not a menu of options
- When paused, return to current plan
- `write_file` often blocked; use `patch` for .tsx edits
- Python fallback for stale_write_blocked: `execute_code` with `open(path, 'w').write()`
- Git push may timeout from Russia; commit first, retry push
- Build errors: check syntax before commit, check for undefined variables

## Git Push
```
git add -A
git commit -m "message"
git push origin main
# If push times out: nohup git push origin main > /tmp/git-push.log 2>&1 &
```
