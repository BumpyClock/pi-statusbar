import assert from "node:assert/strict";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const source = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const zero = "0".repeat(40);

function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), "pi hook fixture "));
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: join(root, "no-global-config"), GIT_AUTHOR_NAME: "Fixture", GIT_AUTHOR_EMAIL: "fixture@example.invalid", GIT_COMMITTER_NAME: "Fixture", GIT_COMMITTER_EMAIL: "fixture@example.invalid" };
  delete env.NODE_TEST_CONTEXT;
  const exec = (command, args, options = {}) => spawnSync(command, args, { cwd: root, env, encoding: "utf8", ...options });
  const git = (...args) => {
    const result = exec("git", args);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  try {
    git("init", "-q");
    for (const path of [".githooks/pre-push", "scripts/pre-push.mjs", "scripts/setup-hooks.sh"]) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      cpSync(join(source, path), join(root, path));
    }
    writeFileSync(join(root, ".gitignore"), "node_modules/\n");
    writeFileSync(join(root, "package.json"), JSON.stringify({ type: "module", devDependencies: { typescript: "5.9.3" } }));
    mkdirSync(join(root, "tests"));
    writeFileSync(join(root, "tests/sample.test.ts"), 'console.log("TEST_RAN"); process.exit(Number(process.env.TEST_EXIT || 0));\n');
    mkdirSync(join(root, "node_modules/typescript/bin"), { recursive: true });
    writeFileSync(join(root, "node_modules/typescript/package.json"), '{"version":"5.9.3"}');
    writeFileSync(join(root, "node_modules/typescript/bin/tsc"), 'console.log("TSC_RAN"); process.exit(Number(process.env.TSC_EXIT || 0));\n');
    git("add", ".");
    git("-c", "core.hooksPath=/dev/null", "commit", "-qm", "fixture");
    const head = git("rev-parse", "HEAD");
    const hook = (input = `refs/heads/main ${head} refs/heads/main ${zero}\n`, extraEnv = {}) => exec(join(root, ".githooks/pre-push"), [], { input, env: { ...env, ...extraEnv } });
    run({ root, env, exec, git, head, hook });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("full checks run for new branch, unknown base, multiple refs, and empty input", () => fixture(({ hook, head }) => {
  for (const input of [undefined, "", `refs/heads/main ${head} refs/heads/main ${"a".repeat(40)}\n`, `refs/heads/main ${head} refs/heads/main ${zero}\nrefs/heads/other ${head} refs/heads/other ${zero}\n`]) {
    const result = hook(input);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /TSC_RAN/);
    assert.match(result.stdout, /TEST_RAN/);
  }
}));

test("deletion-only skips tools but mixed deletion still checks", () => fixture(({ hook, head }) => {
  const deletion = `(delete) ${zero} refs/heads/old ${head}\n`;
  const result = hook(deletion);
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /TSC_RAN|TEST_RAN/);
  assert.match(hook(deletion + `refs/heads/new ${head} refs/heads/new ${zero}\n`).stdout, /TEST_RAN/);
}));

test("malformed refs, different pushed commit and dirty checkout fail", () => fixture(({ root, git, hook, head }) => {
  assert.notEqual(hook("invalid\n").status, 0);
  assert.notEqual(hook(`refs/heads/main bogus refs/heads/main ${zero}\n`).status, 0);
  writeFileSync(join(root, "file with spaces.ts"), "export {};\n");
  assert.notEqual(hook().status, 0);
  git("add", ".");
  git("-c", "core.hooksPath=/dev/null", "commit", "-qm", "second");
  assert.notEqual(hook(`refs/heads/old ${head} refs/heads/old ${zero}\n`).status, 0);
  const current = git("rev-parse", "HEAD");
  git("mv", "file with spaces.ts", "renamed file.ts");
  git("-c", "core.hooksPath=/dev/null", "commit", "-qm", "rename");
  const renamed = git("rev-parse", "HEAD");
  assert.equal(hook(`refs/heads/main ${renamed} refs/heads/main ${current}\n`).status, 0);
}));

test("compiler and test failures propagate, missing/stale tools fail without bootstrap", () => fixture(({ root, hook }) => {
  const compiler = hook(undefined, { TSC_EXIT: "17" });
  assert.equal(compiler.status, 17);
  assert.doesNotMatch(compiler.stdout, /TEST_RAN/);
  assert.notEqual(hook(undefined, { TEST_EXIT: "19" }).status, 0);
  writeFileSync(join(root, "node_modules/typescript/package.json"), '{"version":"0.0.0"}');
  assert.match(hook().stderr, /npm ci/);
  rmSync(join(root, "node_modules"), { recursive: true });
  assert.match(hook().stderr, /npm ci/);
  assert.equal(existsSync(join(root, "node_modules")), false);
}));

test("installer idempotent and honors configured hooks and active hooks", () => fixture(({ root, exec, git }) => {
  const install = () => exec(join(root, "scripts/setup-hooks.sh"), []);
  git("config", "core.hooksPath", "unrelated hooks");
  assert.notEqual(install().status, 0);
  assert.equal(git("config", "core.hooksPath"), "unrelated hooks");
  git("config", "core.hooksPath", "");
  assert.notEqual(install().status, 0);
  git("config", "--unset", "core.hooksPath");
  const active = join(root, git("rev-parse", "--git-path", "hooks"), "pre-commit");
  writeFileSync(active, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  assert.notEqual(install().status, 0);
  assert.match(readFileSync(active, "utf8"), /exit 0/);
  rmSync(active);
  assert.equal(install().status, 0);
  assert.equal(install().status, 0);
  assert.equal(git("config", "--local", "core.hooksPath"), ".githooks");
  chmodSync(join(root, ".githooks/pre-push"), 0o644);
  assert.notEqual(install().status, 0);
}));

test("installer resolves real hook directory in linked worktree", () => fixture(({ root, exec, git }) => {
  const linked = join(root, "linked worktree");
  git("worktree", "add", "-qb", "linked", linked);
  const result = exec(join(linked, "scripts/setup-hooks.sh"), [], { cwd: linked });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(git("config", "--local", "core.hooksPath"), ".githooks");
}));
