import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import type { EncryptedSecretPayload } from '@pinpinwish/shared'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const KEY_BYTES = 32

export function encryptSecret(
  plaintext: string,
  encryptionKeyHex: string,
  keyVersion = 1,
): EncryptedSecretPayload {
  if (!plaintext) throw new Error('Cannot encrypt an empty secret')
  const key = decodeKey(encryptionKeyHex)
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])

  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    keyVersion,
  }
}

export function decryptSecret(
  payload: EncryptedSecretPayload,
  encryptionKeyHex: string,
): string {
  const key = decodeKey(encryptionKeyHex)
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(payload.iv, 'base64'),
  )
  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final(),
  ])
  return plaintext.toString('utf8')
}

function decodeKey(value: string): Buffer {
  if (!/^[a-f\d]{64}$/i.test(value)) {
    throw new Error('OAUTH_TOKEN_ENCRYPTION_KEY must be exactly 64 hexadecimal characters')
  }
  const key = Buffer.from(value, 'hex')
  if (key.length !== KEY_BYTES) throw new Error('Invalid encryption key length')
  return key
}
