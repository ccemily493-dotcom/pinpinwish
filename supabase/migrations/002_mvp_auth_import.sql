-- ============================================================
-- PinPinWish MVP: auth bootstrap, Pinterest import state and RLS
-- ============================================================

CREATE TYPE import_job_status AS ENUM ('pending', 'running', 'completed', 'failed');
CREATE TYPE resolution_status AS ENUM ('pending', 'resolved', 'needs_review');
CREATE TYPE product_match_type AS ENUM ('exact', 'probable', 'similar', 'unresolved');

ALTER TABLE public.pinterest_boards
  ADD COLUMN selected_for_wishlist_id UUID REFERENCES public.wishlists(id) ON DELETE SET NULL,
  ADD COLUMN sync_bookmark TEXT;

ALTER TABLE public.pinterest_pins
  ADD COLUMN pin_url TEXT,
  ADD COLUMN content_hash TEXT NOT NULL DEFAULT '',
  ADD COLUMN last_seen_import_job_id UUID;

ALTER TABLE public.wishlist_items
  ADD COLUMN resolution_status resolution_status NOT NULL DEFAULT 'pending',
  ADD COLUMN match_type product_match_type NOT NULL DEFAULT 'unresolved',
  ADD COLUMN confidence NUMERIC(4, 3) NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
  ADD COLUMN manual_override BOOLEAN NOT NULL DEFAULT FALSE,
  ADD CONSTRAINT source_identity_complete CHECK (
    (source_id IS NULL AND source_item_id IS NULL)
    OR (source_id IS NOT NULL AND source_item_id IS NOT NULL)
  );

CREATE TABLE public.import_jobs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  wishlist_id         UUID NOT NULL REFERENCES public.wishlists(id) ON DELETE CASCADE,
  source_id           UUID NOT NULL REFERENCES public.wishlist_sources(id) ON DELETE CASCADE,
  board_id            UUID NOT NULL REFERENCES public.pinterest_boards(id) ON DELETE CASCADE,
  status              import_job_status NOT NULL DEFAULT 'pending',
  processed_count     INTEGER NOT NULL DEFAULT 0 CHECK (processed_count >= 0),
  identified_count    INTEGER NOT NULL DEFAULT 0 CHECK (identified_count >= 0),
  needs_review_count  INTEGER NOT NULL DEFAULT 0 CHECK (needs_review_count >= 0),
  total_count         INTEGER CHECK (total_count IS NULL OR total_count >= 0),
  bookmark            TEXT,
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ
);

ALTER TABLE public.pinterest_pins
  ADD CONSTRAINT pinterest_pins_last_seen_job_fk
  FOREIGN KEY (last_seen_import_job_id) REFERENCES public.import_jobs(id) ON DELETE SET NULL;

CREATE INDEX idx_import_jobs_user_id ON public.import_jobs(user_id);
CREATE INDEX idx_import_jobs_board_id ON public.import_jobs(board_id);
CREATE INDEX idx_import_jobs_status ON public.import_jobs(status);

CREATE TABLE public.product_match_candidates (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wishlist_item_id   UUID NOT NULL REFERENCES public.wishlist_items(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  brand              TEXT,
  image_url          TEXT,
  product_url        TEXT,
  store              TEXT,
  price              NUMERIC(12, 2) CHECK (price IS NULL OR price >= 0),
  currency           CHAR(3),
  availability       availability_status NOT NULL DEFAULT 'unknown',
  confidence         NUMERIC(4, 3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  match_type         product_match_type NOT NULL,
  evidence           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_match_candidates_item_id
  ON public.product_match_candidates(wishlist_item_id, confidence DESC);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles(id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.wishlists(user_id, name, currency)
  VALUES (NEW.id, 'My Wishlist', 'EUR')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER trg_import_jobs_updated_at
  BEFORE UPDATE ON public.import_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_match_candidates ENABLE ROW LEVEL SECURITY;

-- User-owned tables
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT USING (id = auth.uid());
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY wishlist_sources_select_own ON public.wishlist_sources
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY pinterest_boards_select_own ON public.pinterest_boards
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY pinterest_pins_select_own ON public.pinterest_pins
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY wishlists_select_own ON public.wishlists
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY wishlists_update_own ON public.wishlists
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY wishlist_items_select_own ON public.wishlist_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.wishlists
      WHERE wishlists.id = wishlist_items.wishlist_id
        AND wishlists.user_id = auth.uid()
    )
  );
CREATE POLICY wishlist_items_update_own ON public.wishlist_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.wishlists
      WHERE wishlists.id = wishlist_items.wishlist_id
        AND wishlists.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.wishlists
      WHERE wishlists.id = wishlist_items.wishlist_id
        AND wishlists.user_id = auth.uid()
    )
  );

CREATE POLICY import_jobs_select_own ON public.import_jobs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY match_candidates_select_own ON public.product_match_candidates
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.wishlist_items wi
      JOIN public.wishlists w ON w.id = wi.wishlist_id
      WHERE wi.id = product_match_candidates.wishlist_item_id
        AND w.user_id = auth.uid()
    )
  );

-- Catalog rows are readable only when referenced by one of the user's wishlist items.
CREATE POLICY products_select_owned_reference ON public.products
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.wishlist_items wi
      JOIN public.wishlists w ON w.id = wi.wishlist_id
      WHERE wi.product_id = products.id AND w.user_id = auth.uid()
    )
  );
CREATE POLICY product_images_select_owned_reference ON public.product_images
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.wishlist_items wi
      JOIN public.wishlists w ON w.id = wi.wishlist_id
      WHERE wi.product_id = product_images.product_id AND w.user_id = auth.uid()
    )
  );
CREATE POLICY product_offers_select_owned_reference ON public.product_offers
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.wishlist_items wi
      JOIN public.wishlists w ON w.id = wi.wishlist_id
      WHERE wi.product_id = product_offers.product_id AND w.user_id = auth.uid()
    )
  );
CREATE POLICY price_observations_select_owned_reference ON public.price_observations
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.product_offers po
      JOIN public.wishlist_items wi ON wi.product_id = po.product_id
      JOIN public.wishlists w ON w.id = wi.wishlist_id
      WHERE po.id = price_observations.product_offer_id AND w.user_id = auth.uid()
    )
  );

-- Pinterest connections intentionally have no authenticated-client policy.
-- Ciphertext can only be handled by trusted server routes using the service role.
