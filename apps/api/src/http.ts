import type { NextFunction, Request, Response } from "express";
import { RiotError } from "./riot/errors";

export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };

/* all errors leave the api as { error, code? } */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof RiotError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  if (err && typeof err === "object" && "status" in err) {
    const e = err as { status?: unknown; message?: unknown; code?: unknown };
    const s = typeof e.status === "number" ? e.status : 500;
    res.status(s).json({ error: String(e.message || "request failed"), code: e.code ? String(e.code) : undefined });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "internal error" });
}
