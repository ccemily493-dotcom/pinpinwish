-- ============================================================
-- PinPinWish — Phase 1 Foundation Schema (Audited & Hardened)
-- Target: PostgreSQL / Supabase
-- ============================================================
-- IMPORTANT: OAuth tokens are NEVER stored in plain text.
-- Encryption and decryption of access/refresh tokens occurs
-- ONLY on the server side using OAUTH_TOKEN_ENCRYPTION_KEY.
-- Access tokens and refresh tokens have dedicated nonces/IVs
-- and AES-GCM authentication tags.
-- ============================================================

-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high', 'dream');
CREATE TYPE item_status AS ENUM ('wanted', 'purchased', 'removed');
CREATE TYPE item_category AS ENUM ('clothes', 'shoes', 'beauty', 'home', 'other');
CREATE TYPE source_type AS ENUM (
  'pinterest',
  'instagram',
  'tiktok',
  'manual_url',
  'image',
  'browser_extension'
);
CREATE TYPE availability_status AS ENUM ('in_stock', 'out_of_stock', 'unknown');

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================

CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      TEXT UNIQUE,
  display_name  TEXT,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'User profile data, extends Supabase auth.users';

-- ============================================================
-- WISHLIST SOURCES (generic, provider-agnostic source connections)
-- ============================================================

CREATE TABLE public.wishlist_sources (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_type source_type NOT NULL,
  label       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.wishlist_sources IS 'Generic source connections (Pinterest, Instagram, etc.)';
CREATE INDEX idx_wishlist_sources_user_id ON public.wishlist_sources(user_id);
CREATE INDEX idx_wishlist_sources_type ON public.wishlist_sources(source_type);

-- ============================================================
-- PINTEREST CONNECTIONS
-- Linked to wishlist_sources via source_id.
-- OAuth tokens stored encrypted with independent IV and Auth Tag.
-- ============================================================

CREATE TABLE public.pinterest_connections (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_id                   UUID NOT NULL REFERENCES public.wishlist_sources(id) ON DELETE CASCADE,
  pinterest_user_id           TEXT NOT NULL,
  -- Encrypted access token envelope (AES-256-GCM)
  access_token_ciphertext     TEXT NOT NULL,
  access_token_iv             TEXT NOT NULL,
  access_token_auth_tag       TEXT NOT NULL,
  -- Encrypted refresh token envelope (AES-256-GCM)
  refresh_token_ciphertext    TEXT,
  refresh_token_iv            TEXT,
  refresh_token_auth_tag      TEXT,
  key_version                 INTEGER NOT NULL DEFAULT 1,
  token_expires_at            TIMESTAMPTZ,
  scopes                      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  last_synced_at              TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, pinterest_user_id),
  UNIQUE(source_id)
);

COMMENT ON TABLE public.pinterest_connections IS
  'Pinterest OAuth connections. Tokens are encrypted server-side only with independent IV and authTag.';
COMMENT ON COLUMN public.pinterest_connections.source_id IS
  'References parent wishlist_sources entry for generic source routing.';
COMMENT ON COLUMN public.pinterest_connections.access_token_ciphertext IS
  'AES-256-GCM encrypted access token ciphertext. Decryption occurs server-side only.';
COMMENT ON COLUMN public.pinterest_connections.access_token_iv IS
  'Unique initialization vector / nonce for access token encryption.';
COMMENT ON COLUMN public.pinterest_connections.access_token_auth_tag IS
  'AES-GCM authentication tag ensuring ciphertext integrity for access token.';
COMMENT ON COLUMN public.pinterest_connections.key_version IS
  'Key version for transparent key rotation.';

CREATE INDEX idx_pinterest_connections_user_id ON public.pinterest_connections(user_id);
CREATE INDEX idx_pinterest_connections_source_id ON public.pinterest_connections(source_id);

-- ============================================================
-- PINTEREST BOARDS
-- ============================================================

