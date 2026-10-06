import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { config } from "../config";

const ALGO = "aes-256-gcm";

function key(): Buffer {
  const k = config.encryptionKeyHex;
  if (!/^[0-9a-fA-F]{64}$/.test(k)) throw new Error("ENCRYPTION_KEY must be 64 hex chars (32 bytes)");
  return Buffer.from(k, "hex");
}

/* encrypt plaintext -> base64url(iv|tag|ciphertext), 12-byte IV */
export function enc(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv(ALGO, key(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64url");
}

export function dec(blob: string): string {
  const b = Buffer.from(blob, "base64url");
  const iv = b.subarray(0, 12);
  const tag = b.subarray(12, 28);
  const ct = b.subarray(28);
  const d = createDecipheriv(ALGO, key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}
