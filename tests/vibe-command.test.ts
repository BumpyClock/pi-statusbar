import test from "node:test";
import assert from "node:assert/strict";
import {
	parseVibeConfig,
	nextStatusbarVibeSetting,
	nextVibeSetting,
	DEFAULT_GENERATED_VIBE_PROMPT,
	type VibeConfig,
} from "../vibe-config.ts";
import { getBuiltinVibePackIds, BUILTIN_VIBE_PACKS } from "../vibe-packs.ts";

// ═══════════════════════════════════════════════════════════════════════════
// nextVibeSetting – mirrors the command update patterns in index.ts
// ═══════════════════════════════════════════════════════════════════════════

// ── /vibe off ─────────────────────────────────────────────────────────────

test("/vibe off: sets enabled false, preserves other config", () => {
	const existing: VibeConfig = {
		enabled: true,
		source: "packs",
		disabledPacks: ["originals"],
		safeMode: false,
		animation: "shimmer",
		generated: { model: "x/y", prompt: "test", refreshInterval: 45 },
	};
	const result = parseVibeConfig(nextVibeSetting(existing, { enabled: false }));
	assert.equal(result.enabled, false);
	assert.equal(result.source, "packs");
	assert.deepEqual(result.disabledPacks, ["originals"]);
	assert.equal(result.safeMode, false);
	assert.equal(result.animation, "shimmer");
	assert.equal(result.generated.model, "x/y");
	assert.equal(result.generated.refreshInterval, 45);
});

// ── /vibe preset whimsical ────────────────────────────────────────────────

test("/vibe preset whimsical: resets to default packs config", () => {
	const existing = parseVibeConfig({
		enabled: false,
		source: "generated",
		disabledPacks: ["originals", "seinfeld"],
		safeMode: false,
		animation: "none",
	});
	const result = parseVibeConfig(
		nextVibeSetting(existing, {
			enabled: true,
			source: "packs",
			disabledPacks: [],
			safeMode: true,
			animation: "shimmer",
		}),
	);
	assert.equal(result.enabled, true);
	assert.equal(result.source, "packs");
	assert.deepEqual(result.disabledPacks, []);
	assert.equal(result.safeMode, true);
	assert.equal(result.animation, "shimmer");
});

// ── /vibe source packs|generated ──────────────────────────────────────────

test("/vibe source packs: enables and sets source", () => {
	const existing = parseVibeConfig({ enabled: false, source: "generated" });
	const result = parseVibeConfig(
		nextVibeSetting(existing, { enabled: true, source: "packs" }),
	);
	assert.equal(result.enabled, true);
	assert.equal(result.source, "packs");
});

test("/vibe source generated: enables and sets source", () => {
	const existing = parseVibeConfig({ enabled: false, source: "packs" });
	const result = parseVibeConfig(
		nextVibeSetting(existing, { enabled: true, source: "generated" }),
	);
	assert.equal(result.enabled, true);
	assert.equal(result.source, "generated");
});

// ── /vibe generate <theme> ────────────────────────────────────────────────

test("/vibe generate theme: sets source generated and bakes theme into prompt", () => {
	const theme = "star trek";
	const existing = parseVibeConfig(undefined);
	const result = parseVibeConfig(
		nextVibeSetting(existing, {
			enabled: true,
			source: "generated",
			generated: {
				prompt: DEFAULT_GENERATED_VIBE_PROMPT.replace(/\{theme\}/g, theme),
			},
		}),
	);
	assert.equal(result.enabled, true);
	assert.equal(result.source, "generated");
	assert.ok(result.generated.prompt.includes('"star trek"'));
	assert.ok(!result.generated.prompt.includes("{theme}"));
	// Model preserved from defaults
	assert.equal(result.generated.model, existing.generated.model);
});

test("/vibe generate re-run with different theme replaces prompt", () => {
	// First run with "coding"
	const first = parseVibeConfig(
		nextVibeSetting(parseVibeConfig(undefined), {
			enabled: true,
			source: "generated",
			generated: {
				prompt: DEFAULT_GENERATED_VIBE_PROMPT.replace(/\{theme\}/g, "coding"),
			},
		}),
	);
	assert.ok(first.generated.prompt.includes('"coding"'));

	// Second run with a different theme replaces the first run's prompt.
	const second = parseVibeConfig(
		nextVibeSetting(first, {
			enabled: true,
			source: "generated",
			generated: {
				prompt: DEFAULT_GENERATED_VIBE_PROMPT.replace(
					/\{theme\}/g,
					"star wars",
				),
			},
		}),
	);
	assert.ok(second.generated.prompt.includes('"star wars"'));
	assert.ok(!second.generated.prompt.includes('"coding"'));
});

// ── /vibe pack disable ────────────────────────────────────────────────────

test("/vibe pack disable: adds pack to disabledPacks", () => {
	const existing = parseVibeConfig({ disabledPacks: ["originals"] });
	const result = parseVibeConfig(
		nextVibeSetting(existing, {
			disabledPacks: [...existing.disabledPacks, "seinfeld"],
		}),
	);
	assert.deepEqual(result.disabledPacks, ["originals", "seinfeld"]);
});

