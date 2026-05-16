import test from "node:test";
import assert from "node:assert/strict";
import {
	parsePowerlineConfig,
	resolvePresetDef,
	mergeSegmentsWithCustomItems,
	nextPowerlineSettingWithPreset,
} from "../powerline-config.ts";
import { PRESETS } from "../presets.ts";
import type { PresetDef, StatusLinePreset } from "../types.ts";

const BUILTIN_NAMES = Object.keys(PRESETS) as StatusLinePreset[];

// ── parsePowerlineConfig: user preset map ────────────────────────────────

test("parsePowerlineConfig parses user presets map", () => {
	const config = parsePowerlineConfig(
		{
			preset: "daily",
			presets: {
				daily: {
					extends: "default",
					leftSegments: ["model", "path"],
					separator: "slash",
				},
			},
		},
		BUILTIN_NAMES,
	);

	assert.equal(config.preset, "daily");
	assert.ok(config.presets.daily);
	assert.deepEqual(config.presets.daily.leftSegments, ["model", "path"]);
	assert.equal(config.presets.daily.extends, "default");
	assert.equal(config.presets.daily.separator, "slash");
});

test("parsePowerlineConfig filters invalid segment ids from user presets", () => {
	const config = parsePowerlineConfig(
		{
			preset: "test",
			presets: {
				test: {
					leftSegments: ["model", "nope", "", "custom:", "custom:ci", "path"],
				},
			},
		},
		BUILTIN_NAMES,
	);

	// "nope", "", "custom:" are invalid → filtered out
	assert.deepEqual(config.presets.test.leftSegments, [
		"model",
		"custom:ci",
		"path",
	]);
});

test("parsePowerlineConfig legacy string config still works", () => {
	const config = parsePowerlineConfig("compact", BUILTIN_NAMES);
	assert.equal(config.preset, "compact");
	assert.deepEqual(config.presets, {});
	assert.deepEqual(config.customItems, []);
});

test("parsePowerlineConfig legacy object config without presets still works", () => {
	const config = parsePowerlineConfig(
		{ preset: "full", customItems: [{ id: "ci", statusKey: "ci" }] },
		BUILTIN_NAMES,
	);
	assert.equal(config.preset, "full");
	assert.deepEqual(config.presets, {});
	assert.equal(config.customItems.length, 1);
});

test("parsePowerlineConfig ignores invalid preset map entries", () => {
	const config = parsePowerlineConfig(
		{
			preset: "default",
			presets: {
				"valid-one": { leftSegments: ["model"] },
				"": { leftSegments: ["path"] }, // empty id
				"bad id": { leftSegments: ["path"] }, // space in id
				ok: "not-an-object", // not an object
			},
		},
		BUILTIN_NAMES,
	);

	assert.ok(config.presets["valid-one"]);
	assert.equal(config.presets[""], undefined);
	assert.equal(config.presets["bad id"], undefined);
	assert.equal(config.presets["ok"], undefined);
});

test("parsePowerlineConfig normalizes separator in user preset", () => {
	const config = parsePowerlineConfig(
		{
			preset: "test",
			presets: {
				test: { separator: "POWERLINE" },
			},
		},
		BUILTIN_NAMES,
	);
	assert.equal(config.presets.test.separator, "powerline");
});

test("parsePowerlineConfig drops invalid separator in user preset", () => {
	const config = parsePowerlineConfig(
		{
			preset: "test",
			presets: {
				test: { separator: "banana" },
			},
		},
		BUILTIN_NAMES,
	);
	assert.equal(config.presets.test.separator, undefined);
});

test("parsePowerlineConfig ignores user presets that conflict with built-ins", () => {
	const config = parsePowerlineConfig(
		{
			preset: "default",
			presets: {
				default: { leftSegments: ["path"] },
				Default: { leftSegments: ["git"] },
				daily: { leftSegments: ["model"] },
			},
		},
		BUILTIN_NAMES,
	);

	assert.equal(config.presets.default, undefined);
	assert.equal(config.presets.Default, undefined);
	assert.deepEqual(config.presets.daily.leftSegments, ["model"]);
});

test("parsePowerlineConfig validates segment options in user preset", () => {
	const config = parsePowerlineConfig(
		{
			preset: "opts",
			presets: {
				opts: {
					segmentOptions: {
						model: { showThinkingLevel: false, ignored: "no" },
						path: { mode: "full", maxLength: 42.8, ignored: true },
						git: { showBranch: false, showStaged: "no" },
						time: { format: "24h", showSeconds: true },
					},
				},
			},
		},
		BUILTIN_NAMES,
	);

	assert.deepEqual(config.presets.opts.segmentOptions, {
		model: { showThinkingLevel: false },
		path: { mode: "full", maxLength: 42 },
		git: { showBranch: false },
		time: { format: "24h", showSeconds: true },
	});
});