CREATE TABLE public.pinterest_boards (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id        UUID NOT NULL REFERENCES public.pinterest_connections(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pinterest_board_id   TEXT NOT NULL,
  name                 TEXT NOT NULL,
  description          TEXT,
  url                  TEXT NOT NULL,
  image_url            TEXT,
  pin_count            INTEGER NOT NULL DEFAULT 0,
  is_syncing           BOOLEAN NOT NULL DEFAULT FALSE,
  last_synced_at       TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(connection_id, pinterest_board_id)
);

COMMENT ON TABLE public.pinterest_boards IS 'Pinterest boards imported from user accounts';
CREATE INDEX idx_pinterest_boards_connection_id ON public.pinterest_boards(connection_id);
CREATE INDEX idx_pinterest_boards_user_id ON public.pinterest_boards(user_id);

-- ============================================================
-- PINTEREST PINS
-- ============================================================

CREATE TABLE public.pinterest_pins (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id           UUID NOT NULL REFERENCES public.pinterest_boards(id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pinterest_pin_id   TEXT NOT NULL,
  title              TEXT,
  description        TEXT,
  link               TEXT,
  image_url          TEXT,
  dominant_color     TEXT,
  is_deleted         BOOLEAN NOT NULL DEFAULT FALSE,
  pinned_at          TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(board_id, pinterest_pin_id)
);

COMMENT ON TABLE public.pinterest_pins IS 'Pinterest pins imported via official Pinterest API';
CREATE INDEX idx_pinterest_pins_board_id ON public.pinterest_pins(board_id);
CREATE INDEX idx_pinterest_pins_user_id ON public.pinterest_pins(user_id);
CREATE INDEX idx_pinterest_pins_pinterest_pin_id ON public.pinterest_pins(pinterest_pin_id);

-- ============================================================
-- PRODUCTS (resolved product catalog entities)
-- ============================================================

CREATE TABLE public.products (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  brand        TEXT,
  category     item_category NOT NULL DEFAULT 'other',
  image_url    TEXT,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.products IS 'Resolved products (separate from store-specific offers)';
CREATE INDEX idx_products_category ON public.products(category);
CREATE INDEX idx_products_brand ON public.products(brand);

-- ============================================================
-- PRODUCT IMAGES (multi-image support per product)
-- ============================================================

CREATE TABLE public.product_images (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url     TEXT NOT NULL,
  alt_text      TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_primary    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.product_images IS 'Multiple images per product with ordering and primary flag';
CREATE INDEX idx_product_images_product_id ON public.product_images(product_id);
CREATE INDEX idx_product_images_order ON public.product_images(product_id, display_order ASC);

-- ============================================================
-- PRODUCT OFFERS (store-specific offers & extensible variants)
-- ============================================================

CREATE TABLE public.product_offers (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id         UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  store              TEXT NOT NULL,
  store_url          TEXT NOT NULL,
  current_price      NUMERIC(12, 2) NOT NULL CHECK (current_price >= 0),
  currency           CHAR(3) NOT NULL DEFAULT 'EUR',
  availability       availability_status NOT NULL DEFAULT 'unknown',
  -- Extensible variant representation
  variant_size       TEXT,
  variant_color      TEXT,
  sku                TEXT,
  variant_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_checked_at    TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.product_offers IS 'Store-specific offers for a product with extensible variant info.';
COMMENT ON COLUMN public.product_offers.variant_attributes IS 'Extensible JSONB for retailer-specific variant data (width, material, etc.)';
CREATE INDEX idx_product_offers_product_id ON public.product_offers(product_id);
CREATE INDEX idx_product_offers_availability ON public.product_offers(availability);
CREATE INDEX idx_product_offers_current_price ON public.product_offers(current_price);
CREATE INDEX idx_product_offers_variant_attrs ON public.product_offers USING GIN (variant_attributes);

-- ============================================================
-- PRICE OBSERVATIONS (historical price tracking per offer)
-- ============================================================

CREATE TABLE public.price_observations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_offer_id  UUID NOT NULL REFERENCES public.product_offers(id) ON DELETE CASCADE,
  price             NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  currency          CHAR(3) NOT NULL DEFAULT 'EUR',
  availability      availability_status NOT NULL DEFAULT 'unknown',
  checked_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.price_observations IS 'Historical price records per offer';
CREATE INDEX idx_price_observations_offer_id ON public.price_observations(product_offer_id);
CREATE INDEX idx_price_observations_checked_at ON public.price_observations(checked_at DESC);
CREATE INDEX idx_price_observations_offer_time
  ON public.price_observations(product_offer_id, checked_at DESC);

-- ============================================================
-- WISHLISTS
-- ============================================================

CREATE TABLE public.wishlists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'My Wishlist',
  currency    CHAR(3) NOT NULL DEFAULT 'EUR',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.wishlists IS 'User wishlists';
CREATE INDEX idx_wishlists_user_id ON public.wishlists(user_id);

-- ============================================================
-- WISHLIST ITEMS (persistent records with source_id idempotency)
-- ============================================================

CREATE TABLE public.wishlist_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wishlist_id           UUID NOT NULL REFERENCES public.wishlists(id) ON DELETE CASCADE,
  product_id            UUID REFERENCES public.products(id) ON DELETE SET NULL,
  pinterest_pin_id      UUID REFERENCES public.pinterest_pins(id) ON DELETE SET NULL,
  -- Generic source relation
  source_id             UUID REFERENCES public.wishlist_sources(id) ON DELETE SET NULL,
  source_type           source_type,
  source_item_id        TEXT,
  -- User preferences
  priority              priority_level NOT NULL DEFAULT 'medium',
  status                item_status NOT NULL DEFAULT 'wanted',
  desired_size          TEXT,
  desired_color         TEXT,
  notes                 TEXT,
  -- Duplicate detection flag (advisory, never auto-merged)
  possible_duplicate_of UUID REFERENCES public.wishlist_items(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Idempotency key: prevents duplicate imports from same source into wishlist
  UNIQUE(wishlist_id, source_id, source_item_id)
);

COMMENT ON TABLE public.wishlist_items IS 'Persistent wishlist item records with source_id idempotency';
COMMENT ON COLUMN public.wishlist_items.source_id IS 'References wishlist_sources(id) for source provenance and idempotency';
COMMENT ON COLUMN public.wishlist_items.possible_duplicate_of IS 'Conservative duplicate flag. Never auto-merged. User confirms or dismisses.';

CREATE INDEX idx_wishlist_items_wishlist_id ON public.wishlist_items(wishlist_id);
CREATE INDEX idx_wishlist_items_product_id ON public.wishlist_items(product_id);
CREATE INDEX idx_wishlist_items_source_id ON public.wishlist_items(source_id);
CREATE INDEX idx_wishlist_items_status ON public.wishlist_items(status);
CREATE INDEX idx_wishlist_items_priority ON public.wishlist_items(priority);
CREATE INDEX idx_wishlist_items_idempotency ON public.wishlist_items(wishlist_id, source_id, source_item_id);

-- ============================================================
-- ROW LEVEL SECURITY (preparation for Phase 2)
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pinterest_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pinterest_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pinterest_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_observations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_wishlists_updated_at
  BEFORE UPDATE ON public.wishlists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_wishlist_items_updated_at
  BEFORE UPDATE ON public.wishlist_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_product_offers_updated_at
  BEFORE UPDATE ON public.product_offers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_wishlist_sources_updated_at
  BEFORE UPDATE ON public.wishlist_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_pinterest_connections_updated_at
  BEFORE UPDATE ON public.pinterest_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
