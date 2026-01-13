# Scalable AI Pastebin

A read-heavy code sharing platform built with Next.js 16+ that prioritizes instant retrieval speed, strict security via a "Gatekeeper" pattern, and event-driven AI analysis.

## 📚 Documentation

- **[Features](docs/FEATURES.md)** - Comprehensive inventory of all implemented features with file references
- **[Architecture](docs/ARCHITECTURE.md)** - Technical deep-dive into system design and patterns
- **[Changelog](docs/CHANGELOG.md)** - Chronological history of all changes and additions
- **[Development Guide](CLAUDE.md)** - Guidelines for LLM agents and developers

## Core Philosophies

1. **Async-First**: User interactions (create/view) are decoupled from heavy processing (AI). The interface must remain snappy regardless of load.
2. **The Gatekeeper**: The database is locked to the outside world. All writes pass through the application layer to enforce business logic and rate limiting.
3. **Deterministic IDs**: Use Redis atomic increment + Hashids for collision-free ID generation (no random strings).

## Architecture Layers

| Layer | Technology | Role | Responsibility |
|-------|-----------|------|----------------|
| Edge | Next.js 16+ | The Receptionist | Routing, UI, Edge Middleware for security/IP blocking |
| Speed | Upstash Redis | The Bouncer | Atomic ID generation, rate limiting, hot cache for viral pastes |
| Truth | Supabase (PostgreSQL) | The Vault | Persistent storage with Row Level Security (RLS) |
| Event | Webhooks | The Broadcaster | Emit events to trigger AI workers/integrations |

## Getting Started

### Prerequisites

Ensure you have the following environment variables set up in your `.env.local` file:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=  # For Gatekeeper writes

# Redis (Upstash)
UPSTASH_REDIS_URL=
UPSTASH_REDIS_TOKEN=

# Hashids
HASHIDS_SALT=  # Secret for ID obfuscation

# Event Bus
WEBHOOK_URL=  # For paste.created events
```

### Development

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linting
pnpm lint
```

#### Type Generation

```bash
npx -y supabase gen types typescript --project-id "jowgpljfoscedeebvhdb" --schema public > types/database.types.ts
```

## UI Component System

This project uses **shadcn/ui** with Tailwind CSS v4.

To add new components:
```bash
npx shadcn@latest add <component-name>
```

## Critical Patterns

### The Gatekeeper Pattern
Direct client-side `INSERT`s are revoked. All writes go through Server Actions using the `service_role` key to enforce rate limits and business logic.

### Collision-Free IDs
We use Redis atomic increments + Hashids to generate short, unique, and URL-safe IDs (e.g., `x9Lk2`).

## Project Commands

```bash
# Development
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run linting

# Documentation
pnpm docs:sync    # Update documentation timestamps
```

## Learn More

### Project Documentation
- [Features](docs/FEATURES.md) - What's implemented
- [Architecture](docs/ARCHITECTURE.md) - How it works
- [Changelog](docs/CHANGELOG.md) - What changed

### External Resources
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Upstash Redis Documentation](https://upstash.com/docs/redis/overall/getstarted)
- [shadcn/ui Components](https://ui.shadcn.com)