test("parsePowerlineConfig sanitizes colors in user preset", () => {
	const config = parsePowerlineConfig(
		{
			preset: "colored",
			presets: {
				colored: {
					colors: {
						model: " accent ",
						nope: "warning",
						path: "",
						gitDirty: 42,
					},
				},
				empty: {
					colors: {
						nope: "warning",
					},
				},
			},
		},
		BUILTIN_NAMES,
	);

	assert.deepEqual(config.presets.colored.colors, { model: "accent" });
	assert.equal(config.presets.empty.colors, undefined);
});

// ── resolvePresetDef ─────────────────────────────────────────────────────

test("resolvePresetDef returns built-in preset by name", () => {
	const config = parsePowerlineConfig("default", BUILTIN_NAMES);
	const resolved = resolvePresetDef(config, PRESETS);
	assert.deepEqual(resolved.leftSegments, PRESETS.default.leftSegments);
	assert.equal(resolved.separator, PRESETS.default.separator);
});

test("resolvePresetDef resolves user preset extending built-in", () => {
	const config = parsePowerlineConfig(
		{
			preset: "daily",
			presets: {
				daily: {
					extends: "default",
					rightSegments: ["cost", "context_pct"],
				},
			},
		},
		BUILTIN_NAMES,
	);
	const resolved = resolvePresetDef(config, PRESETS);

	// leftSegments inherited from default
	assert.deepEqual(resolved.leftSegments, PRESETS.default.leftSegments);
	// rightSegments replaced
	assert.deepEqual(resolved.rightSegments, ["cost", "context_pct"]);
	// separator inherited
	assert.equal(resolved.separator, PRESETS.default.separator);
});

test("resolvePresetDef merges preset colors with inherited colors", () => {
	const config = parsePowerlineConfig(
		{
			preset: "colored",
			presets: {
				colored: {
					extends: "nerd",
					colors: { model: "accent" },
				},
			},
		},
		BUILTIN_NAMES,
	);
	const resolved = resolvePresetDef(config, PRESETS);

	assert.equal(resolved.colors?.model, "accent");
	assert.equal(resolved.colors?.path, PRESETS.nerd.colors?.path);
});

test("resolvePresetDef resolves user-to-user extends chain", () => {
	const config = parsePowerlineConfig(
		{
			preset: "child",
			presets: {
				parent: {
					extends: "minimal",
					leftSegments: ["model", "path", "git"],
					separator: "pipe",
				},
				child: {
					extends: "parent",
					rightSegments: ["cost"],
				},
			},
		},
		BUILTIN_NAMES,
	);
	const resolved = resolvePresetDef(config, PRESETS);

	// leftSegments from parent
	assert.deepEqual(resolved.leftSegments, ["model", "path", "git"]);
	// rightSegments replaced by child
	assert.deepEqual(resolved.rightSegments, ["cost"]);
	// separator from parent
	assert.equal(resolved.separator, "pipe");
});

test("resolvePresetDef falls back to default on circular extends", () => {
	const config = parsePowerlineConfig(
		{
			preset: "a",
			presets: {
				a: { extends: "b", leftSegments: ["model"] },
				b: { extends: "a", leftSegments: ["path"] },
			},
		},
		BUILTIN_NAMES,
	);
	const resolved = resolvePresetDef(config, PRESETS);

	// Should fallback to default preset on circular dependency
	assert.deepEqual(resolved.leftSegments, PRESETS.default.leftSegments);
});

test("resolvePresetDef falls back to default when user preset extends unknown preset", () => {
	const config = parsePowerlineConfig(
		{
			preset: "broken",
			presets: {
				broken: { extends: "missing" },
			},
		},
		BUILTIN_NAMES,
	);
	const resolved = resolvePresetDef(config, PRESETS);

	assert.deepEqual(resolved.leftSegments, PRESETS.default.leftSegments);
});

test("resolvePresetDef falls back to default for unknown preset name", () => {
	const config = parsePowerlineConfig({ preset: "nonexistent" }, BUILTIN_NAMES);
	// preset falls back to "default" when not in built-in list
	assert.equal(config.preset, "default");
	const resolved = resolvePresetDef(config, PRESETS);
	assert.deepEqual(resolved.leftSegments, PRESETS.default.leftSegments);
});

test("resolvePresetDef merges segmentOptions per segment", () => {
	const config = parsePowerlineConfig(
		{
			preset: "opts",
			presets: {
				opts: {
					extends: "default",
					segmentOptions: {
						path: { mode: "full" },
					},
				},
			},
		},
		BUILTIN_NAMES,
	);
	const resolved = resolvePresetDef(config, PRESETS);

	// path overridden
	assert.equal(resolved.segmentOptions?.path?.mode, "full");
	// model inherited from default
	assert.equal(
		resolved.segmentOptions?.model?.showThinkingLevel,
		PRESETS.default.segmentOptions?.model?.showThinkingLevel,
	);
});

