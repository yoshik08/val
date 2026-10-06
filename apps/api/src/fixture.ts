import type { MatchData, RiotTokens, StoreData, WalletData } from "./types";

/* Fixture mode: when VAL_FIXTURE=true and the ssid/cookies equal the literal
   string "FIXTURE_SSID", canned data is returned instead of hitting Riot.
   All values are obviously fake — for local QA only. */
export const FIXTURE_SSID = "FIXTURE_SSID";

export function fixtureTokens(): RiotTokens {
  return {
    accessToken: "FIXTURE_ACCESS_TOKEN",
    idToken: "FIXTURE_ID_TOKEN",
    entitlements: "FIXTURE_ENTITLEMENTS_TOKEN",
    puuid: "FIXTURE_PUUID",
    gameName: "FixturePlayer",
    tagLine: "FIX1",
    expiresAt: Date.now() + 3600 * 1000,
    fixture: true,
  };
}

export function fixtureGeo(): { region: string; shard: string } {
  return { region: "ap", shard: "ap" };
}

const skin = (i: number, uuid: string, name: string, weapon: string, price: number) => ({
  offerId: `fixture-offer-${i}`,
  uuid,
  name,
  weapon,
  icon: `https://example.com/fixture/${uuid}.png`,
  fallbacks: [`https://example.com/fixture/${uuid}-full.png`],
  price,
});

export function fixtureStore(): StoreData {
  return {
    daily: {
      offers: [
        skin(1, "fixture-skin-0001", "Fixture Reaver Vandal", "Vandal", 1775),
        skin(2, "fixture-skin-0002", "Fixture Prime Phantom", "Phantom", 1775),
        skin(3, "fixture-skin-0003", "Fixture Glitchpop Operator", "Operator", 2175),
        skin(4, "fixture-skin-0004", "Fixture RGX Ghost", "Ghost", 875),
      ],
      expiresIn: 86399,
    },
    nightMarket: {
      offers: [
        { ...skin(11, "fixture-skin-0011", "Fixture Ion Spectre", "Spectre", 1775), discountPercent: 33, discountPrice: 1189 },
        { ...skin(12, "fixture-skin-0012", "Fixture Oni Sheriff", "Sheriff", 2475), discountPercent: 42, discountPrice: 1435 },
        { ...skin(13, "fixture-skin-0013", "Fixture Elderflame Ares", "Ares", 2175), discountPercent: 25, discountPrice: 1631 },
      ],
      expiresIn: 500000,
    },
    fetchedAt: Date.now(),
  };
}

export function fixtureWallet(): WalletData {
  return { vp: 4750, radianite: 160 };
}

export function fixtureMatch(): MatchData {
  return {
    inGame: true,
    phase: "pregame",
    map: "Ascent",
    mode: "Standard",
    matchId: "fixture-match-1",
    side: "attack",
    sideNote:
      "Fixture match: side is a first-half estimate — Riot's API does not expose live attacking/defending sides.",
    myAgent: "Jett",
    teammates: [
      { name: "FixtureMate1", agent: "Sova", locked: true },
      { name: "FixtureMate2", agent: "Omen", locked: true },
      { name: "FixtureMate3", agent: "Sage", locked: false },
      { name: "FixtureMate4", agent: "Reyna", locked: true },
      { name: "FixtureMate5", agent: "Killjoy", locked: false },
    ],
  };
}
