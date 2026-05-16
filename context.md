# Code Context

## Files Retrieved

1. `index.ts` (lines 13-31, 67-73, 623-656, 956-959, 1760-1819, 2056-2172) — primary extension entrypoint now wired to user-defined preset config and runtime preset resolution.
2. `powerline-config.ts` (lines 4-10, 16-20, 89-104, 119-128, 132-182, 186-264, 268-330, 332-365) — central parser/resolver for powerline config, including `powerline.presets`, validation, extends-chain resolution, and persistence helpers.
3. `types.ts` (lines 29-53, 67-75, 100-121) — type model widened to support custom/`extension_statuses` segment IDs and user preset defs.
4. `segments.ts` (lines 431-485) — segment registry + `renderSegment` custom segment path using `custom:` IDs.
5. `README.md` (lines 68-132, 373-375) — docs now mention user-defined presets and added segment IDs.
6. `tests/presets-config.test.ts` (lines 1-420) — new test suite covering user preset parsing/extends/deduplication/persistence behavior.
7. `package.json` (lines 28-30) — test script confirms suite runs via `node --experimental-strip-types --test tests/**/*.test.ts`.
8. `CHANGELOG.md` (lines 1-7) — `Unreleased` header empty; new feature not yet logged.

## Key Code

- **Config shape expanded** (`powerline-config.ts:4-10`): `PowerlineConfig` now includes `preset: string` (not just built-in union) and `presets: Record<string, UserPresetDef>`.

- **User preset parser + validation** (`powerline-config.ts:186-233`, `215-263`):
  - `normalizeUserPreset()` accepts user preset overrides:
    - `extends`, `leftSegments`, `rightSegments`, `secondarySegments`, `separator`, `segmentOptions`, `colors`.
  - `normalizeSegmentList()` filters unknown IDs; built-ins + `custom:<id>` only.
  - `normalizeSeparator()` constrains to known styles.
  - `normalizeSegmentOptions()` validates model/path/git/time options.
  - `normalizeUserPresets()` drops invalid preset ids, non-object entries, and built-in name collisions.

- **Preset resolution** (`powerline-config.ts:268-330`):
  - `resolvePresetDef(config, PRESETS)` handles both built-ins and user presets.
  - `resolveExtendsChain()` walks `extends`, prevents cycles, falls back to `default` on broken/circular chains.
  - `applyUserPresetOverBase()` merges/overrides segment lists/options/colors per field.

- **Runtime flow** (`index.ts`):
  - Startup: `config = parsePowerlineConfig(startupSettings.powerline, PRESET_NAMES)` (`index.ts:957-959`).
  - `/powerline` command parsing and apply (`index.ts:1765-1818`): accepts user preset names, persists with `nextPowerlineSettingWithPreset` and shows built-in + user preset list.
  - Render: every segment build/layout step resolves current preset via `resolvePresetDef(config, PRESETS)` (`index.ts:2056-2167`).

- **Custom items + custom segments** (`segments.ts:453-485`): `renderSegment` handles `custom:` IDs; custom entries from `ctx.customItemsById` pull `extensionStatuses` and normalize values.

- **Deduped custom segment merge** (`powerline-config.ts:332-358`): `mergeSegmentsWithCustomItems()` no longer appends `custom:<id>` if already declared in preset arrays.

- **Tests** (`tests/presets-config.test.ts`): validates parsing, invalid input filtering, inherits/extends chain, circular fallback, dedupe behavior, and persistence helper behavior.

## Architecture

- Config is loaded/merged from global + project settings (`index.ts:593-594`) and normalized in `parsePowerlineConfig`.
- Normalized config holds:
  - selected `preset` string (built-in or user key)
  - optional `presets` map of user presets
  - existing `customItems`, `mouseScroll`, `fixedEditor`.
- `/powerline` handler updates both in-memory config and persisted settings via helper functions in `powerline-config.ts`.
- Render path resolves effective preset each time layout is needed, then generates segment context and segments from `PresetDef + customItems`.
- Segment rendering is typed over `StatusLineSegmentId` union, enabling built-ins and `custom:<id>`.

## Suggested task breakdown

1. **Changelog**: add unreleased entry describing user-defined presets and merge behavior.
2. **Behavior polish**: confirm edge-case intent for case sensitivity (`preset` names and `extends`) in user presets; add tests if behavior should be normalized.
3. **Cleanup**: `presets.ts` still exports `getPreset()` and `PresetDef` is only built-in typed via `Record<StatusLinePreset, PresetDef>`—decide whether dead export can be removed.
4. **Validation hardening**: consider validating `userPreset.colors` (currently pass-through with no schema check).
5. **Docs/tests sync**: ensure any remaining user-facing docs mention command discovery (`/powerline` listing now includes user preset names) and add release notes once finalized.

## Start Here

Open `powerline-config.ts` first. It contains the full parse/normalize/resolve state machine for the new user-preset feature and explains where most of the behavior guarantees and open questions live.