test("resolvePresetDef does not mutate PRESETS", () => {
	const defaultLeftBefore = [...PRESETS.default.leftSegments];
	const defaultSepBefore = PRESETS.default.separator;
	const defaultOptsBefore = JSON.parse(
		JSON.stringify(PRESETS.default.segmentOptions),
	);

	const config = parsePowerlineConfig(
		{
			preset: "mutator",
			presets: {
				mutator: {
					extends: "default",
					leftSegments: ["path"],
					separator: "pipe",
					segmentOptions: { path: { mode: "full" } },
				},
			},
		},
		BUILTIN_NAMES,
	);
	resolvePresetDef(config, PRESETS);

	assert.deepEqual(PRESETS.default.leftSegments, defaultLeftBefore);
	assert.equal(PRESETS.default.separator, defaultSepBefore);
	assert.deepEqual(PRESETS.default.segmentOptions, defaultOptsBefore);
});

// ── mergeSegmentsWithCustomItems dedupe ──────────────────────────────────

test("mergeSegmentsWithCustomItems dedupes custom:ci when already in preset", () => {
	const presetDef: PresetDef = {
		leftSegments: ["model", "custom:ci", "path"],
		rightSegments: ["cost"],
		secondarySegments: ["extension_statuses"],
		separator: "powerline",
	};

	const merged = mergeSegmentsWithCustomItems(presetDef, [
		{
			id: "ci",
			statusKey: "ci-status",
			position: "left",
			hideWhenMissing: true,
			excludeFromExtensionStatuses: true,
		},
		{
			id: "timer",
			statusKey: "timer",
			position: "right",
			hideWhenMissing: true,
			excludeFromExtensionStatuses: true,
		},
	]);

	// custom:ci already in left → not appended again
	assert.deepEqual(merged.leftSegments, ["model", "custom:ci", "path"]);
	// custom:timer not in preset → auto-appended by position
	assert.deepEqual(merged.rightSegments, ["cost", "custom:timer"]);
});

test("mergeSegmentsWithCustomItems dedupes across all segment arrays", () => {
	const presetDef: PresetDef = {
		leftSegments: ["model"],
		rightSegments: ["custom:review"],
		secondarySegments: [],
		separator: "powerline",
	};

	const merged = mergeSegmentsWithCustomItems(presetDef, [
		{
			id: "review",
			statusKey: "review",
			position: "secondary",
			hideWhenMissing: true,
			excludeFromExtensionStatuses: true,
		},
	]);

	// custom:review already in right → not appended to secondary
	assert.deepEqual(merged.rightSegments, ["custom:review"]);
	assert.deepEqual(merged.secondarySegments, []);
});

test("mergeSegmentsWithCustomItems preserves custom items not in preset", () => {
	const presetDef: PresetDef = {
		leftSegments: ["model"],
		rightSegments: [],
		separator: "powerline",
	};

	const merged = mergeSegmentsWithCustomItems(presetDef, [
		{
			id: "ci",
			statusKey: "ci",
			position: "left",
			hideWhenMissing: true,
			excludeFromExtensionStatuses: true,
		},
		{
			id: "timer",
			statusKey: "timer",
			position: "right",
			hideWhenMissing: true,
			excludeFromExtensionStatuses: true,
		},
		{
			id: "footer",
			statusKey: "footer",
			position: "secondary",
			hideWhenMissing: true,
			excludeFromExtensionStatuses: true,
		},
	]);

	assert.deepEqual(merged.leftSegments, ["model", "custom:ci"]);
	assert.deepEqual(merged.rightSegments, ["custom:timer"]);
	assert.deepEqual(merged.secondarySegments, ["custom:footer"]);
});

// ── nextPowerlineSettingWithPreset preserves presets ──────────────────────

test("nextPowerlineSettingWithPreset preserves presets key", () => {
	const updated = nextPowerlineSettingWithPreset(
		{ preset: "daily", presets: { daily: { extends: "default" } } },
		"default",
	);

	const obj = updated as Record<string, unknown>;
	assert.equal(obj.preset, "default");
	assert.deepEqual(obj.presets, { daily: { extends: "default" } });
});

test("nextPowerlineSettingWithPreset works with string input", () => {
	const updated = nextPowerlineSettingWithPreset("compact", "default");
	assert.equal(updated, "default");
});

// ── parsePowerlineConfig accepts user preset as active preset ────────────

test("parsePowerlineConfig accepts user-defined preset name as active preset", () => {
	const config = parsePowerlineConfig(
		{
			preset: "daily",
			presets: {
				daily: { extends: "default" },
			},
		},
		BUILTIN_NAMES,
	);

	// preset should be "daily" even though it's not a built-in
	assert.equal(config.preset, "daily");
});

test("parsePowerlineConfig falls back to default for unknown preset without user presets", () => {
	const config = parsePowerlineConfig({ preset: "daily" }, BUILTIN_NAMES);
	// No user presets defined → "daily" is unknown → fallback to default
	assert.equal(config.preset, "default");
});
