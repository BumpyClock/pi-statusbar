# Code Context

## Files Retrieved
1. `bash-mode/completion.ts` (lines 418-505 and 499-505) — `AutocompleteProvider` implementation methods currently typed as synchronous/union-return and failing interface conformance diagnostics.
2. `shortcuts.ts` (lines 40-47) — `matchesConfiguredShortcut` runtime path to `matchesKey` with raw `string` arg triggering `KeyId` mismatch.
3. `node_modules/@earendil-works/pi-tui/dist/autocomplete.d.ts` (lines 17-21, 34-37) — source of `AutocompleteProvider.getSuggestions` contract (`Promise<AutocompleteSuggestions | null>`).
4. `node_modules/@earendil-works/pi-tui/dist/keys.d.ts` (lines 31-33, 42, 165) — `KeyId` includes `pageUp`/`pageDown` (camelCase), not `pageup`/`pagedown`.
5. `index.ts` (lines 1905-1911, 1915-1945, 3160-3167) — call sites for `matchesConfiguredShortcut` and where bash autocomplete providers are wrapped/installed.
6. `tests/bash-mode.test.ts` (lines 736-772) — explicit sync return assumptions for `getSuggestions` (`instanceof Promise` checks).

## Key Code

**Diagnostics captured (TypeScript LSP-equivalent run with `npx tsc --pretty false --noEmit --types node --allowImportingTsExtensions bash-mode/completion.ts shortcuts.ts`):**
- `bash-mode/completion.ts:419` `BashAutocompleteProvider.getSuggestions(): AutocompleteSuggestions | null`
- `bash-mode/completion.ts:459` `OneOffBashAutocompleteProvider.getSuggestions(): AutocompleteSuggestions | null`
- `bash-mode/completion.ts:499` `ModeAwareAutocompleteProvider.getSuggestions(...): AutocompleteSuggestions | null | Promise<...>`
- `shortcuts.ts:46` `matchesConfiguredShortcut(...){... return matchesKey(data, shortcut); }`

**Contract mismatch source** (`pi-tui`):
```ts
export interface AutocompleteProvider {
  getSuggestions(
    lines: string[], cursorLine: number, cursorCol: number,
    options: { signal: AbortSignal; force?: boolean }
  ): Promise<AutocompleteSuggestions | null>;
}
```

**Current provider signatures**:
- `BashAutocompleteProvider.getSuggestions()` — no args, sync return.
- `OneOffBashAutocompleteProvider.getSuggestions()` — no args, sync return.
- `ModeAwareAutocompleteProvider.getSuggestions(...)` — mixed return including raw sync path.

**Shortcut matching**:
```ts
const normalizedShortcut = shortcut.toLowerCase();
if (shortcutUsesSuper(normalizedShortcut)) { ... }
return matchesKey(data, shortcut);
```
- Type error: `shortcut` is `string`, but `matchesKey` requires `KeyId`.

**`KeyId` constraint relevant detail:**
- Accepts `pageUp`/`pageDown`, while shortcut normalization layer currently uses lowercase `pageup`/`pagedown`.

## Architecture
- `matchesConfiguredShortcut` is the shared router for runtime shortcut dispatch in `index.ts` (chat jump, stash, copy/cut, bash-mode toggle), so any normalization/type-guard change here changes all shortcut matching behavior.
- Bash providers are installed in `index.ts:3160-3168` via `ModeAwareAutocompleteProvider` wrapper around `defaultProvider` + bash-specific providers.
- Interface contract must stay compatible with `AutocompleteProvider`; current classes are used where async suggestions are expected.

## Minimal safe fixes
1. **`bash-mode/completion.ts`**
   - `BashAutocompleteProvider.getSuggestions`:
     - Add full params: `(lines, cursorLine, cursorCol, options)`.
     - Return `Promise<AutocompleteSuggestions | null>` (likely `return Promise.resolve(null)` unless real suggestion logic exists).
   - `OneOffBashAutocompleteProvider.getSuggestions`:
     - Same change as above.
   - `ModeAwareAutocompleteProvider.getSuggestions`:
     - Change return to `Promise<AutocompleteSuggestions | null>` and align body with awaited provider calls.
     - Keep fallback for missing `defaultProvider` returning `null` (as resolved promise in async context).

2. **`shortcuts.ts`**
   - Normalize non-`super` shortcut before `matchesKey` into `KeyId`-compatible string:
     - map `pageup -> pageUp`, `pagedown -> pageDown` at minimum.
     - narrow to `KeyId` only after mapping (or explicit local helper/type-guard).
   - Keep super regex path unchanged.

## Test impact
- `tests/bash-mode.test.ts`:
  - `"bash autocomplete providers return null synchronously in shell contexts"` currently asserts no Promise (`lines 736-746`).
  - `"mode-aware autocomplete provider preserves synchronous default results"` currently asserts returned object is not Promise (`lines 748-772`).
  - Both need update if `getSuggestions` becomes Promise-based.
- Existing shortcut tests in `tests/jump-shortcuts.test.ts` only exercise `super+...` flows, so non-super canonicalization change likely requires **new coverage** for `pageup/pagedown` behavior, not replacement of existing coverage.

## Start Here
Open `bash-mode/completion.ts` around class methods `getSuggestions` (`~lines 419, 459, 499`) first to align signatures with `AutocompleteProvider`, then open `shortcuts.ts` around `matchesConfiguredShortcut` (`~line 40`) for `KeyId`-safe normalization.
