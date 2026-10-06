import express from "express";
import cors from "cors";
import { config } from "./config";
import type { Repo } from "./persist/repo";
import { errorHandler } from "./http";
import { systemRoutes } from "./routes/system";
import { riotRoutes } from "./routes/riot";
import { dataRoutes } from "./routes/data";

export function createApp(repo: Repo): express.Express {
  const app = express();
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: "100kb" }));

  app.use("/api", systemRoutes(repo));
  app.use("/api/riot", riotRoutes(repo));
  app.use("/api", dataRoutes(repo));

  app.use((_req, res) => res.status(404).json({ error: "not found", code: "NOT_FOUND" }));
  app.use(errorHandler);
  return app;
}
