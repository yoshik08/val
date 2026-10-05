const crypto = require("crypto");

const ALGO = "aes-256-gcm";
const KEY_LEN = 32;

function key() {
  const k = process.env.CREDS_KEY || "";
  if (k.length < 16) throw new Error("CREDS_KEY not set or too short");
  return crypto.createHash("sha256").update(k).digest();
}

// encrypt plaintext -> base64url(iv|tag|ciphertext)
function enc(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv(ALGO, key(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64url");
}

function dec(blob) {
  const b = Buffer.from(blob, "base64url");
  const iv = b.subarray(0, 12);
  const tag = b.subarray(12, 28);
  const ct = b.subarray(28);
  const d = crypto.createDecipheriv(ALGO, key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

module.exports = { enc, dec };
