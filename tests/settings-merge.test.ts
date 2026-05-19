import test from "node:test";
import assert from "node:assert/strict";
import { mergeSettings } from "../core/settings-merge.ts";

// ── mergeSettings: shallow override ──────────────────────────────────────

test("mergeSettings overrides primitive values", () => {
	const result = mergeSettings(
		{ preset: "default", mouseScroll: true },
		{ preset: "compact" },
	);
	assert.equal(result.preset, "compact");
	assert.equal(result.mouseScroll, true);
});

test("mergeSettings adds new keys from override", () => {
	const result = mergeSettings({ a: 1 }, { b: 2 });
	assert.equal(result.a, 1);
	assert.equal(result.b, 2);
});

// ── mergeSettings: deep merge ────────────────────────────────────────────

test("mergeSettings deep-merges nested records", () => {
	const result = mergeSettings(
		{ statusbar: { preset: "default", mouseScroll: true } },
		{ statusbar: { preset: "compact" } },
	);

	const statusbar = result.statusbar as Record<string, unknown>;
	assert.equal(statusbar.preset, "compact");
	assert.equal(statusbar.mouseScroll, true);
});

test("mergeSettings deep-merges three levels deep", () => {
	const result = mergeSettings(
		{ a: { b: { c: 1, d: 2 } } },
		{ a: { b: { c: 99 } } },
	);

	const nested = (result.a as Record<string, unknown>).b as Record<string, unknown>;
	assert.equal(nested.c, 99);
	assert.equal(nested.d, 2);
});

// ── mergeSettings: override replaces non-record with record ──────────────

test("mergeSettings replaces non-record base with override value", () => {
	const result = mergeSettings(
		{ statusbar: "compact" },
		{ statusbar: { preset: "full" } },
	);
	assert.deepEqual(result.statusbar, { preset: "full" });
});

test("mergeSettings replaces record base with non-record override", () => {
	const result = mergeSettings(
		{ statusbar: { preset: "default" } },
		{ statusbar: "compact" },
	);
	assert.equal(result.statusbar, "compact");
});

// ── mergeSettings: arrays are replaced, not merged ───────────────────────

test("mergeSettings replaces arrays (no concat)", () => {
	const result = mergeSettings(
		{ items: [1, 2, 3] },
		{ items: [4, 5] },
	);
	assert.deepEqual(result.items, [4, 5]);
});

// ── mergeSettings: does not mutate inputs ────────────────────────────────

test("mergeSettings does not mutate base or override", () => {
	const base = { a: { b: 1 } };
	const override = { a: { c: 2 } };
	const baseBefore = JSON.parse(JSON.stringify(base));
	const overrideBefore = JSON.parse(JSON.stringify(override));

	mergeSettings(base, override);

	assert.deepEqual(base, baseBefore);
	assert.deepEqual(override, overrideBefore);
});

// ── mergeSettings: empty inputs ──────────────────────────────────────────

test("mergeSettings with empty override returns copy of base", () => {
	const result = mergeSettings({ preset: "default" }, {});
	assert.deepEqual(result, { preset: "default" });
});

test("mergeSettings with empty base returns copy of override", () => {
	const result = mergeSettings({}, { preset: "compact" });
	assert.deepEqual(result, { preset: "compact" });
});
