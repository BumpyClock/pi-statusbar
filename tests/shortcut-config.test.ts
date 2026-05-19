import test from "node:test";
import assert from "node:assert/strict";
import {
	normalizeShortcut,
	parseShortcutOverride,
	shortcutUsageKey,
	isValidShortcutKeyPart,
	SHORTCUT_MODIFIER_ORDER,
	SHORTCUT_MODIFIERS,
	SHORTCUT_NAMED_KEYS,
	SHORTCUT_SYMBOL_KEYS,
} from "../core/shortcut-config.ts";

// ── normalizeShortcut ────────────────────────────────────────────────────

test("normalizeShortcut lowercases and sorts modifiers canonically", () => {
	assert.equal(normalizeShortcut("Shift+Ctrl+a"), "ctrl+shift+a");
	assert.equal(normalizeShortcut("Alt+Ctrl+x"), "ctrl+alt+x");
	assert.equal(normalizeShortcut("super+alt+up"), "alt+super+up");
});

test("normalizeShortcut returns single key unchanged", () => {
	assert.equal(normalizeShortcut("escape"), "escape");
	assert.equal(normalizeShortcut("a"), "a");
});

test("normalizeShortcut handles modifiers in correct CSAS order", () => {
	// ctrl < alt < super < shift
	assert.equal(normalizeShortcut("shift+super+alt+ctrl+a"), "ctrl+alt+super+shift+a");
});

test("normalizeShortcut trims whitespace", () => {
	assert.equal(normalizeShortcut("  ctrl+a  "), "ctrl+a");
});

// ── isValidShortcutKeyPart ───────────────────────────────────────────────

test("isValidShortcutKeyPart accepts single alpha/numeric chars", () => {
	assert.equal(isValidShortcutKeyPart("a"), true);
	assert.equal(isValidShortcutKeyPart("Z"), true);
	assert.equal(isValidShortcutKeyPart("5"), true);
});

test("isValidShortcutKeyPart accepts function keys F1-F12", () => {
	assert.equal(isValidShortcutKeyPart("f1"), true);
	assert.equal(isValidShortcutKeyPart("F12"), true);
	assert.equal(isValidShortcutKeyPart("f13"), false);
	assert.equal(isValidShortcutKeyPart("f0"), false);
});

test("isValidShortcutKeyPart accepts named keys", () => {
	assert.equal(isValidShortcutKeyPart("escape"), true);
	assert.equal(isValidShortcutKeyPart("enter"), true);
	assert.equal(isValidShortcutKeyPart("tab"), true);
	assert.equal(isValidShortcutKeyPart("backspace"), true);
	assert.equal(isValidShortcutKeyPart("up"), true);
	assert.equal(isValidShortcutKeyPart("pageup"), true);
	assert.equal(isValidShortcutKeyPart("home"), true);
});

test("isValidShortcutKeyPart accepts symbol keys", () => {
	assert.equal(isValidShortcutKeyPart(","), true);
	assert.equal(isValidShortcutKeyPart("."), true);
	assert.equal(isValidShortcutKeyPart("/"), true);
	assert.equal(isValidShortcutKeyPart("["), true);
	assert.equal(isValidShortcutKeyPart("]"), true);
});

test("isValidShortcutKeyPart rejects multi-char nonsense", () => {
	assert.equal(isValidShortcutKeyPart("ab"), false);
	assert.equal(isValidShortcutKeyPart("nope"), false);
	assert.equal(isValidShortcutKeyPart(""), false);
});

// ── parseShortcutOverride ────────────────────────────────────────────────

test("parseShortcutOverride normalizes valid shortcut", () => {
	assert.equal(parseShortcutOverride("ctrl+a"), "ctrl+a");
	assert.equal(parseShortcutOverride("Ctrl+Shift+A"), "ctrl+shift+a");
	assert.equal(parseShortcutOverride("alt+,"), "alt+,");
});

test("parseShortcutOverride converts cmd/command to super", () => {
	assert.equal(parseShortcutOverride("cmd+up"), "super+up");
	assert.equal(parseShortcutOverride("command+up"), "super+up");
});

test("parseShortcutOverride rejects unsupported super shortcuts", () => {
	// super+c is not a supported super shortcut
	assert.equal(parseShortcutOverride("super+c"), null);
	assert.equal(parseShortcutOverride("cmd+z"), null);
});

