/**
 * The app is served under /val (rewrite from yoshik.xyz). Next.js
 * auto-prefixes <Link>, router.push, and redirect() with basePath, but
 * raw fetch() calls need it manually — use bp() for those.
 */
export const BASE_PATH = "/val";

export function bp(path: string): string {
  return path.startsWith("/") ? `${BASE_PATH}${path}` : path;
}
