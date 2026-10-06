/* Data caches, keyed per account: store 5min, wallet 3min, match 15s. */

type Kind = "store" | "match";

const TTL: Record<Kind, number> = {
  store: 5 * 60 * 1000,
  match: 15 * 1000,
};

const caches: Record<Kind, Map<string, { at: number; value: unknown }>> = {
  store: new Map(),
  match: new Map(),
};

export async function cached<T>(kind: Kind, key: string, fn: () => Promise<T>): Promise<T> {
  const m = caches[kind];
  const e = m.get(key);
  if (e && Date.now() - e.at < TTL[kind]) return e.value as T;
  const v = await fn();
  m.set(key, { at: Date.now(), value: v });
  if (m.size > 500) {
    const first = m.keys().next().value as string | undefined;
    if (first) m.delete(first);
  }
  return v;
}

export function clearDataCache(kind: Kind, key: string): void {
  caches[kind].delete(key);
}
