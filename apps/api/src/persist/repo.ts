import { MongoClient, type Db } from "mongodb";
import { randomBytes } from "crypto";
import type { RiotAccountDoc, UserDoc } from "../types";
import { config } from "../config";

export interface AccountUpsert {
  gameName: string;
  tagLine: string;
  region: string;
  shard: string;
  encryptedCookies: string;
}

export interface Repo {
  ensureIndexes(): Promise<void>;
  close(): Promise<void>;
  upsertUserByGoogleId(googleId: string, data: { email: string; name?: string; image?: string }): Promise<UserDoc>;
  getUserById(id: string): Promise<UserDoc | null>;
  setActiveAccount(userId: string, accountId: string | null): Promise<void>;
  upsertAccount(userId: string, puuid: string, data: AccountUpsert): Promise<RiotAccountDoc>;
  getAccountById(id: string): Promise<RiotAccountDoc | null>;
  getAccountsByUser(userId: string): Promise<RiotAccountDoc[]>;
  updateAccount(id: string, patch: Partial<RiotAccountDoc>): Promise<void>;
  deleteAccount(id: string): Promise<void>;
  deleteAccountsByUser(userId: string): Promise<void>;
}

const newId = (): string => randomBytes(12).toString("hex");

/* ------------------------------ MongoDB ------------------------------ */
class MongoRepo implements Repo {
  private client: MongoClient;
  private db: Db | null = null;

  constructor(uri: string) {
    this.client = new MongoClient(uri);
  }

  private getDb(): Db {
    if (!this.db) this.db = this.client.db("val");
    return this.db;
  }

  async ensureIndexes(): Promise<void> {
    await this.client.connect();
    const db = this.getDb();
    await db.collection<any>("users").createIndex({ googleId: 1 }, { unique: true });
    await db.collection<any>("riotAccounts").createIndex({ userId: 1 });
    await db.collection<any>("riotAccounts").createIndex({ userId: 1, puuid: 1 }, { unique: true });
  }

  async close(): Promise<void> {
    await this.client.close();
  }

  private clean<T>(doc: Record<string, unknown> | null): T | null {
    if (!doc) return null;
    const { _id, ...rest } = doc;
    void _id;
    return rest as T;
  }

  async upsertUserByGoogleId(googleId: string, data: { email: string; name?: string; image?: string }): Promise<UserDoc> {
    const col = this.getDb().collection<any>("users");
    const r = await col.findOneAndUpdate(
      { googleId },
      {
        $set: { email: data.email, ...(data.name ? { name: data.name } : {}), ...(data.image ? { image: data.image } : {}) },
        $setOnInsert: { _id: newId(), id: "", googleId, createdAt: Date.now() },
      },
      { upsert: true, returnDocument: "after" }
    );
    const doc = r as unknown as Record<string, unknown>;
    if (!doc["id"]) {
      const id = String(doc["_id"]);
      await col.updateOne({ _id: doc["_id"] }, { $set: { id } });
      doc["id"] = id;
    }
    return this.clean<UserDoc>(doc)!;
  }

  async getUserById(id: string): Promise<UserDoc | null> {
    return this.clean<UserDoc>(await this.getDb().collection<any>("users").findOne({ id }));
  }

  async setActiveAccount(userId: string, accountId: string | null): Promise<void> {
    await this.getDb().collection<any>("users").updateOne({ id: userId }, { $set: { activeRiotAccountId: accountId } });
  }

  async upsertAccount(userId: string, puuid: string, data: AccountUpsert): Promise<RiotAccountDoc> {
    const col = this.getDb().collection<any>("riotAccounts");
    const set: Record<string, unknown> = {
      gameName: data.gameName,
      tagLine: data.tagLine,
      encryptedCookies: data.encryptedCookies,
    };
    if (data.region) set["region"] = data.region;
    if (data.shard) set["shard"] = data.shard;
    const id = newId();
    const r = await col.findOneAndUpdate(
      { userId, puuid },
      {
        $set: set,
        $setOnInsert: { _id: id, id, userId, puuid, region: data.region, shard: data.shard, createdAt: Date.now() },
      },
      { upsert: true, returnDocument: "after" }
    );
    return this.clean<RiotAccountDoc>(r as unknown as Record<string, unknown>)!;
  }

  async getAccountById(id: string): Promise<RiotAccountDoc | null> {
    return this.clean<RiotAccountDoc>(await this.getDb().collection<any>("riotAccounts").findOne({ id }));
  }

