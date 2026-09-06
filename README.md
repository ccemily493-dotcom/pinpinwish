# PinPinWish — Smart Wishlist

> Turn your Pinterest boards — and any other source — into an intelligent, price-aware wishlist.

---

## Current Scope: Phase 1 — Foundation (Audited)

This release establishes the project foundation:

- **Monorepo structure** with npm workspaces (`apps/*`, `packages/*`)
- **Domain contracts & types** (TypeScript, strict mode throughout)
- **Separation of Persistent Records and Hydrated View Models** (`WishlistItemRecord` vs `WishlistItemView`)
- **PostgreSQL / Supabase schema** (`001_foundation.sql`) with token security, `source_id` relations, `product_images`, and offer variant support
- **Next.js (App Router)** web app (Vercel-ready, 0 production audit vulnerabilities)
- **Visual wishlist** with mock data (12 realistic items covering clothes, shoes, beauty, home, other)
- **Category, priority, price range, status filtering, unconfirmed/unknown and duplicate flags**
- **Sort by price and date** (ascending & descending)
- **Product detail page** with separate, unmixed price histories per store and clear stock indicators
- **Comprehensive Foundation test suite** (60+ tests passing)

**Not yet implemented:** Pinterest OAuth live flow, real external API calls, real scheduled scrapers/crawlers, AI resolution, production deployment.

---

## Architecture

```
pinpinwish/
├── apps/
│   └── web/                     # Next.js App Router (Vercel-ready)
├── packages/
│   ├── shared/                  # Shared types & utilities (no internal dependencies)
│   ├── wishlist-core/           # Domain logic (filters, sort, totals, duplicates, hydration)
│   ├── price-tracker/           # Pure price observation logic & per-offer history
│   ├── product-resolver/        # Product resolution contracts + NullProductResolver
│   ├── product-search/          # Search provider interface
│   └── pinterest-connector/     # Pinterest OAuth + sync contracts & token security
└── supabase/
    └── migrations/              # PostgreSQL schema migrations
```

### Why WishlistSourceAdapter is decoupled

The `WishlistSourceAdapter` interface in `wishlist-core` keeps the wishlist completely independent of any data source. This means:

- Adding Instagram, TikTok, manual URLs, or a browser extension requires only a new adapter implementation — zero changes to `wishlist-core`
- The wishlist domain can be tested and evolved without any source dependency
- Pinterest can be replaced or supplemented without touching the wishlist logic

```typescript
interface WishlistSourceAdapter {
  readonly sourceType: string
  sync(cursor?: string): Promise<SourceSyncResult>
}
```

### Pinterest Integration Policy

Pinterest will be integrated **exclusively through Pinterest's official API** ([developers.pinterest.com](https://developers.pinterest.com)). No scraping of Pinterest is permitted in this project.

### Token Security & AES-256-GCM Envelopes

OAuth tokens are NEVER stored in plain text. Each token (access token and refresh token) is stored with its own dedicated initialization vector (IV/nonce) and AES-GCM authentication tag. Encryption and decryption occur exclusively on the server using `OAUTH_TOKEN_ENCRYPTION_KEY`.

---

## Installation

**Prerequisites:** Node.js ≥18, npm ≥9

```bash
git clone https://github.com/ccemily493-dotcom/pinpinwish.git
cd pinpinwish
npm install
```

---

## Running the App

```bash
# Development server (port 3000)
npm run dev

# The app opens directly on the wishlist:
# http://localhost:3000/wishlist
```

---

## Running Tests

```bash
# All workspace tests
npm test

# Individual packages
npm run test --workspace=packages/wishlist-core
npm run test --workspace=packages/price-tracker
npm run test --workspace=packages/product-resolver
npm run test --workspace=packages/pinterest-connector
npm run test --workspace=packages/shared
npm run test --workspace=apps/web
```

---

## Type Checking & Lint

```bash
npm run typecheck
npm run lint
```

---

## Build

```bash
npm run build
```

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in values:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (safe for client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) |
| `PINTEREST_CLIENT_ID` | Pinterest app client ID |
| `PINTEREST_CLIENT_SECRET` | Pinterest app client secret (server only) |
| `PINTEREST_REDIRECT_URI` | OAuth callback URI |
| `OAUTH_TOKEN_ENCRYPTION_KEY` | 32-byte hex key for encrypting OAuth tokens (server only) |
| `CRON_SECRET` | Secret for authenticating cron job requests |

---

## Database

The SQL migration at `supabase/migrations/001_foundation.sql` creates the full Phase 1 schema.

To apply (requires Supabase CLI):

```bash
supabase db push
```

---

## Roadmap

| Phase | Scope |
|---|---|
| **Phase 1** ✔ | Foundation: monorepo, types, schema, UI, mock data, tests, audit |
| Phase 2 | Pinterest OAuth, board/pin import, Supabase auth |
| Phase 3 | Product resolution (AI-assisted), real price tracking, duplicate merging |
| Phase 4 | Additional sources (Instagram, TikTok, browser extension, manual URL) |
| Phase 5 | Price alerts, notifications, sharing |

---

*PinPinWish is a personal project. All external service integrations use official APIs only.*
