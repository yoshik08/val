/* Riot API fetch with a timeout. Node's fetch has no default timeout, so a
   hung Riot endpoint holds the request open until the platform kills it
   (Vercel 502). Fail fast instead so the caller gets a real error. */
export function riotFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
  const { signal, ...rest } = init;
  return fetch(input, { signal: signal ?? AbortSignal.timeout(8000), ...rest });
}