test("parseShortcutOverride accepts supported super shortcuts", () => {
	assert.equal(parseShortcutOverride("super+up"), "super+up");
	assert.equal(parseShortcutOverride("super+down"), "super+down");
	assert.equal(parseShortcutOverride("super+shift+up"), "super+shift+up");
});

test("parseShortcutOverride rejects non-string input", () => {
	assert.equal(parseShortcutOverride(null), null);
	assert.equal(parseShortcutOverride(42), null);
	assert.equal(parseShortcutOverride(undefined), null);
	assert.equal(parseShortcutOverride({}), null);
});

test("parseShortcutOverride rejects empty/whitespace strings", () => {
	assert.equal(parseShortcutOverride(""), null);
	assert.equal(parseShortcutOverride("   "), null);
	assert.equal(parseShortcutOverride("ctrl a"), null); // space not +
});

test("parseShortcutOverride rejects duplicate modifiers", () => {
	assert.equal(parseShortcutOverride("ctrl+ctrl+a"), null);
});

test("parseShortcutOverride rejects invalid modifier names", () => {
	assert.equal(parseShortcutOverride("meta+a"), null);
	assert.equal(parseShortcutOverride("win+a"), null);
});

test("parseShortcutOverride rejects empty parts from double-plus", () => {
	assert.equal(parseShortcutOverride("ctrl++a"), null);
});

test("parseShortcutOverride rejects invalid key part", () => {
	assert.equal(parseShortcutOverride("ctrl+nope"), null);
	assert.equal(parseShortcutOverride("ctrl+ab"), null);
});

test("parseShortcutOverride preserves symbol key case", () => {
	// Symbol keys like , . / are kept as-is (not lowercased)
	assert.equal(parseShortcutOverride("ctrl+,"), "ctrl+,");
	assert.equal(parseShortcutOverride("ctrl+."), "ctrl+.");
	assert.equal(parseShortcutOverride("ctrl+/"), "ctrl+/");
});

// ── shortcutUsageKey ─────────────────────────────────────────────────────

test("shortcutUsageKey normalizes and resolves conflict aliases", () => {
	// super+home conflicts with super+up
	assert.equal(shortcutUsageKey("super+home"), "super+up");
	assert.equal(shortcutUsageKey("super+end"), "super+down");
	assert.equal(shortcutUsageKey("super+shift+home"), "super+shift+up");
	assert.equal(shortcutUsageKey("super+shift+end"), "super+shift+down");
});

test("shortcutUsageKey normalizes non-conflicting shortcuts", () => {
	assert.equal(shortcutUsageKey("ctrl+a"), "ctrl+a");
	assert.equal(shortcutUsageKey("Shift+Ctrl+g"), "ctrl+shift+g");
});

// ── Constants sanity checks ──────────────────────────────────────────────

test("SHORTCUT_MODIFIER_ORDER has 4 modifiers", () => {
	assert.equal(SHORTCUT_MODIFIER_ORDER.length, 4);
	assert.deepEqual([...SHORTCUT_MODIFIER_ORDER], ["ctrl", "alt", "super", "shift"]);
});

test("SHORTCUT_MODIFIERS matches SHORTCUT_MODIFIER_ORDER", () => {
	for (const mod of SHORTCUT_MODIFIER_ORDER) {
		assert.ok(SHORTCUT_MODIFIERS.has(mod), `Missing modifier: ${mod}`);
	}
	assert.equal(SHORTCUT_MODIFIERS.size, SHORTCUT_MODIFIER_ORDER.length);
});

test("SHORTCUT_NAMED_KEYS includes essential navigation keys", () => {
	for (const key of ["escape", "enter", "tab", "space", "up", "down", "left", "right", "home", "end", "pageup", "pagedown"]) {
		assert.ok(SHORTCUT_NAMED_KEYS.has(key), `Missing named key: ${key}`);
	}
});

test("SHORTCUT_SYMBOL_KEYS includes common punctuation", () => {
	for (const key of [",", ".", "/", "[", "]", ";", "'", "-", "="]) {
		assert.ok(SHORTCUT_SYMBOL_KEYS.has(key), `Missing symbol key: ${key}`);
	}
});
