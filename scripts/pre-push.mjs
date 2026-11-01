import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function fail(message) {
  console.error(`pre-push: ${message}`);
  process.exit(1);
}

function git(...args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.error || result.status !== 0) fail(`git ${args[0]} failed. Check repository state.`);
  return result.stdout.trim();
}

const input = readFileSync(0, "utf8").trim();
const head = git("rev-parse", "--verify", "HEAD^{commit}");
let updates = 0;
for (const line of input ? input.split(/\r?\n/) : []) {
  const fields = line.trim().split(/\s+/);
  if (fields.length !== 4) fail("invalid pre-push input; expected four fields per ref.");
  const [, local, , remote] = fields;
  if (![local, remote].every((value) => /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(value))) {
    fail("invalid object ID in pre-push input.");
  }
  if (/^0+$/.test(local)) continue;
  if (git("rev-parse", "--verify", `${local}^{commit}`) !== head) {
    fail("every pushed non-deleted ref must point to checked-out HEAD. Check out and validate each ref separately.");
  }
  updates++;
}
if (input && updates === 0) process.exit(0);

// Full checks deliberately avoid uncertain diff bases and changed-file false greens.
if (git("status", "--porcelain=v1", "--untracked-files=normal")) {
  fail("clean checkout required, including untracked files. Commit or move your work yourself; no automatic stash.");
}
if (Number(process.versions.node.split(".")[0]) !== 24) fail("use Node 24, matching CI, then run npm ci.");
let compiler;
try {
  compiler = JSON.parse(readFileSync("node_modules/typescript/package.json", "utf8"));
} catch {
  fail("local TypeScript missing. Run npm ci with development dependencies before pushing.");
}
const expected = JSON.parse(readFileSync("package.json", "utf8")).devDependencies.typescript;
if (compiler.version !== expected) fail("local TypeScript differs from pinned version. Run npm ci.");

for (const args of [["node_modules/typescript/bin/tsc", "--noEmit"], ["--experimental-strip-types", "--test", "tests/**/*.test.ts"]]) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.error) fail(`cannot start check: ${result.error.message}`);
  if (result.signal) fail(`check terminated by ${result.signal}`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
