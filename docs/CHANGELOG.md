# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- User authentication (Supabase Auth)
- OAuth providers (GitHub, Google)
- Private pastes with password protection
- Paste editing (authenticated users only)
- Event-driven webhook system
- AI code explanation (async processing)
- Paste expiration enforcement (pg_cron)
- Large file support (>100KB via S3)

---

## [0.1.0] - 2026-01-12

### Added - Paste History Management
- **Paste History Panel** - Browser-based storage of user's paste history
  - Local storage persistence (max 50 items)
  - Automatic title generation from content
  - Last viewed timestamp tracking
  - Commit: `55820eb`

- **Fuzzy Search** - Fuse.js integration for intelligent history search
  - Search across title, content preview, and language
  - Real-time search results (<10ms for 1000 items)
  - Commit: `55820eb`

- **Language Filter** - Quick filtering by programming language
  - Dropdown with language icons
  - Shows count of pastes per language
  - Commit: `55820eb`

- **Export Functionality** - JSON export of entire paste history
  - Structured format with all metadata
  - One-click download as `paste-history.json`
  - Commit: `55820eb`

### Added - User Experience Improvements
- **New Paste Button** - Global action button with hotkey
  - Keyboard shortcut: `Ctrl+N` (works on any page)
  - Tooltip integration
  - Navigation to homepage
  - Commit: `0a06209`

- **Tooltips** - shadcn/ui Tooltip component
  - Applied to all icon buttons
  - Shows keyboard shortcuts where applicable
  - Commit: `0a06209`

---

## [0.1.0] - 2026-01-11

### Added - Syntax Highlighting & Preview
- **Server-Side Syntax Highlighting** - Highlight.js integration
  - 190+ language support
  - Pre-rendered HTML for instant First Contentful Paint
  - Custom theme support
  - Commit: `39be102`

- **Live Preview** - Interactive code execution
  - HTML/CSS/JavaScript sandboxed iframe
  - Real-time rendering
  - CSP headers for security
  - Commit: `39be102`

- **View Mode Toggle** - 3 presentation modes
  - Raw (plain text with line numbers)
  - Formatted (syntax highlighted)
  - Preview (live execution)
  - Keyboard shortcuts: `Ctrl+1/2/3`
  - Commit: `39be102`

### Added - AI Language Detection
- **Magika Integration** - Google AI language detection
  - 190+ languages with confidence scoring
  - Runs client-side (no server overhead)
  - Fallback to heuristic detection
  - Commit: `ab8749e`

- **Language Detection Badge** - Visual confidence indicator
  - Shows detected language + confidence %
  - Icon support for popular languages
  - Commit: `ab8749e`

### Added - Code Formatting
- **Prettier Integration** - In-place code formatting
  - JavaScript, TypeScript, JSON, CSS, HTML, Markdown
  - Format button with loading state
  - Error handling for invalid syntax
  - Commit: `ab8749e`

- **Format Button Component** - Reusable formatting UI
  - Tooltip explaining supported languages
  - Visual feedback on format success/failure
  - Commit: `ab8749e`

### Added - Core Paste Functionality
- **Paste Creation API** - REST endpoint for creating pastes
  - Endpoint: `POST /api/pastes`
  - Zod validation with structured error responses
  - Rate limiting (5 req/min per IP)
  - Security headers (CSP, X-Content-Type-Options)
  - Commit: `fe490d4`

- **Paste Viewing API** - REST endpoint for retrieving pastes
  - Endpoint: `GET /api/pastes/:slug`
  - Cache-aside pattern (Redis → Postgres)
  - Async view count increment
  - 404 handling for missing pastes
  - Commit: `fe490d4`

- **Paste Form Component** - Rich code editor UI
  - React Hook Form + Zod validation
  - Textarea with monospace font
  - Language selector (190+ options)
  - Expiration time picker
  - Character count indicator
  - Commit: `fe490d4`

- **Paste Viewer Component** - Display paste with metadata
  - Syntax highlighted code display
  - View count badge
  - Created/expires timestamps
  - Copy to clipboard button
  - Commit: `fe490d4`

### Added - Database Schema
- **Pastes Table** - Core data model
  - Columns: `id`, `slug`, `content`, `storage_path`, `language`, `user_id`, `ip_hash`, `created_at`, `expires_at`, `view_count`
  - Constraint: Anonymous users must set expiration
  - Indexes: `slug` (unique), `user_id`, `expires_at`
  - RLS policies: Gatekeeper pattern (service_role only inserts)
  - Commit: `4dfb25a`
  - File: `db/001_create_pastes_table.sql`

- **View Count Function** - Atomic increment operation
  - PostgreSQL function: `increment_view_count(paste_id)`
  - Prevents race conditions
  - Security: `SECURITY DEFINER` to bypass RLS
  - Commit: `efdd483`
  - File: `db/002_add_increment_view_count_function.sql`

- **Paste Metadata** - Additional tracking fields
  - Added: `ip_hash` (SHA-256 for abuse tracking)
  - Added: `last_viewed_at` (for analytics)
  - Updated: `view_count` default value
  - Commit: `9ba67f6`, `de19c4d`
  - File: `db/003_add_paste_metadata_and_tracking.sql`

- **User Preferences Table** - User settings storage
  - Columns: `user_id`, `theme`, `default_expiration`, `notification_enabled`, `created_at`, `updated_at`
  - RLS policies: Users can only access their own preferences
  - Auto-updating `updated_at` trigger
  - Commit: `9ba67f6`
  - File: `db/004_create_user_preferences.sql`