  async getAccountsByUser(userId: string): Promise<RiotAccountDoc[]> {
    const arr = await this.getDb().collection<any>("riotAccounts").find({ userId }).toArray();
    return arr.map((d) => this.clean<RiotAccountDoc>(d as unknown as Record<string, unknown>)!);
  }

  async updateAccount(id: string, patch: Partial<RiotAccountDoc>): Promise<void> {
    const { id: _i, userId: _u, puuid: _p, ...rest } = patch;
    void _i;
    void _u;
    void _p;
    await this.getDb().collection<any>("riotAccounts").updateOne({ id }, { $set: rest });
  }

  async deleteAccount(id: string): Promise<void> {
    await this.getDb().collection<any>("riotAccounts").deleteOne({ id });
  }

  async deleteAccountsByUser(userId: string): Promise<void> {
    await this.getDb().collection<any>("riotAccounts").deleteMany({ userId });
  }
}

/* --------------------------- in-memory fallback --------------------------- */
class MemoryRepo implements Repo {
  private users = new Map<string, UserDoc>();
  private byGoogle = new Map<string, string>();
  private accounts = new Map<string, RiotAccountDoc>();
  private byUserPuuid = new Map<string, string>();

  async ensureIndexes(): Promise<void> {}
  async close(): Promise<void> {}

  async upsertUserByGoogleId(googleId: string, data: { email: string; name?: string; image?: string }): Promise<UserDoc> {
    const existingId = this.byGoogle.get(googleId);
    if (existingId) {
      const u = this.users.get(existingId)!;
      u.email = data.email;
      if (data.name) u.name = data.name;
      if (data.image) u.image = data.image;
      return { ...u };
    }
    const u: UserDoc = { id: newId(), googleId, email: data.email, name: data.name, image: data.image, activeRiotAccountId: null, createdAt: Date.now() };
    this.users.set(u.id, u);
    this.byGoogle.set(googleId, u.id);
    return { ...u };
  }

  async getUserById(id: string): Promise<UserDoc | null> {
    const u = this.users.get(id);
    return u ? { ...u } : null;
  }

  async setActiveAccount(userId: string, accountId: string | null): Promise<void> {
    const u = this.users.get(userId);
    if (u) u.activeRiotAccountId = accountId;
  }

  async upsertAccount(userId: string, puuid: string, data: AccountUpsert): Promise<RiotAccountDoc> {
    const k = `${userId}:${puuid}`;
    const existingId = this.byUserPuuid.get(k);
    if (existingId) {
      const a = this.accounts.get(existingId)!;
      a.gameName = data.gameName;
      a.tagLine = data.tagLine;
      a.encryptedCookies = data.encryptedCookies;
      if (data.region) a.region = data.region;
      if (data.shard) a.shard = data.shard;
      return { ...a };
    }
    const a: RiotAccountDoc = {
      id: newId(), userId, puuid,
      gameName: data.gameName, tagLine: data.tagLine,
      region: data.region, shard: data.shard,
      encryptedCookies: data.encryptedCookies,
      createdAt: Date.now(),
    };
    this.accounts.set(a.id, a);
    this.byUserPuuid.set(k, a.id);
    return { ...a };
  }

  async getAccountById(id: string): Promise<RiotAccountDoc | null> {
    const a = this.accounts.get(id);
    return a ? { ...a } : null;
  }

  async getAccountsByUser(userId: string): Promise<RiotAccountDoc[]> {
    return [...this.accounts.values()].filter((a) => a.userId === userId).map((a) => ({ ...a }));
  }

  async updateAccount(id: string, patch: Partial<RiotAccountDoc>): Promise<void> {
    const a = this.accounts.get(id);
    if (a) Object.assign(a, patch, { id: a.id, userId: a.userId, puuid: a.puuid });
  }

  async deleteAccount(id: string): Promise<void> {
    const a = this.accounts.get(id);
    if (a) {
      this.accounts.delete(id);
      this.byUserPuuid.delete(`${a.userId}:${a.puuid}`);
    }
  }

  async deleteAccountsByUser(userId: string): Promise<void> {
    for (const a of [...this.accounts.values()]) {
      if (a.userId === userId) {
        this.accounts.delete(a.id);
        this.byUserPuuid.delete(`${a.userId}:${a.puuid}`);
      }
    }
  }
}

export function createRepo(): Repo {
  if (config.mongoUri) return new MongoRepo(config.mongoUri);
  console.warn("[val-api] MONGODB_URI not set — using in-memory repository (local dev only, nothing persists across restarts)");
  return new MemoryRepo();
}