// ── /vibe pack enable ─────────────────────────────────────────────────────

test("/vibe pack enable: removes pack from disabledPacks", () => {
	const existing = parseVibeConfig({
		disabledPacks: ["originals", "seinfeld"],
	});
	const result = parseVibeConfig(
		nextVibeSetting(existing, {
			disabledPacks: existing.disabledPacks.filter((id) => id !== "originals"),
		}),
	);
	assert.deepEqual(result.disabledPacks, ["seinfeld"]);
});

// ── /vibe pack reset ──────────────────────────────────────────────────────

test("/vibe pack reset: clears disabledPacks", () => {
	const existing = parseVibeConfig({
		disabledPacks: ["originals", "seinfeld", "friends"],
	});
	const result = parseVibeConfig(
		nextVibeSetting(existing, { disabledPacks: [] }),
	);
	assert.deepEqual(result.disabledPacks, []);
});

// ── /vibe safe on|off ─────────────────────────────────────────────────────

test("/vibe safe on: sets safeMode true", () => {
	const existing = parseVibeConfig({ safeMode: false });
	const result = parseVibeConfig(nextVibeSetting(existing, { safeMode: true }));
	assert.equal(result.safeMode, true);
});

test("/vibe safe off: sets safeMode false", () => {
	const existing = parseVibeConfig({ safeMode: true });
	const result = parseVibeConfig(
		nextVibeSetting(existing, { safeMode: false }),
	);
	assert.equal(result.safeMode, false);
});

// ── /vibe animation shimmer|none ──────────────────────────────────────────

test("/vibe animation none: sets animation to none", () => {
	const existing = parseVibeConfig({ animation: "shimmer" });
	const result = parseVibeConfig(
		nextVibeSetting(existing, { animation: "none" }),
	);
	assert.equal(result.animation, "none");
});

test("/vibe animation shimmer: sets animation to shimmer", () => {
	const existing = parseVibeConfig({ animation: "none" });
	const result = parseVibeConfig(
		nextVibeSetting(existing, { animation: "shimmer" }),
	);
	assert.equal(result.animation, "shimmer");
});

// ═══════════════════════════════════════════════════════════════════════════
// Source assertions – validate pack IDs are available for commands
// ═══════════════════════════════════════════════════════════════════════════

test("getBuiltinVibePackIds returns non-empty array of string IDs", () => {
	const ids = getBuiltinVibePackIds();
	assert.ok(ids.length > 0, "should have at least one pack");
	for (const id of ids) {
		assert.equal(typeof id, "string");
		assert.ok(id.length > 0);
	}
});

test("every builtin pack has label and messages", () => {
	for (const pack of BUILTIN_VIBE_PACKS) {
		assert.ok(pack.id, `pack missing id`);
		assert.ok(pack.label, `pack ${pack.id} missing label`);
		assert.ok(pack.messages.length > 0, `pack ${pack.id} has no messages`);
	}
});

test("disabling a valid pack ID is idempotent through nextVibeSetting", () => {
	const ids = getBuiltinVibePackIds();
	const packId = ids[0];
	const config = parseVibeConfig(undefined);
	const duplicated = parseVibeConfig(
		nextVibeSetting(config, { disabledPacks: [packId, packId] }),
	);
	assert.deepEqual(duplicated.disabledPacks, [packId]);

	const first = parseVibeConfig(
		nextVibeSetting(config, { disabledPacks: [packId] }),
	);
	const second = parseVibeConfig(
		nextVibeSetting(first, {
			disabledPacks: [...first.disabledPacks, packId],
		}),
	);
	assert.deepEqual(second.disabledPacks, [packId]);
});

// ═══════════════════════════════════════════════════════════════════════════
// statusbar.vibe persistence shape
// ═══════════════════════════════════════════════════════════════════════════

test("nextStatusbarVibeSetting preserves shorthand statusbar preset", () => {
	const next = nextStatusbarVibeSetting(
		"nerd",
		{ safeMode: false },
		parseVibeConfig(undefined),
	);
	assert.equal(next.preset, "nerd");
	assert.equal(parseVibeConfig(next.vibe).safeMode, false);
});

test("nextStatusbarVibeSetting starts from effective vibe when local vibe is absent", () => {
	const effective = parseVibeConfig({
		generated: {
			model: "custom/provider-model",
			prompt: "custom prompt",
			refreshInterval: 9,
		},
	});
	const next = nextStatusbarVibeSetting(
		{ preset: "default" },
		{ safeMode: false },
		effective,
	);
	const vibe = parseVibeConfig(next.vibe);
	assert.equal(vibe.safeMode, false);
	assert.equal(vibe.generated.model, "custom/provider-model");
	assert.equal(vibe.generated.prompt, "custom prompt");
	assert.equal(vibe.generated.refreshInterval, 9);
});