### Added - Architecture Layers
- **DAO Layer** - Data Access Objects
  - `PasteDAO`: Raw Supabase operations
  - Methods: `insert()`, `findBySlug()`, `incrementViewCount()`
  - Uses `service_role` key for Gatekeeper pattern
  - Commit: `fe490d4`
  - File: `lib/db/daos/paste.dao.ts`

- **Repository Layer** - Domain models
  - `PasteRepository`: Transforms DB rows to domain objects
  - Converts timestamps to `Date` objects
  - No external service dependencies
  - Commit: `fe490d4`
  - File: `lib/db/repositories/paste.repository.ts`

- **Service Layer** - Business orchestration
  - `PasteService`: Coordinates DAOs, Redis, webhooks
  - Rate limiting logic
  - Cache-aside pattern implementation
  - ID generation (Redis INCR + Hashids)
  - Commit: `efdd483`
  - File: `lib/services/paste.service.ts`

- **Validator Layer** - Input validation
  - Zod schemas for type-safe validation
  - Business rule enforcement (anonymous expiration)
  - Structured error messages
  - Commit: `fe490d4`
  - Files: `lib/schemas/paste.schema.ts`, `lib/validators/paste.validator.ts`

### Added - Type Safety
- **Supabase Type Generation** - Auto-generated database types
  - Command: `npx supabase gen types typescript ...`
  - Types: `PasteRow`, `PasteInsert`, `PasteUpdate`
  - Single source of truth for schema
  - Commit: `fe490d4`
  - File: `types/database.types.ts`

- **Zod Schema Inference** - Runtime validation + compile-time types
  - `CreatePasteInput` inferred from schema
  - Eliminates manual type duplication
  - Commit: `fe490d4`
  - File: `lib/schemas/paste.schema.ts`

### Added - Performance Optimizations
- **Redis Caching** - Cache-aside pattern
  - Cache key: `paste:{slug}`
  - TTL: 3600 seconds (1 hour)
  - Average latency: <5ms (cached), <50ms (database)
  - Commit: `04cc01f`

- **Rate Limiting** - IP-based throttling
  - Limit: 5 requests/minute per IP
  - Implementation: Redis counters with TTL
  - Response: HTTP 429 with `Retry-After` header
  - Commit: `04cc01f`

- **Collision-Free ID Generation** - Redis INCR + Hashids
  - Algorithm: Atomic counter → Base62 encoding
  - Slug length: 6 characters
  - Capacity: 56.8 billion unique IDs
  - Commit: `04cc01f`

### Added - Security Features
- **Gatekeeper Pattern** - Database write protection
  - RLS policy: Anonymous users cannot INSERT
  - All writes via Server Actions with `service_role` key
  - Prevents client-side bypass of rate limits
  - Commit: `4dfb25a`

- **IP Hashing** - Privacy-preserving abuse tracking
  - Method: SHA-256 hash of IP + salt
  - GDPR-compliant (no PII stored)
  - Can ban abusive IPs by hash
  - Commit: `9ba67f6`

- **Security Headers** - HTTP security headers
  - `Content-Security-Policy`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - Commit: `04cc01f`

### Added - UI Components (shadcn/ui)
- **Base Components** - shadcn/ui library integration
  - Button, Card, Input, Textarea, Select, Label
  - Badge, Alert, Tooltip
  - Tailwind CSS v4 theming
  - Radix UI primitives
  - Commit: `add035a`

- **Paste-Specific Components**
  - `CodeEditor`: Monaco-style textarea
  - `CodeDisplay`: Syntax highlighted code block
  - `PasteViewer`: Full paste display with metadata
  - `PasteForm`: Creation form with validation
  - `HistoryPanel`: Browse and search paste history
  - `HistoryItem`: Individual history entry
  - `HistorySearch`: Search and filter UI
  - `DetectionBadge`: Language confidence indicator
  - `FormatButton`: Code formatting action
  - `ViewModeToggle`: Switch between view modes
  - `LivePreview`: Sandboxed code execution
  - `NewPasteButton`: Global new paste action
  - Commits: Various (see FEATURES.md)

### Fixed
- **PastePage Data Fetching** - Replaced inline fetch with `pasteService`
  - Before: Direct API call from Server Component
  - After: Service layer method call
  - Benefit: Better error handling, caching, and testing
  - Commit: `a6f009e`
  - File: `app/[slug]/page.tsx`

### Changed
- **Project Initialization** - Setup base Next.js 16 project
  - Next.js 16.1.1 with App Router
  - React 19.2.3
  - TypeScript 5
  - Tailwind CSS v4
  - Commit: `31944d9`

---

## Development Stats (as of v0.1.0)

- **Total Commits**: 14
- **Components Created**: 21
- **Database Migrations**: 4
- **API Endpoints**: 2
- **Lines of Code**: ~2,500 (excluding dependencies)
- **Dependencies**: 22 production, 6 development
- **Development Time**: ~3 days (Jan 10-12, 2026)

---

## Migration Notes

### Database Setup
1. Run migrations in order:
   ```bash
   psql < db/001_create_pastes_table.sql
   psql < db/002_add_increment_view_count_function.sql
   psql < db/003_add_paste_metadata_and_tracking.sql
   psql < db/004_create_user_preferences.sql
   ```

2. Generate TypeScript types:
   ```bash
   npx supabase gen types typescript \
     --project-id "jowgpljfoscedeebvhdb" \
     --schema public > types/database.types.ts
   ```

### Environment Variables
Required for production:
```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
UPSTASH_REDIS_URL=
UPSTASH_REDIS_TOKEN=
HASHIDS_SALT=
WEBHOOK_URL=
```

---

**Changelog Format**: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
**Versioning**: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
