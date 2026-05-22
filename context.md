# Code Context

## Files Retrieved
1. `index.ts` (lines 327-378, 1379-1422, 1480-1496, 1900-2148, 2156+): core statusbar runtime; extension status hook lifecycle, segment context assembly, and widget rendering path.
2. `statusbar/config.ts` (lines 363-401, 551-598, 493-520): statusbar config parsing, custom item normalization, hidden key derivation, and extension status helpers.
3. `statusbar/segments.ts` (lines 448-474, 502-529): built-in `extension_statuses` segment plus `custom:<id>` segment rendering from `extensionStatuses` map.
4. `statusbar/layout.ts` (lines 53-123): merges preset segments with `customItems` and renders top/secondary bar rows.
5. `types.ts` (lines 95-105, 184-188): `CustomStatusItem` and `SegmentContext` fields that carry extension status map/metadata through render.
6. `README.md` (lines 169-207): documented integration contract for extension statuses + `statusbar.customItems` and hide/exclude behavior.
7. `tests/custom-items.test.ts` (full): existing assertions for custom status item config + hidden key + status normalization helpers.
8. `tests/layout.test.ts` (lines 161-219): current behavior checks for custom items rendering from extension-status map in layout.
9. `C:/Users/adityasharma/Projects/dotfiles/.pi/agent/extensions/personality-switcher/index.ts` (lines 10-38): extension wiring + startup hook where status is updated.
10. `C:/Users/adityasharma/Projects/dotfiles/.pi/agent/extensions/personality-switcher/commands.ts` (lines 17-25, 27-39): `updateStatus` currently clears key; persistence flow that should propagate UI status.
11. `C:/Users/adityasharma/Projects/dotfiles/.pi/agent/extensions/personality-switcher/state.ts` (lines 103-125, 128-153): extension state read/write lives in `~/.pi/agent/settings.json` under `extensionSettings.personalitySwitcher`.
12. `C:/Users/adityasharma/Projects/dotfiles/.pi/agent/extensions/personality-switcher/node-builtins.ts` (lines 54-61): shared config path with statusbar (`settings.json`).
13. `C:/Users/adityasharma/Projects/dotfiles/.pi/agent/settings.json` (lines 67-90, 103-109): current real user config: statusbar preset/customItems and personality extension settings persist together.

## Key Code
- **Statusbar consumes extension statuses via footer hook:** in `setupFooter` callback, `setExtensionStatus` is monkey-patched to `requestImmediateStatusRender()` after every update, so statusbar re-renders on `setStatus` calls (`index.ts:327-378`).
- **Segment context pulls status map each render:** `buildSegmentContext` reads `footerDataRef.getExtensionStatuses()` and injects `extensionStatuses`, `customItemsById`, and hidden-key set into context (`index.ts:1380-1422`).
- **Extension status rendering path:** default `extension_statuses` segment joins visible non-notification statuses from map unless key is hidden; custom segment resolves `custom:<id>` from `customItemsById` and `statusKey` (`segments.ts:448-474`, `segments.ts:502-529`).
- **Config controls promotion of keys:** `collectHiddenExtensionStatusKeys` defaults `excludeFromExtensionStatuses` to `true`, so custom items remove that key from aggregate segment unless opted out (`statusbar/config.ts:551-559`).
- **Personality extension currently suppresses status:** `updateStatus` always calls `ctx.ui.setStatus("personality", undefined)` on session start and after persistence, meaning no visible payload is ever published (`commands.ts:19-25`, `persistState` flow calls `updateStatus`).
- **Personality state persistence shares same file as statusbar config:** writes `extensionSettings.personalitySwitcher` under `~/.pi/agent/settings.json` (`state.ts:127-153`, `node-builtins.ts:54-61`), while statusbar reads `statusbar` from merged global/project settings (`settings file in dotfiles`).

## Architecture
- `personality-switcher` extension owns user-visible runtime state (personality/style) and writes it to settings; on session start it loads and normalizes that state, then currently only clears a `personality` UI status key.
- `pi-statusbar` is already designed to ingest arbitrary extension status keys through `ctx.ui.setStatus(...)`; it needs that key/value plus optional `statusbar.customItems` config to expose it.
- `configbar` pipeline is explicit and composable: `statusbar.customItems` maps status keys to layout segments; segment rendering is deterministic and tested for dedupe/merging/notifications.
- The integration seam is therefore not API-level missing plumbing, but a **contract mismatch**: personality extension emits `undefined` while statusbar expects meaningful text values.
- `dotfiles/.pi/agent/settings.json` already has both personality state (`extensionSettings`) and statusbar customization in one file, so adding a custom item is low-friction.

## Start Here
`index.ts` in `pi-statusbar` — this is the single flow where extension status updates become UI output (`setExtensionStatus` patch → status map → segment context → layout/segments). After validating this, inspect `statusbar/config.ts` + `segments.ts` for exact config and rendering semantics.

## Tests to add
1. **pi-statusbar unit tests** (`tests/layout.test.ts`): add case proving a custom item item with `statusKey: "personality"` and map value renders in status bar text; include width-sensitive fallback (visible once status text absent/present).
2. **pi-statusbar unit tests** (`tests/custom-items.test.ts`): add assertion that custom item with `excludeFromExtensionStatuses: true` removes `personality` from `extension_statuses` aggregate, matching current key-move behavior.
3. **Personality extension regression (if test harness added to dotfiles)**: assert `updateStatus({personality:"caveman",styles:[...]})` calls `setStatus("personality", value)` and `setStatus(..., undefined)` when off.
4. **Manual integration check (dotfiles settings):** with `personalitySwitcher` set and added `statusbar.customItems` entry, start session and confirm prompt shows status bar chip updates on `/personality` changes.

## Risks
- **Config collision/risk of invisibility:** current dotfiles preset (`statusbar.preset: default-no-cost`) may not include segment placement for personality unless custom item is added/placed.
- **Text churn / overflow:** personality strings can be verbose (e.g., `caveman + explanatory + gordon-ramsay`) and may spill layout, especially on narrow terminals.
- **Key namespace collision:** hard-coded key `personality` is shared only if other extensions choose same key; low risk but avoid overlap.
- **Stale state during early startup:** if statusbar is disabled/uninitialized, status updates still get published but no visible consumer exists until statusbar footer/widgets are mounted.
- **Styling/notification semantics:** default `excludeFromExtensionStatuses:true` hides the value from aggregated `extension_statuses`; good for clean UI, but if desired, set false to also show in aggregate notification area.
