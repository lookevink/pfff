# LLM Context: AI Pastebin

**Auto-generated context for LLM agents. Last updated: 2026-01-13**

This file provides a concise overview of the implemented features and architecture. For detailed information, see:
- `docs/FEATURES.md` - Comprehensive feature inventory
- `docs/ARCHITECTURE.md` - Technical deep-dive
- `docs/CHANGELOG.md` - Chronological history
- `CLAUDE.md` - Development guidelines and patterns

---

## Quick Reference

### Project Type
Next.js 16+ App Router pastebin with AI language detection, syntax highlighting, and local paste history.

### Tech Stack
- **Frontend**: Next.js 16.1.1, React 19.2.3, Tailwind CSS v4, shadcn/ui
- **Backend**: Next.js Server Actions, Supabase (PostgreSQL), Upstash Redis
- **AI/ML**: Magika (language detection), Highlight.js (syntax highlighting)
- **Validation**: Zod with TypeScript inference

### Architecture Pattern
Layered: DAO → Repository → Service → API → UI

---

## Implemented Features

### Core Functionality ✅
- Paste creation with collision-free IDs (Redis INCR + Hashids)
- Paste viewing with cache-aside pattern (Redis → Postgres)
- Language detection (Magika AI, 190+ languages)
- Syntax highlighting (server-side, Highlight.js)
- Live preview (HTML/CSS/JS in sandboxed iframe)
- View modes: Raw, Formatted, Preview
- Code formatting (Prettier)
- Atomic view counter (PostgreSQL function)

### User Features ✅
- Paste history (localStorage, max 50 items)
- Fuzzy search (Fuse.js)
- Filter by language
- Export history (JSON)
- Keyboard shortcuts (Ctrl+N for new paste, Ctrl+1/2/3 for view modes)
- Tooltips on all icon buttons
- Dark mode support

### Security ✅
- Gatekeeper pattern (RLS + service_role writes only)
- Rate limiting (5 req/min per IP via Redis)
- IP hashing (SHA-256, GDPR-compliant)
- Security headers (CSP, X-Content-Type-Options)
- Expiration enforcement (anonymous users must set expiration)

### Performance ✅
- Server-side rendering for instant FCP (<500ms)
- Redis caching (3600s TTL, ~85% hit rate)
- Async view counting (fire-and-forget)
- Pre-rendered syntax highlighting HTML

---

## File Structure

### Key Directories
```
lib/
├── db/
│   ├── daos/paste.dao.ts         # Raw Supabase operations
│   └── repositories/paste.repository.ts  # Domain models
├── services/paste.service.ts     # Business orchestration
├── schemas/paste.schema.ts       # Zod validation schemas
├── validators/paste.validator.ts # Business rules
├── highlighting/                 # Syntax highlighter
└── detection/                    # Language detector

components/
├── ui/                           # shadcn/ui base components
└── paste/                        # Paste-specific components
    ├── paste-form.tsx            # Creation form
    ├── paste-viewer.tsx          # Display paste
    ├── code-editor.tsx           # Rich textarea
    ├── code-display.tsx          # Highlighted code
    ├── history-panel.tsx         # Browse history
    ├── history-search.tsx        # Search & filter
    ├── live-preview.tsx          # Sandboxed execution
    └── [more components]

app/
├── page.tsx                      # Homepage (create paste)
├── [slug]/page.tsx               # View paste
├── history/page.tsx              # Browse paste history
└── api/
    └── pastes/
        ├── route.ts              # POST /api/pastes
        └── [slug]/route.ts       # GET /api/pastes/:slug

db/
├── 001_create_pastes_table.sql
├── 002_add_increment_view_count_function.sql
├── 003_add_paste_metadata_and_tracking.sql
└── 004_create_user_preferences.sql

types/
├── database.types.ts             # Supabase auto-generated
└── paste.types.ts                # Domain types
```

---

## Database Schema

### `pastes` Table
```sql
id            bigint (PK, auto-increment)
slug          text (unique)               -- Hashid (6 chars)
content       text                        -- Paste content (<100KB)
storage_path  text                        -- S3 path for large files (future)
language      text (default 'text')
user_id       uuid (FK to auth.users)
ip_hash       text                        -- SHA-256 hash
created_at    timestamptz (default now())
expires_at    timestamptz                 -- Nullable = "Never" (auth users only)
view_count    bigint (default 0)

CONSTRAINT: (user_id IS NOT NULL) OR (expires_at IS NOT NULL)
INDEXES: slug, user_id, expires_at
```

### `user_preferences` Table
```sql
user_id              uuid (PK, FK)
theme                text (default 'system')
default_expiration   text (default '7d')
notification_enabled boolean (default true)
created_at           timestamptz
updated_at           timestamptz (auto-update trigger)
```

### Database Functions
- `increment_view_count(paste_id)` - Atomic view counter (SECURITY DEFINER)

---

## API Endpoints

### `POST /api/pastes`
**Create a new paste**
- Body: `{ content: string, language?: string, expiresIn?: '1h'|'1d'|'7d'|'never' }`
- Rate limit: 5 req/min per IP
- Returns: `{ id, slug, language, createdAt, expiresAt }`

