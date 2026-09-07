import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('SQL Migration Static Validation', () => {
  const sqlPath = path.resolve(__dirname, '../../../../supabase/migrations/001_foundation.sql')
  const mvpSqlPath = path.resolve(__dirname, '../../../../supabase/migrations/002_mvp_auth_import.sql')

  it('migration file exists and is readable', () => {
    expect(fs.existsSync(sqlPath)).toBe(true)
    const content = fs.readFileSync(sqlPath, 'utf-8')
    expect(content.length).toBeGreaterThan(100)
  })

  it('defines all required tables and relationships', () => {
    const content = fs.readFileSync(sqlPath, 'utf-8')

    const requiredTables = [
      'public.profiles',
      'public.wishlist_sources',
      'public.pinterest_connections',
      'public.pinterest_boards',
      'public.pinterest_pins',
      'public.products',
      'public.product_images',
      'public.product_offers',
      'public.price_observations',
      'public.wishlists',
      'public.wishlist_items',
    ]

    for (const table of requiredTables) {
      expect(content).toContain(`CREATE TABLE ${table}`)
    }
  })

  it('enforces encrypted token structure with independent IV and authTag', () => {
    const content = fs.readFileSync(sqlPath, 'utf-8')

    expect(content).toContain('access_token_ciphertext')
    expect(content).toContain('access_token_iv')
    expect(content).toContain('access_token_auth_tag')
    expect(content).toContain('refresh_token_ciphertext')
    expect(content).toContain('refresh_token_iv')
    expect(content).toContain('refresh_token_auth_tag')
    expect(content).toContain('access_token_key_version')
    expect(content).toContain('refresh_token_key_version')
    expect(content).toContain('CONSTRAINT refresh_token_envelope_complete CHECK')
  })

  it('relates pinterest_connections to wishlist_sources via source_id', () => {
    const content = fs.readFileSync(sqlPath, 'utf-8')
    expect(content).toContain('source_id                   UUID NOT NULL REFERENCES public.wishlist_sources(id)')
  })

  it('enforces idempotency on (wishlist_id, source_id, source_item_id) in wishlist_items', () => {
    const content = fs.readFileSync(sqlPath, 'utf-8')
    expect(content).toContain('UNIQUE(wishlist_id, source_id, source_item_id)')
    expect(content).toContain('source_id             UUID REFERENCES public.wishlist_sources(id)')
  })

  it('includes product_images and offer variant columns', () => {
    const content = fs.readFileSync(sqlPath, 'utf-8')
    expect(content).toContain('CREATE TABLE public.product_images')
    expect(content).toContain('variant_size')
    expect(content).toContain('variant_color')
    expect(content).toContain('sku')
    expect(content).toContain('variant_attributes JSONB')
    expect(content).toContain('CREATE UNIQUE INDEX uq_product_images_one_primary')
  })

  it('enables Row Level Security on all tables', () => {
    const content = fs.readFileSync(sqlPath, 'utf-8')
    const rlsStatements = [
      'ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;',
      'ALTER TABLE public.wishlist_sources ENABLE ROW LEVEL SECURITY;',
      'ALTER TABLE public.pinterest_connections ENABLE ROW LEVEL SECURITY;',
      'ALTER TABLE public.pinterest_boards ENABLE ROW LEVEL SECURITY;',
      'ALTER TABLE public.pinterest_pins ENABLE ROW LEVEL SECURITY;',
      'ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;',
      'ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;',
      'ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;',
      'ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;',
      'ALTER TABLE public.product_offers ENABLE ROW LEVEL SECURITY;',
      'ALTER TABLE public.price_observations ENABLE ROW LEVEL SECURITY;',
    ]

    for (const stmt of rlsStatements) {
      expect(content).toContain(stmt)
    }
  })

  it('adds resumable import jobs and a generation marker for deleted Pins', () => {
    const content = fs.readFileSync(mvpSqlPath, 'utf-8')
    expect(content).toContain('CREATE TABLE public.import_jobs')
    expect(content).toContain('bookmark            TEXT')
    expect(content).toContain('last_seen_import_job_id UUID')
    expect(content).toContain('pinterest_pins_last_seen_job_fk')
  })

  it('stores conservative resolution state and protects manual choices', () => {
    const content = fs.readFileSync(mvpSqlPath, 'utf-8')
    expect(content).toContain("CREATE TYPE resolution_status AS ENUM ('pending', 'resolved', 'needs_review')")
    expect(content).toContain("CREATE TYPE product_match_type AS ENUM ('exact', 'probable', 'similar', 'unresolved')")
    expect(content).toContain('manual_override BOOLEAN NOT NULL DEFAULT FALSE')
    expect(content).toContain('confidence NUMERIC(4, 3)')
  })

  it('bootstraps each authenticated user and keeps OAuth ciphertext server-only', () => {
    const content = fs.readFileSync(mvpSqlPath, 'utf-8')
    expect(content).toContain('CREATE OR REPLACE FUNCTION public.handle_new_user()')
    expect(content).toContain('AFTER INSERT ON auth.users')
    expect(content).toContain('Pinterest connections intentionally have no authenticated-client policy')
    expect(content).not.toMatch(/CREATE POLICY pinterest_connections_/)
  })
})
