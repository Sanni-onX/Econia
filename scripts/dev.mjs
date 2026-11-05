import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const children = [
  spawn(
    process.execPath,
    ["--env-file-if-exists=.env", "apps/api/server.mjs"],
    { cwd: root, stdio: "inherit" },
  ),
  spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--config",
      "apps/web/vite.config.js",
      "apps/web",
    ],
    { cwd: root, stdio: "inherit" },
  ),
];
function stop() {
  for (const child of children) child.kill();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const child of children)
  child.on("exit", (code) => {
    if (code) {
      stop();
      process.exitCode = code;
    }
  });
