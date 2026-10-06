import { createApp } from "./app";
import { createRepo } from "./persist/repo";
import { assertConfig, config } from "./config";

async function main(): Promise<void> {
  assertConfig();
  const repo = createRepo();
  await repo.ensureIndexes();
  const app = createApp(repo);
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[val-api] listening on :${config.port} (fixture=${config.fixture})`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
