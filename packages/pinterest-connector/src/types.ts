/**
 * pinterest-connector types — Phase 1: contracts only.
 *
 * This package defines the contracts for Pinterest integration.
 * NO real API calls are made in Phase 1.
 *
 * Pinterest integration will use ONLY Pinterest's official API.
 * No scraping of Pinterest is permitted.
 *
 * Phase 2+ will add concrete implementations behind these contracts.
 */

import type { SourceType, EncryptedSecretPayload } from '@pinpinwish/shared'

// ─── Pinterest OAuth Types ──────────────────────────────────────────────────

/**
 * Pinterest OAuth token representation.
 * IMPORTANT: Tokens are NEVER stored in plain text.
 * Encryption and decryption occur strictly on the server using OAUTH_TOKEN_ENCRYPTION_KEY.
 * Access tokens and refresh tokens have dedicated nonces/IVs and authentication tags (AES-256-GCM).
 */
export interface PinterestOAuthToken {
  /** Encrypted access token envelope with dedicated IV and Auth Tag */
  accessToken: EncryptedSecretPayload
  /** Optional encrypted refresh token envelope with dedicated IV and Auth Tag */
  refreshToken?: EncryptedSecretPayload
  /** Token expiry timestamp */
  expiresAt: Date
  /** OAuth scopes granted */
  scopes: string[]
}

export interface PinterestOAuthConfig {
  clientId: string
  redirectUri: string
  scopes: string[]
}

/**
 * PinterestConnection domain record, linked to a generic wishlist_sources entry via sourceId.
 */
export interface PinterestConnection {
  id: string
  userId: string
  sourceId: string
  pinterestUserId: string
  token: PinterestOAuthToken
  lastSyncedAt?: Date
  createdAt: Date
  updatedAt: Date
}

// ─── Pinterest Board Types ──────────────────────────────────────────────────

export interface PinterestBoard {
  id: string
  name: string
  description?: string
  url: string
  pinCount: number
  imageUrl?: string
  createdAt: Date
}

// ─── Pinterest Pin Types ────────────────────────────────────────────────────

export interface PinterestPin {
  id: string
  boardId: string
  title?: string
  description?: string
  link?: string
  imageUrl?: string
  dominantColor?: string
  createdAt: Date
  savedAt?: Date
}

// ─── Sync Types ─────────────────────────────────────────────────────────────

export interface PinterestSyncCursor {
  boardId: string
  bookmark?: string
  lastSyncAt: Date
}

export interface PinterestSyncResult {
  sourceType: SourceType
  sourceId?: string
  newPins: PinterestPin[]
  removedPinIds: string[]
  modifiedPins: PinterestPin[]
  nextCursor?: PinterestSyncCursor
  syncedAt: Date
}

// ─── Connector Contract ──────────────────────────────────────────────────────

/**
 * PinterestConnector — contract for Phase 2+ implementation.
 *
 * IMPORTANT: This connector does NOT identify products.
 * Product identification is handled by @pinpinwish/product-resolver.
 */
export interface PinterestConnector {
  /** Get the OAuth authorization URL */
  getAuthorizationUrl(state: string): string
  /** Exchange authorization code for tokens */
  exchangeCode(code: string, state: string): Promise<PinterestOAuthToken>
  /** Refresh an expired token */
  refreshToken(token: PinterestOAuthToken): Promise<PinterestOAuthToken>
  /** List all boards for the authenticated user */
  listBoards(token: PinterestOAuthToken): Promise<PinterestBoard[]>
  /** List pins from a specific board */
  listBoardPins(
    token: PinterestOAuthToken,
    boardId: string,
    cursor?: string
  ): Promise<{ pins: PinterestPin[]; nextCursor?: string }>
  /** Sync a board — detect new, removed, and modified pins */
  syncBoard(
    token: PinterestOAuthToken,
    boardId: string,
    cursor?: PinterestSyncCursor
  ): Promise<PinterestSyncResult>
}
