import { spawn } from "node:child_process";
const child = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: { ...process.env, WRANGLER_LOG_PATH: ".wrangler/logs" },
  },
);
child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
child.on("exit", (code) => process.exit(code ?? 1));
