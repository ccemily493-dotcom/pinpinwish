/**
 * @pinpinwish/shared - Shared types and utilities
 * No dependencies on other @pinpinwish packages.
 */

export type Currency = 'EUR' | 'USD' | 'GBP' | 'JPY' | 'CAD' | 'AUD'

export type Priority = 'low' | 'medium' | 'high' | 'dream'

export type WishlistItemStatus = 'wanted' | 'purchased' | 'removed'

export type Category =
  | 'clothes'
  | 'shoes'
  | 'beauty'
  | 'home'
  | 'other'

export type Availability = 'in_stock' | 'out_of_stock' | 'unknown'

export type SourceType =
  | 'pinterest'
  | 'instagram'
  | 'tiktok'
  | 'manual_url'
  | 'image'
  | 'browser_extension'

export interface PriceAmount {
  value: number
  currency: Currency
}

export interface TimestampedRecord {
  createdAt: Date
  updatedAt: Date
}

/**
 * Standard encrypted envelope for sensitive credentials (e.g. OAuth tokens).
 * Encryption and decryption occur strictly server-side using AES-256-GCM.
 * Each token component has its own dedicated IV and authentication tag.
 */
export interface EncryptedSecretPayload {
  ciphertext: string
  iv: string
  authTag: string
  keyVersion: number
}

/**
 * Extensible variant information for product offers (e.g. size, color, attributes).
 */
export interface OfferVariantInfo {
  size?: string
  color?: string
  sku?: string
  attributes?: Record<string, string>
}

/**
 * Product image metadata.
 */
export interface ProductImage {
  id: string
  productId: string
  imageUrl: string
  altText?: string
  displayOrder: number
  isPrimary: boolean
  createdAt?: Date
}
