# Code Context

## Files Retrieved

1. `statusbar-config.ts` (lines 19-27, 365-401) — `StatusbarConfig` type and `parseStatusbarConfig()` default/merge logic for `mouseScroll` and `fixedEditor`; this is the core defaulting gate.
2. `index.ts` (lines 114-121, 1213-1217, 2153-2217) — runtime config initialization + `/statusbar mouse-scroll` + `/statusbar fixed-editor` command handlers that mutate/persist options.
3. `fixed-editor/terminal-split.ts` (lines 422-423, 451-452) — terminal compositor uses `mouseScroll` boolean to enable/disable mouse-reporting/selection behavior.
4. `tests/custom-items.test.ts` (lines 14-54, 125-143, 146-157) — assertions that default config resolves to both flags `true` and option persistence merging semantics.
5. `tests/fixed-editor.test.ts` (lines 1697-1743) — regression test for `mouseScroll: false` disabling terminal mouse reporting.
6. `README.md` (lines 47-66) — user-facing defaults and settings examples for `fixedEditor`/`mouseScroll`.
7. `package.json` (lines 2-3, 32-38) — version + release bump scripts used by release flow.
8. `scripts/bump-version.js` (lines 11-16, 33-40, 68-105, 112-156) — manual version bump entry point and package-lock sync behavior.
9. `.github/workflows/release-please.yml` (lines 1-41) — automated release PR/release workflow (release-please-action).
10. `.github/workflows/release-from-package.yml` (lines 1-77) — manual workflow that tags/release by current `package.json` version.
11. `.github/workflows/npm-publish.yml` (lines 1-58) — publish workflow triggered by GitHub release (or manual workflow_dispatch).
12. `package-lock.json` (lines 1-10) — must stay in sync with `package.json` version.

## Key Code

- **Defaults are already explicitly true in config parse:**
  ```ts
  const defaultConfig: StatusbarConfig = {
    ...,
    mouseScroll: true,
    fixedEditor: true,
    ...
  };
  return {
    ...,
    mouseScroll: value.mouseScroll !== false,
    fixedEditor: value.fixedEditor !== false,
  };
  ```
- **Startup + command mutation path:** `startupSettings = readSettings(); config = parseStatusbarConfig(...)` at startup, and on `/statusbar mouse-scroll|fixed-editor`, config is toggled and persisted via `writeStatusbarOptionSetting(...)`.
- **Runtime usage of mouse flag:** `TerminalSplitCompositor` sets `this.mouseScroll = options.mouseScroll !== false` and gates mouse reporting in install:
  ```ts
  this.mouseScroll ? enableMouseReporting() : "";
  ```
- **Release entry points:**
  - `package.json` scripts: `npm run bump:patch|minor|major|set`.
  - `.github/workflows/release-from-package.yml`: reads `package.json` version, ensures tag missing, creates GitHub release.
  - `.github/workflows/npm-publish.yml`: publishes on release event.

## Architecture

- User config is loaded through `readSettings()` in `index.ts`, merged from global/project JSON.
- `parseStatusbarConfig()` normalizes defaults, then all runtime behavior reads `config.mouseScroll` / `config.fixedEditor`.
- Commands update `config` in-memory and persist under `statusbar` setting.
- `TerminalSplitCompositor` receives resolved options and directly controls whether mouse-wheel/input reporting is active in fixed-editor mode.
- Release flow is split: version bump + tag/release (`release-from-package` or release-please automation) → publish (`npm-publish`).

## Start Here

`statusbar-config.ts` (lines 365-401) because default behavior is set/overridden here; if not true, this is the first fix point before touching `index.ts` UI wiring.

## Recommendations (exact)

- **Defaults change needed?** Based on current code, **no code change required** for `fixedEditor` + `mouseScroll` defaults — already `true` in both entry points.
- **If you still want an explicit behavioral hardening**, consider adding/confirming tests in `tests/custom-items.test.ts` around defaults only when future regressions are possible.
- **Release prep commands (manual, deterministic):**
  - `npm run bump:patch` (or minor/major)
  - `npm run bump:patch --dry-run` first to preview
  - `npm run typecheck`
  - `npm test`
  - `git add package.json package-lock.json`
  - `git commit -m "fix: enforce fixedEditor/mouseScroll defaults as true"`
  - `git push`
  - `gh workflow run "Release From Package" -f version="$(node -p "require('./package.json').version")" -f target=main`
- **Alternative auto-release path:** push normal commits/PRs, then let `release-please` run on `main`; it will handle PR+release creation if conventional commits are present.

- **Tests to run for default safety:**
  - `node --experimental-strip-types --test tests/custom-items.test.ts`
  - `node --experimental-strip-types --test tests/fixed-editor.test.ts`
  - `npm run typecheck && npm test`

- **Open risk / constraint:** `package.json` is `0.1.1` while tags/changelog indicate `v0.5.x`; before release, confirm intended next version target so bump/release does not create unexpected semver regression with existing tag history.
