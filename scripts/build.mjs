import { spawnSync } from "node:child_process";
// Linux/Sites retains its existing bounded build; Windows uses the same CLI directly.
const isWindows = process.platform === "win32";
const child = spawnSync(
  isWindows ? process.execPath : "bash",
  isWindows
    ? ["node_modules/vinext/dist/cli.js", "build"]
    : ["scripts/build-verified.sh"],
  {
    stdio: "inherit",
    timeout: 200000,
    env: {
      ...process.env,
      WRANGLER_WRITE_LOGS: "false",
      WRANGLER_LOG_PATH: ".wrangler/logs",
      MINIFLARE_REGISTRY_PATH: ".wrangler/registry",
    },
  },
);
if (child.error) {
  console.error(child.error.message);
  process.exit(1);
}
process.exit(child.status ?? 1);
