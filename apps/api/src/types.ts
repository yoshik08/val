export interface UserDoc {
  id: string;
  googleId: string; // unique; "dev" for the x-ssid dev path
  email: string;
  name?: string;
  image?: string;
  activeRiotAccountId?: string | null;
  createdAt: number;
}

export interface RiotAccountDoc {
  id: string;
  userId: string;
  puuid: string;
  gameName: string;
  tagLine: string;
  region: string;
  shard: string;
  /** AES-256-GCM encrypted cookie-jar JSON, base64url(iv|tag|ct) */
  encryptedCookies: string;
  /** AES-256-GCM encrypted RiotTokens JSON — survives process restarts so
      cold starts don't pay the full reauth chain. Refreshed on every reauth. */
  encryptedTokens?: string;
  lastReauthAt?: number;
  lastError?: string;
  createdAt: number;
}

export interface CookieJar {
  [name: string]: string;
}

/** Riot session tokens — kept in memory only, never persisted in plaintext. */
export interface RiotTokens {
  accessToken: string;
  idToken: string;
  entitlements: string;
  puuid: string;
  gameName: string;
  tagLine: string;
  expiresAt: number;
  fixture?: boolean;
}

export interface DailyOffer {
  offerId: string;
  uuid: string;
  name: string;
  weapon: string;
  icon: string;
  fallbacks: string[];
  price: number | null;
}

export interface NightOffer extends DailyOffer {
  discountPercent: number;
  discountPrice: number | null;
}

export interface StoreData {
  daily: { offers: DailyOffer[]; expiresIn: number };
  nightMarket: { offers: NightOffer[]; expiresIn: number } | null;
  fetchedAt: number;
}

export interface WalletData {
  vp: number;
  radianite: number;
}

export interface Teammate {
  name: string;
  agent: string;
  locked?: boolean;
}

export interface MatchData {
  inGame: boolean;
  phase?: "pregame" | "live";
  map?: string;
  mode?: string;
  matchId?: string;
  side?: "attack" | "defend" | "unknown";
  sideNote?: string;
  myAgent?: string;
  teammates?: Teammate[];
  enemies?: { name: string; agent: string }[];
}
