import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const AUTH_TAG_BYTES = 16;
const ENCRYPTION_KEY_BYTES = 32;
const IV_BYTES = 12;
const V1_ADDITIONAL_DATA = Buffer.from(
  "fss-growth:gmail-refresh-token:v1",
  "utf8",
);

export type EncryptedToken = {
  version: "v1";
  iv: string;
  ciphertext: string;
  authTag: string;
};

export type StoredEncryptedToken = {
  version: string;
  iv: string;
  ciphertext: string;
  authTag: string;
};

export type TokenEncryptionConfig = {
  version: "v1";
  key: Buffer;
};

export type TokenDecryptionKeys = Readonly<Record<string, Buffer | undefined>>;

function requireEncryptionKey(key: Buffer): Buffer {
  if (!Buffer.isBuffer(key) || key.byteLength !== ENCRYPTION_KEY_BYTES) {
    throw new Error("Refresh token encryption key must be exactly 32 bytes.");
  }

  return key;
}

function decodeStrictBase64(value: string): Buffer | null {
  if (
    value.length === 0 ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  ) {
    return null;
  }

  const decoded = Buffer.from(value, "base64");
  return decoded.toString("base64") === value ? decoded : null;
}

function decodeEnvelope(encrypted: StoredEncryptedToken): {
  iv: Buffer;
  ciphertext: Buffer;
  authTag: Buffer;
} {
  const iv = decodeStrictBase64(encrypted.iv);
  const ciphertext = decodeStrictBase64(encrypted.ciphertext);
  const authTag = decodeStrictBase64(encrypted.authTag);

  if (
    iv?.byteLength !== IV_BYTES ||
    !ciphertext?.byteLength ||
    authTag?.byteLength !== AUTH_TAG_BYTES
  ) {
    throw new Error("Invalid encrypted refresh token envelope.");
  }

  return { iv, ciphertext, authTag };
}

export function parseTokenEncryptionKey(value: string): Buffer {
  const key = decodeStrictBase64(value.trim());

  if (key?.byteLength !== ENCRYPTION_KEY_BYTES) {
    throw new Error(
      "Refresh token encryption key must contain exactly 32 bytes of base64-encoded key material.",
    );
  }

  return key;
}

export function encryptRefreshToken(
  refreshToken: string,
  config: TokenEncryptionConfig,
): EncryptedToken {
  if (refreshToken.trim().length === 0) {
    throw new Error("Refresh token must not be blank.");
  }

  const key = requireEncryptionKey(config.key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_BYTES,
  });
  cipher.setAAD(V1_ADDITIONAL_DATA);

  const ciphertext = Buffer.concat([
    cipher.update(refreshToken, "utf8"),
    cipher.final(),
  ]);

  return {
    version: config.version,
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptRefreshToken(
  encrypted: StoredEncryptedToken,
  keys: TokenDecryptionKeys,
): string {
  if (encrypted.version !== "v1") {
    throw new Error("Unsupported refresh token key version.");
  }

  const key = keys[encrypted.version];
  if (!key) {
    throw new Error("Unsupported refresh token key version.");
  }

  const { iv, ciphertext, authTag } = decodeEnvelope(encrypted);
  const decipher = createDecipheriv(ALGORITHM, requireEncryptionKey(key), iv, {
    authTagLength: AUTH_TAG_BYTES,
  });
  decipher.setAAD(V1_ADDITIONAL_DATA);
  decipher.setAuthTag(authTag);

  try {
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Unable to decrypt refresh token.");
  }
}
