function num(v: string | undefined, d: number): number {
  const n = parseInt(v || "", 10);
  return Number.isFinite(n) ? n : d;
}

export const config = {
  version: "0.1.0",
  port: num(process.env.PORT, 10000),
  apiJwtSecret: process.env.API_JWT_SECRET || "",
  encryptionKeyHex: process.env.ENCRYPTION_KEY || "",
  mongoUri: process.env.MONGODB_URI || "",
  fixture: process.env.VAL_FIXTURE === "true",
  corsOrigins: Array.from(
    new Set(
      (process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : [])
        .concat(["http://localhost:3000"])
        .map((s) => s.trim())
        .filter(Boolean)
    )
  ),
};

export function assertConfig(): void {
  if (!config.apiJwtSecret) throw new Error("API_JWT_SECRET is required");
  if (!/^[0-9a-fA-F]{64}$/.test(config.encryptionKeyHex)) {
    throw new Error("ENCRYPTION_KEY must be 64 hex chars (32 bytes)");
  }
}
