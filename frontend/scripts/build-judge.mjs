import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextCli = require.resolve("next/dist/bin/next");
const result = spawnSync(process.execPath, [nextCli, "build"], {
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_GRABSPARK_JUDGE_DEMO: "1" },
});
process.exit(result.status ?? 1);
