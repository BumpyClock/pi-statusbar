# Development checks

Use Node 24, matching CI. Install development dependencies with `npm ci` before running checks. TypeScript 5.9.3 is a direct, exact development dependency. No global compiler is required.

```sh
npm ci
npm run typecheck
npm test
npm run test:hooks
npm pack --dry-run
```

`npm run test:hooks` uses disposable Git fixtures and stub check commands. It tests executable hook behavior, not extension behavior or native Windows compatibility. `npm test` remains the complete extension test suite. Neither command makes provider calls.

## Optional pre-push hook

```sh
sh scripts/setup-hooks.sh
```

Installation is explicit and idempotent. The installer uses repository-local `core.hooksPath=.githooks`, including linked worktrees. That setting applies to this repository's worktrees. It refuses existing unrelated hook configuration or active default-directory hooks. Integrate existing hooks manually instead of replacing them. Git Bash is required on Windows. Native Windows execution remains separately unverified.

The hook runs the local pinned compiler over the whole TypeScript project, then the existing complete extension tests. It never installs packages, changes files, invokes model providers, signs or publishes. No formatter or lint policy is invented.

Every non-deleted pushed ref must resolve to checked-out HEAD. The checkout must be clean, including untracked files. Push different commits separately from clean checkouts. No automatic stash or checkout occurs. Deletion-only pushes need no source checks. New branches, unknown remote bases, multiple same-commit refs and empty input use full checks. Renames and paths with spaces need no special selection because checks are project-wide.

CI retains `npm pack --dry-run`. Compatible Linux check, release-quality and release-orchestration jobs use Boat. The npm publication job stays on `ubuntu-latest` because [npm provenance requires a GitHub-hosted runner](https://docs.npmjs.com/generating-provenance-statements). Release Please policy, publication credentials, peer ranges and provenance permissions are unchanged. BumpyClock owner-only public Boat runs are approved; outsiders and bots remain blocked. No live workflow was dispatched. Hook latency depends on host and installed dependencies; no local speed guarantee is made.
