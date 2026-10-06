export type StoreOffer = {
  offerId?: string;
  uuid?: string;
  name: string;
  weapon?: string;
  icon?: string;
  fallbacks?: string[];
  price?: number | null;
};

export type NightMarketOffer = StoreOffer & {
  discountPercent?: number;
  discountPrice?: number | null;
};

export type StoreData = {
  daily: {
    offers: StoreOffer[];
    expiresIn: number; // seconds until reset
  };
  nightMarket: {
    offers: NightMarketOffer[];
    expiresIn: number;
  } | null;
  fetchedAt?: string;
};

export type WalletData = {
  vp?: number | null;
  radianite?: number | null;
};

export type Teammate = {
  name: string;
  agent?: string | null;
};

export type MatchData =
  | { inGame: false }
  | {
      inGame: true;
      phase: "pregame" | "live" | string;
      map?: string;
      mode?: string;
      side?: "attack" | "defend" | string;
      sideNote?: string;
      myAgent?: string | null;
      teammates?: Teammate[];
    };

export type StatusData = {
  connected: boolean;
  gameName?: string;
  tagLine?: string;
};

export type Account = {
  accountId?: string;
  gameName?: string;
  tagLine?: string;
  active?: boolean;
};

export type ApiErr = { error: string; code?: string };