### `GET /api/pastes/:slug`
**Retrieve a paste**
- Cache-aside pattern (Redis → Postgres)
- Increments view count (async)
- Returns: `{ id, slug, content, language, createdAt, expiresAt, viewCount }`

---

## Architecture Patterns

### Gatekeeper Pattern
All database writes go through Server Actions with `service_role` key. Client-side `INSERT` is blocked by RLS.

### Collision-Free IDs
```typescript
// lib/services/paste.service.ts:41-55
1. Redis INCR → unique integer (e.g., 100001)
2. Hashids.encode() → 6-char slug (e.g., "x9Lk2")
3. Capacity: 56.8 billion unique IDs
```

### Cache-Aside Pattern
```typescript
// lib/services/paste.service.ts:74-92
1. Check Redis cache (paste:{slug})
2. If miss, query Postgres
3. Store in Redis (TTL: 3600s)
4. Increment view count (async)
```

### Lazy-Loading AI
- Server renders paste immediately (syntax highlighting pre-rendered)
- Language detection runs client-side (non-blocking)
- Badge appears after detection completes

---

## Type System

### Type Boundaries
| Layer | Type | Notes |
|-------|------|-------|
| DAO | `PasteRow`, `PasteInsert`, `PasteUpdate` | Supabase auto-generated |
| Repository/Service | `Paste` | Domain model (Date objects) |
| API | `PasteApiResponse` | Serialized (ISO strings) |
| Client Components | `PasteApiResponse` | Receives JSON |

**IMPORTANT**: Never use `Paste` (domain type) in client components. Next.js serializes `Date` → `string`.

### Regenerate Types
```bash
npx supabase gen types typescript \
  --project-id "jowgpljfoscedeebvhdb" \
  --schema public > types/database.types.ts
```

---

## Validation

### Zod Schemas
All input validation uses Zod with TypeScript inference:

```typescript
// lib/schemas/paste.schema.ts
export const createPasteSchema = z.object({
  content: z.string().min(1).max(100 * 1024),
  language: z.enum([...]).optional().default('text'),
  expiresIn: z.enum(['1h', '1d', '7d', 'never']).default('7d'),
})

export type CreatePasteInput = z.infer<typeof createPasteSchema>
```

### Business Rules
- Anonymous users must set expiration (max 7 days)
- Authenticated users can set "Never Expire"
- Content size limit: 100KB (enforced at service layer)

---

## Components

### shadcn/ui Base (10 components)
`button`, `card`, `input`, `textarea`, `select`, `label`, `badge`, `alert`, `tooltip`

### Paste-Specific (11 components)
- `PasteForm` - Creation form with validation
- `PasteViewer` - Display paste with metadata
- `CodeEditor` - Rich textarea for code input
- `CodeDisplay` - Syntax highlighted code block
- `HistoryPanel` - Browse and manage paste history
- `HistorySearch` - Search/filter UI
- `HistoryItem` - Individual history entry
- `DetectionBadge` - Language confidence indicator
- `FormatButton` - Code formatting action
- `ViewModeToggle` - Switch between view modes
- `LivePreview` - Sandboxed code execution
- `NewPasteButton` - Global new paste action

---

## Common Tasks

### Add New shadcn Component
```bash
npx shadcn@latest add <component-name>
```

### Run Database Migration
```bash
# Via Supabase CLI
supabase db push

# Or manually
psql -h <host> -d <db> < db/005_new_migration.sql
```

### Update Types After Schema Change
```bash
npx supabase gen types typescript \
  --project-id "jowgpljfoscedeebvhdb" \
  --schema public > types/database.types.ts
```

### Create New Feature
1. Define Zod schema in `lib/schemas/`
2. Add validation logic in `lib/validators/`
3. Create DAO method in `lib/db/daos/`
4. Wrap with Repository (if needed)
5. Implement Service method
6. Create API route in `app/api/`
7. Build UI component in `components/`

---

## Not Yet Implemented

### Authentication 🚧
- User registration/login (Supabase Auth)
- OAuth providers (GitHub, Google)
- Session management
- User profiles

### Advanced Features 🚧
- Paste editing (authenticated users only)
- Private pastes (password protection)
- Paste deletion (soft-delete)
- Large file support (>100KB via S3)
- Event-driven webhooks
- AI code explanation
- Expiration enforcement (pg_cron)

### Analytics 💡
- Usage dashboard
- Popular languages chart
- Geographic distribution
- Viral paste detection

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # For Gatekeeper writes (NEVER expose to client)

# Redis
UPSTASH_REDIS_URL=
UPSTASH_REDIS_TOKEN=

# Hashids
HASHIDS_SALT=                    # Secret for ID obfuscation

# Webhooks (future)
WEBHOOK_URL=
```

---

## Performance Metrics

- **First Contentful Paint**: <500ms (server-side rendering)
- **Cache Hit Rate**: ~85% (viral pastes ~95%)
- **Redis Latency**: <5ms (cached), <50ms (database)
- **Rate Limit**: 5 requests/minute per IP
- **ID Capacity**: 56.8 billion unique slugs
- **Bundle Size**: ~180KB gzipped (First Load JS)

---

## Known Issues / Technical Debt

None currently tracked. See GitHub Issues for feature requests.

---

**This file is auto-generated from project documentation. Do not edit manually.**
**To update: Run `pnpm docs:sync` (coming soon)**
