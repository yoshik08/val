import { RiotError } from "./errors";
import { RIOT_UA } from "./auth";

const GEO_URL = "https://riot-geo.pas.si.riotgames.com/pas/product/valorant";

/* shard map: latam|br|na -> na, eu -> eu, ap -> ap, kr -> kr */
export function shardForRegion(region: string): string {
  const r = (region || "").toLowerCase();
  if (r === "latam" || r === "br" || r === "na") return "na";
  if (r === "eu") return "eu";
  if (r === "ap") return "ap";
  if (r === "kr") return "kr";
  if (["na", "eu", "ap", "kr"].includes(r)) return r;
  return "ap";
}

/* region/shard are discovered from riot, never hardcoded. */
export async function getGeo(accessToken: string, idToken: string): Promise<{ region: string; shard: string }> {
  const res = await fetch(GEO_URL, {
    method: "PUT",
    headers: {
      "User-Agent": RIOT_UA,
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ id_token: idToken }),
  });
  if (!res.ok) throw new RiotError("geo lookup failed: " + res.status, "GEO_FAILED");
  const d = (await res.json().catch(() => null)) as { affinities?: { live?: string } } | null;
  const region = String((d && d.affinities && d.affinities.live) || "").toLowerCase();
  if (!region) throw new RiotError("geo lookup returned no region", "GEO_FAILED");
  return { region, shard: shardForRegion(region) };
}
