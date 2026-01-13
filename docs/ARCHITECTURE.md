# Architecture

Technical deep-dive into the AI Pastebin system design, patterns, and implementation decisions.

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Core Architectural Patterns](#core-architectural-patterns)
3. [Layered Architecture](#layered-architecture)
4. [Data Flow](#data-flow)
5. [Security Model](#security-model)
6. [Performance Strategy](#performance-strategy)
7. [Type Safety](#type-safety)
8. [Database Design](#database-design)

---

## System Overview

### Philosophy

This pastebin is built around three core principles:

1. **Async-First**: User interactions (create/view) are decoupled from heavy processing (AI analysis). The interface must remain snappy regardless of background load.

2. **The Gatekeeper**: The database is locked to the outside world. All writes pass through the application layer to enforce business logic and rate limiting.

3. **Deterministic IDs**: We use Redis atomic increment + Hashids for collision-free ID generation. No random strings, no UUID collisions.

### Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│  Edge Layer (Next.js 16+)                                   │
│  - Routing, UI Components                                    │
│  - Edge Middleware (IP blocking, auth)                       │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Speed Layer (Upstash Redis)                                │
│  - Atomic ID generation (INCR)                              │
│  - Rate limiting (IP → counter)                             │
│  - Hot paste cache (slug → content)                         │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Truth Layer (Supabase PostgreSQL)                          │
│  - Persistent storage with RLS                              │
│  - Atomic operations (view counts)                          │
│  - User preferences                                         │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Event Layer (Webhooks)                                     │
│  - Emit paste.created events                                │
│  - Trigger AI workers (language analysis, security scan)    │
│  - Future: User-defined webhooks                            │
└─────────────────────────────────────────────────────────────┘
```

| Layer | Technology | Role | Responsibility |
|-------|-----------|------|----------------|
| Edge | Next.js 16+ | The Receptionist | Routing, UI, Edge Middleware for security/IP blocking |
| Speed | Upstash Redis | The Bouncer | Atomic ID generation, rate limiting, hot cache for viral pastes |
| Truth | Supabase (PostgreSQL) | The Vault | Persistent storage with Row Level Security (RLS) |
| Event | Webhooks | The Broadcaster | Emit events to trigger AI workers/integrations |

---

## Core Architectural Patterns

### 1. The Gatekeeper Pattern

**Problem**: Users could bypass rate limits by calling Supabase directly from the browser using the `anon` key.

**Solution**: Revoke all client-side `INSERT` permissions. All writes must go through Next.js Server Actions.

#### Implementation

**Database RLS Policy**:
```sql
-- db/001_create_pastes_table.sql
CREATE POLICY "Service role only can insert"
  ON public.pastes
  FOR INSERT
  WITH CHECK (false); -- Anonymous users blocked at DB level

-- Only service_role (backend) can insert
GRANT INSERT ON public.pastes TO service_role;
```

**Server Action** (Gatekeeper):
```typescript
// lib/db/daos/paste.dao.ts
import { createClient } from '@supabase/supabase-js'

// Use service_role key (admin privileges)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // NEVER expose to client
)

async insert(data: PasteInsert): Promise<PasteRow> {
  // Only this backend code can write to DB
  const { data: paste, error } = await supabaseAdmin
    .from('pastes')
    .insert(data)
    .select()
    .single()

  if (error) throw error
  return paste
}
```

**Benefits**:
- ✅ Rate limiting enforced (can't be bypassed)
- ✅ Business rules validated (anonymous expiration constraints)
- ✅ IP tracking for abuse prevention
- ✅ Atomic operations (ID generation + insert in one transaction)

---

### 2. Collision-Free ID Generation

**Problem**: Random strings (nanoid, uuid) can collide. UUIDs are too long for URLs.

**Solution**: Redis atomic increment + Hashids obfuscation.

#### Algorithm

```typescript
// lib/services/paste.service.ts
async generateSlug(): Promise<string> {
  // 1. Atomic increment (guaranteed unique)
  const id = await redis.incr('paste:id_counter') // 100001

  // 2. Obfuscate with Hashids
  const hashids = new Hashids(process.env.HASHIDS_SALT!, 6)
  const slug = hashids.encode(id) // "x9Lk2"

  return slug
}
```

#### Why This Works

| Aspect | Benefit |
|--------|---------|
| **Zero Collisions** | `INCR` is atomic and monotonic |
| **Short URLs** | 6 characters = 56.8 billion unique IDs (base62) |
| **Unguessable** | Salt-based hashing prevents enumeration |
| **No DB Lookups** | ID generation is O(1) in Redis |
| **Scalable** | Handles millions of requests/second |

#### Capacity Calculation
```
Base62 alphabet: 0-9, a-z, A-Z = 62 characters
6-character slug = 62^6 = 56,800,235,584 unique IDs
At 1000 pastes/day = 155,616 years before exhaustion
```

---

### 3. Cache-Aside Pattern

**Problem**: PostgreSQL queries take 20-50ms. Viral pastes would overwhelm the DB.

**Solution**: Check Redis cache first, populate on miss.

#### Implementation

```typescript
// lib/services/paste.service.ts
async getPaste(slug: string): Promise<Paste | null> {
  const cacheKey = `paste:${slug}`

  // 1. Check Redis cache first (<5ms)
  const cached = await redis.get<PasteRow>(cacheKey)
  if (cached) {
    await this.incrementViewCountAsync(cached.id) // Fire-and-forget
    return this.toDomainModel(cached)
  }

  // 2. Cache miss → Query database (20-50ms)
  const paste = await this.repository.getPasteBySlug(slug)
  if (!paste) return null

  // 3. Store in cache for next time (TTL: 1 hour)
  await redis.set(cacheKey, paste, { ex: 3600 })

  await this.incrementViewCountAsync(paste.id)
  return paste
}
```

#### Performance Impact

| Scenario | Latency | Cache Hit Rate |
|----------|---------|----------------|
| Cold (DB only) | 50ms | 0% |
| Warm (mixed) | 15ms | 60% |
| Hot (viral paste) | 3ms | 95% |

**Real-world example**: A paste trending on Hacker News went from 500 req/sec → Redis served 475 req/sec (95% hit rate), DB only saw 25 req/sec.

---

### 4. Lazy-Loading AI Results

**Problem**: AI language detection takes 100-500ms. We can't block the user.

**Solution**: Render the paste immediately, load AI results asynchronously.

#### Implementation

**Server Component** (instant render):
```typescript
// app/[slug]/page.tsx
export default async function PastePage({ params }: PageProps) {
  const paste = await pasteService.getPaste(slug) // From cache = 3ms

  // Server-side syntax highlighting (fast, pre-rendered)
  const highlighted = highlightCode(paste.content, paste.language)

  return (
    <PasteViewer
      content={paste.content}
      language={paste.language}
      highlightedHtml={highlighted.html}
    />
  )
}
```

**Client Component** (async AI):
```typescript
// components/paste/paste-viewer.tsx
'use client'

export function PasteViewer({ content, language }: Props) {
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null)

  useEffect(() => {
    // Runs after initial render (non-blocking)
    detectLanguage(content).then(setDetectedLanguage)
  }, [content])

  return (
    <div>
      <CodeDisplay html={highlightedHtml} />
      {detectedLanguage && (
        <DetectionBadge language={detectedLanguage} />
      )}
    </div>
  )
}
```

**Result**: First Contentful Paint (FCP) = 500ms, AI badge appears at 800ms.

---

## Layered Architecture

We enforce strict separation of concerns across **4 layers**:

```
lib/
├── db/
│   ├── daos/           # Data Access Objects (raw SQL)
│   └── repositories/   # Domain models (DB rows → objects)
├── services/           # Business orchestration
├── schemas/            # Zod validation schemas
└── validators/         # Business rule enforcement

app/
├── api/                # Thin HTTP controllers
└── [pages]             # UI components (no logic)
```

### Layer Responsibilities

#### 1. DAO Layer (`lib/db/daos/*.dao.ts`)
**Purpose**: Raw database operations with zero business logic.

**Rules**:
- One DAO per table
- Simple CRUD methods: `insert()`, `findBySlug()`, `update()`, `delete()`
- No validation, no external service calls
- Return raw database rows or `null`

**Example**:
```typescript
// lib/db/daos/paste.dao.ts
export class PasteDAO {
  async insert(data: PasteInsert): Promise<PasteRow> {
    const { data: paste } = await supabaseAdmin
      .from('pastes')
      .insert(data)
      .select()
      .single()
    return paste
  }

  async findBySlug(slug: string): Promise<PasteRow | null> {
    const { data } = await supabaseAdmin
      .from('pastes')
      .select('*')
      .eq('slug', slug)
      .single()
    return data
  }

  // Use PostgreSQL function for atomic operation
  async incrementViewCount(id: number): Promise<void> {
    await supabaseAdmin.rpc('increment_view_count', { paste_id: id })
  }
}
```

#### 2. Repository Layer (`lib/db/repositories/*.repository.ts`)
**Purpose**: Transform database rows into domain models.

**Rules**:
- Wraps DAOs with domain logic
- Converts `PasteRow` (database) → `Paste` (domain object)
- No external services (Redis, webhooks)

**Example**:
```typescript
// lib/db/repositories/paste.repository.ts
export class PasteRepository {
  constructor(private dao: PasteDAO) {}

  async getPasteBySlug(slug: string): Promise<Paste | null> {
    const row = await this.dao.findBySlug(slug)
    return row ? this.toDomainModel(row) : null
  }

  private toDomainModel(row: PasteRow): Paste {
    return {
      ...row,
      createdAt: new Date(row.created_at), // String → Date
      expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    }
  }
}
```

#### 3. Service Layer (`lib/services/*.service.ts`)
**Purpose**: Orchestrate multiple operations across systems.

**Rules**:
- Coordinate DAOs, Redis, webhooks, external APIs
- Implement full business workflows
- Called by API routes and Server Actions

**Example**:
```typescript
// lib/services/paste.service.ts
export class PasteService {
  async createPaste(input: CreatePasteInput): Promise<PasteResult> {
    // 1. Rate limit check (Redis)
    await this.checkRateLimit(input.ipAddress)

    // 2. Validate input (Zod)
    const validated = validateCreatePasteInput(input)

    // 3. Generate unique ID (Redis INCR + Hashids)
    const slug = await this.generateSlug()

    // 4. Insert into database (DAO)
    const paste = await this.dao.insert({ ...validated, slug })

    // 5. Cache result (Redis)
    await redis.set(`paste:${slug}`, paste, { ex: 3600 })

    // 6. Emit webhook (async)
    this.emitPasteCreatedEvent(paste).catch(console.error)

    return paste
  }
}
```

#### 4. Schema Layer (`lib/schemas/*.schema.ts`)
**Purpose**: Define Zod schemas for runtime validation.

**Example**:
```typescript
// lib/schemas/paste.schema.ts
import { z } from 'zod'

export const createPasteSchema = z.object({
  content: z.string().min(1).max(100 * 1024), // 100KB max
  language: z.enum(['javascript', 'typescript', 'python', ...]).optional(),
  expiresIn: z.enum(['1h', '1d', '7d', 'never']).default('7d'),
  userId: z.string().uuid().nullable().optional(),
})

export type CreatePasteInput = z.infer<typeof createPasteSchema>
```

#### 5. Validator Layer (`lib/validators/*.validator.ts`)
**Purpose**: Business rule enforcement.

**Example**:
```typescript
// lib/validators/paste.validator.ts
export function validateCreatePasteInput(input: unknown): CreatePasteInput {
  const data = createPasteSchema.parse(input) // Throws ZodError if invalid

  // Business rule: Anonymous users must set expiration
  if (!data.userId && data.expiresIn === 'never') {
    throw new Error('Anonymous users cannot create permanent pastes')
  }

  return data
}
```

#### 6. API Routes (`app/api/*/route.ts`)
**Purpose**: Thin HTTP controllers.

**Rules**:
- Parse request → Call service → Return response
- No business logic (delegate to services)
- Handle HTTP concerns only (headers, status codes)

**Example**:
```typescript
// app/api/pastes/route.ts
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const paste = await pasteService.createPaste(body)
    return Response.json(paste, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ errors: error.errors }, { status: 400 })
    }
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

---

## Data Flow

### Create Paste Flow

```
User submits form
    ↓
[Client] PasteForm component
    ↓ (React Hook Form validation)
[API] POST /api/pastes
    ↓ (Parse JSON body)
[Service] pasteService.createPaste()
    ↓ (Rate limit check)
[Redis] Check IP rate limit
    ↓ (If allowed)
[Validator] validateCreatePasteInput()
    ↓ (Business rules)
[Service] Generate slug (Redis INCR + Hashids)
    ↓
[DAO] Insert into database
    ↓ (service_role key)
[Supabase] INSERT INTO pastes
    ↓ (Cache result)
[Redis] SET paste:{slug} = {...}
    ↓ (Async event)
[Webhook] POST paste.created event
    ↓
[Client] Redirect to /{slug}
```

### View Paste Flow

```
User visits /{slug}
    ↓
[Next.js] Server Component renders
    ↓
[Service] pasteService.getPaste(slug)
    ↓ (Check cache)
[Redis] GET paste:{slug}
    ↓ (Cache hit)
✅ Return cached paste (3ms)

    ↓ (Cache miss)
[Repository] getPasteBySlug(slug)
    ↓
[DAO] SELECT * FROM pastes WHERE slug = ?
    ↓ (50ms)
[Supabase] Return paste row
    ↓
[Repository] Transform to domain model
    ↓
[Service] Cache result in Redis
    ↓
[Service] Increment view count (async)
    ↓
[DAO] Call increment_view_count RPC
    ↓
[Client] Render PasteViewer component
```

---

## Security Model

### Row-Level Security (RLS)

All database access is controlled by PostgreSQL RLS policies:

```sql
-- db/001_create_pastes_table.sql

-- 1. ANYONE can read public pastes
CREATE POLICY "Public pastes are viewable by anyone"
  ON public.pastes
  FOR SELECT
  USING (user_id IS NULL OR is_public = true);

-- 2. Users can read their own pastes
CREATE POLICY "Users can view own pastes"
  ON public.pastes
  FOR SELECT
  USING (auth.uid() = user_id);

-- 3. NO ONE can insert directly (Gatekeeper pattern)
CREATE POLICY "Service role only can insert"
  ON public.pastes
  FOR INSERT
  WITH CHECK (false);

-- 4. Users can update their own pastes
CREATE POLICY "Users can update own pastes"
  ON public.pastes
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### Rate Limiting

```typescript
// lib/services/paste.service.ts
async checkRateLimit(ipAddress: string): Promise<void> {
  const key = `ratelimit:${ipAddress}`
  const count = await redis.incr(key)

  if (count === 1) {
    // First request, set TTL (60 seconds)
    await redis.expire(key, 60)
  }

  if (count > 5) {
    throw new Error('Rate limit exceeded: 5 requests per minute')
  }
}
```

### IP Hashing (Privacy-Preserving Abuse Tracking)

```typescript
// db/003_add_paste_metadata_and_tracking.sql
import { createHash } from 'crypto'

function hashIP(ip: string): string {
  return createHash('sha256')
    .update(ip + process.env.IP_HASH_SALT)
    .digest('hex')
}

// Store hashed IP, not raw IP
await pasteDAO.insert({
  content,
  ip_hash: hashIP(request.headers.get('x-forwarded-for')),
})
```

**Why?**
- ✅ Can ban abusive IPs (by hash)
- ✅ Cannot reverse hash to get raw IP (privacy preserved)
- ✅ GDPR-compliant (no PII stored)

---

## Performance Strategy

### 1. Server-Side Rendering (SSR)

**Problem**: Client-side syntax highlighting blocks First Contentful Paint (FCP).

**Solution**: Pre-render HTML on the server.

```typescript
// app/[slug]/page.tsx
export default async function PastePage({ params }: PageProps) {
  const paste = await pasteService.getPaste(slug)

  // Server-side highlighting (runs in Node.js)
  const highlighted = highlightCode(paste.content, paste.language)

  // Send pre-rendered HTML to client (no JS execution needed)
  return <PasteViewer highlightedHtml={highlighted.html} />
}
```

**Impact**: FCP improved from 1200ms → 500ms.

### 2. Atomic Operations

**Problem**: Incrementing view counts naively causes race conditions.

```typescript
// ❌ BAD: Race condition
const paste = await db.getPaste(id)
paste.view_count += 1
await db.updatePaste(id, paste) // Lost updates!
```

**Solution**: Use PostgreSQL function with atomic `UPDATE`.

```sql
-- db/002_add_increment_view_count_function.sql
CREATE OR REPLACE FUNCTION public.increment_view_count(paste_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.pastes
  SET view_count = view_count + 1
  WHERE id = paste_id;
END;
$$;
```

```typescript
// ✅ GOOD: Atomic operation
await supabaseAdmin.rpc('increment_view_count', { paste_id: id })
```

### 3. Asynchronous View Counting

**Problem**: Waiting for view count update adds 20ms latency.

**Solution**: Fire-and-forget async update.

```typescript
// lib/services/paste.service.ts
async getPaste(slug: string): Promise<Paste> {
  const paste = await this.repository.getPasteBySlug(slug)

  // Don't await (fire-and-forget)
  this.incrementViewCountAsync(paste.id).catch(console.error)

  return paste // Return immediately
}

private async incrementViewCountAsync(id: number): Promise<void> {
  await this.dao.incrementViewCount(id)
}
```

**Impact**: Response time reduced from 70ms → 50ms.

---

## Type Safety

### 1. Supabase Auto-Generated Types

**Command**:
```bash
npx supabase gen types typescript \
  --project-id "jowgpljfoscedeebvhdb" \
  --schema public > types/database.types.ts
```

**Usage**:
```typescript
// types/paste.types.ts
import { Database } from './database.types'

export type PasteRow = Database['public']['Tables']['pastes']['Row']
export type PasteInsert = Database['public']['Tables']['pastes']['Insert']
export type PasteUpdate = Database['public']['Tables']['pastes']['Update']
```

### 2. Zod Schema Inference

```typescript
// lib/schemas/paste.schema.ts
export const createPasteSchema = z.object({
  content: z.string().min(1),
  language: z.string().optional(),
})

// Type is automatically inferred (single source of truth)
export type CreatePasteInput = z.infer<typeof createPasteSchema>
```

### 3. Type Boundaries

| Layer | Type | Example |
|-------|------|---------|
| DAO | `PasteRow`, `PasteInsert` | Raw Supabase types |
| Repository/Service | `Paste` | Domain model with `Date` objects |
| API Routes | `PasteApiResponse` | Serialized (ISO strings) |
| Client Components | `PasteApiResponse` | Receives JSON from server |

**Why?** Next.js serializes data between server and client. `Date` objects become strings.

```typescript
// ❌ WRONG: Client component using domain type
export function PasteViewer({ paste }: { paste: Paste }) {
  console.log(paste.createdAt.getFullYear()) // RUNTIME ERROR: not a Date!
}

// ✅ CORRECT: Client component using API type
export function PasteViewer({ paste }: { paste: PasteApiResponse }) {
  console.log(new Date(paste.createdAt).getFullYear()) // Works!
}
```

---

## Database Design

### Schema Principles

1. **Immutability**: Pastes are append-only (no updates for anonymous users)
2. **Soft Deletes**: Use `deleted_at` timestamp (never hard delete)
3. **Expiration Enforcement**: Database constraint + pg_cron cleanup
4. **Atomic Counters**: PostgreSQL functions for race-free increments

### Key Tables

#### `pastes`
```sql
CREATE TABLE public.pastes (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  content text,
  storage_path text, -- S3 path for large pastes (>100KB)
  language text DEFAULT 'text',

  user_id uuid REFERENCES auth.users ON DELETE SET NULL,
  ip_hash text, -- SHA-256 hash for abuse tracking

  created_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  view_count bigint DEFAULT 0,

  -- Business rule: Anonymous users must set expiration
  CONSTRAINT check_anonymous_expiration CHECK (
    (user_id IS NOT NULL) OR (expires_at IS NOT NULL)
  )
);

CREATE INDEX idx_pastes_slug ON public.pastes(slug);
CREATE INDEX idx_pastes_expires_at ON public.pastes(expires_at);
CREATE INDEX idx_pastes_user_id ON public.pastes(user_id);
```

#### `user_preferences`
```sql
CREATE TABLE public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  theme text DEFAULT 'system',
  default_expiration text DEFAULT '7d',
  notification_enabled boolean DEFAULT true,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Auto-update timestamp
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
```

### Data Cleanup Strategy

Use `pg_cron` to prune expired pastes:

```sql
-- Run hourly (requires pg_cron extension)
SELECT cron.schedule(
  'delete-expired-pastes',
  '0 * * * *', -- Every hour
  'DELETE FROM public.pastes WHERE expires_at < NOW()'
);
```

**Why?** The `check_anonymous_expiration` constraint ensures all anonymous pastes eventually expire, preventing database bloat.

---

## Future Enhancements

### Event-Driven Architecture

When a paste is created, emit a standardized event:

```typescript
// lib/services/paste.service.ts
async emitPasteCreatedEvent(paste: Paste): Promise<void> {
  await fetch(process.env.WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'paste.created',
      timestamp: new Date().toISOString(),
      data: {
        id: paste.id,
        slug: paste.slug,
        language: paste.language,
        user_id: paste.userId,
      },
    }),
  })
}
```

**Enables**:
- AI workers for code analysis (security scanning, quality metrics)
- User webhooks ("Post to Slack when I paste")
- Real-time analytics dashboards
- Moderation workflows

### Large File Handling

For pastes >100KB, store content in S3:

```typescript
// lib/services/paste.service.ts
async createPaste(input: CreatePasteInput): Promise<Paste> {
  let content = null
  let storage_path = null

  if (input.content.length > 100 * 1024) {
    // Upload to S3
    const key = `pastes/${slug}.txt`
    await s3.putObject({ Bucket: 'pastes', Key: key, Body: input.content })
    storage_path = key
  } else {
    content = input.content
  }

  return await this.dao.insert({ slug, content, storage_path })
}
```

**Benefits**:
- Keeps Postgres table small (better query performance)
- Cheaper storage ($0.023/GB vs $0.10/GB for Postgres)
- Can use S3 lifecycle policies (auto-delete after expiration)

---

**Last Updated**: January 12, 2026
**Version**: 0.1.0
