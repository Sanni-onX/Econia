import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
const secrets = [];
if (existsSync(".private"))
  for (const file of readdirSync(".private")) {
    const path = join(".private", file);
    if (!statSync(path).isFile()) continue;
    const raw = readFileSync(path, "utf8").trim();
    try {
      const data = JSON.parse(raw);
      for (const [k, v] of Object.entries(data))
        if (
          /seedPhrase|secretKey|privateKey|token/i.test(k) &&
          typeof v === "string" &&
          v.length > 15
        )
          secrets.push(v);
    } catch {
      if (raw.length > 15) secrets.push(raw);
    }
  }
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
let failed = false;
for (const file of files) {
  if (
    /(^|\/)(\.private|\.data|node_modules|target)(\/|$)|(^|\/)\.env$/.test(file)
  ) {
    console.error(`Forbidden tracked path: ${file}`);
    failed = true;
    continue;
  }
  const content = readFileSync(file, "utf8");
  if (
    secrets.some((value) => content.includes(value)) ||
    /ed25519:[1-9A-HJ-NP-Za-km-z]{80,100}/.test(content)
  ) {
    console.error(`Credential found in tracked source: ${file}`);
    failed = true;
  }
}
if (failed) process.exitCode = 1;
else
  console.log(
    `Checked ${files.length} tracked files; no wallet secrets or private runtime paths found.`,
  );
