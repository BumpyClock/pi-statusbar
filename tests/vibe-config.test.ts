import test from "node:test";
import assert from "node:assert/strict";
import {
	parseVibeConfig,
	DEFAULT_GENERATED_VIBE_PROMPT,
} from "../vibe-config.ts";

// ── Defaults ──────────────────────────────────────────────────────────────

test("parseVibeConfig returns correct defaults for undefined input", () => {
	const config = parseVibeConfig(undefined);
	assert.equal(config.enabled, true);
	assert.equal(config.source, "packs");
	assert.deepEqual(config.disabledPacks, []);
	assert.equal(config.safeMode, true);
	assert.equal(config.animation, "shimmer");
	assert.equal(config.generated.model, "openai-codex/gpt-5.4-mini");
	assert.equal(config.generated.prompt, DEFAULT_GENERATED_VIBE_PROMPT);
	assert.equal(config.generated.refreshInterval, 30);
});

test("parseVibeConfig returns correct defaults for null input", () => {
	const config = parseVibeConfig(null);
	assert.equal(config.enabled, true);
	assert.equal(config.source, "packs");
});

test("parseVibeConfig returns correct defaults for empty object", () => {
	const config = parseVibeConfig({});
	assert.equal(config.enabled, true);
	assert.equal(config.source, "packs");
	assert.deepEqual(config.disabledPacks, []);
	assert.equal(config.safeMode, true);
	assert.equal(config.animation, "shimmer");
});

// ── Nested parse ──────────────────────────────────────────────────────────

test("parseVibeConfig parses valid nested config", () => {
	const config = parseVibeConfig({
		enabled: false,
		source: "generated",
		disabledPacks: ["retro"],
		safeMode: false,
		animation: "none",
		generated: {
			model: "anthropic/claude-sonnet-4-6",
			prompt: "custom prompt {theme} {task}",
			refreshInterval: 12,
		},
	});
	assert.equal(config.enabled, false);
	assert.equal(config.source, "generated");
	assert.deepEqual(config.disabledPacks, ["retro"]);
	assert.equal(config.safeMode, false);
	assert.equal(config.animation, "none");
	assert.equal(config.generated.model, "anthropic/claude-sonnet-4-6");
	assert.equal(config.generated.prompt, "custom prompt {theme} {task}");
	assert.equal(config.generated.refreshInterval, 12);
});

test("parseVibeConfig parses partial nested config with defaults for missing", () => {
	const config = parseVibeConfig({
		source: "generated",
	});
	assert.equal(config.enabled, true);
	assert.equal(config.source, "generated");
	assert.deepEqual(config.disabledPacks, []);
	assert.equal(config.safeMode, true);
	assert.equal(config.animation, "shimmer");
	assert.equal(config.generated.model, "openai-codex/gpt-5.4-mini");
});

// ── Legacy top-level ignored ──────────────────────────────────────────────

test("parseVibeConfig ignores legacy top-level workingVibe keys", () => {
	const config = parseVibeConfig({
		workingVibeTheme: "star trek",
		workingVibeMode: "generate",
		workingVibeModel: "some-model",
	});
	// Should return defaults, not pick up legacy keys
	assert.equal(config.enabled, true);
	assert.equal(config.source, "packs");
	assert.equal(config.generated.model, "openai-codex/gpt-5.4-mini");
});

// ── Invalid normalization ─────────────────────────────────────────────────

test("parseVibeConfig normalizes invalid source to 'packs'", () => {
	const config = parseVibeConfig({ source: "banana" });
	assert.equal(config.source, "packs");
});

test("parseVibeConfig normalizes invalid animation to 'shimmer'", () => {
	const config = parseVibeConfig({ animation: "bounce" });
	assert.equal(config.animation, "shimmer");
});

test("parseVibeConfig normalizes non-boolean safeMode to true", () => {
	const config = parseVibeConfig({ safeMode: "nope" });
	assert.equal(config.safeMode, true);
});

test("parseVibeConfig normalizes non-boolean enabled to true", () => {
	const config = parseVibeConfig({ enabled: "yes" });
	assert.equal(config.enabled, true);
});

test("parseVibeConfig filters non-string entries from disabledPacks", () => {
	const config = parseVibeConfig({ disabledPacks: ["retro", 42, null, "zen"] });
	assert.deepEqual(config.disabledPacks, ["retro", "zen"]);
});

test("parseVibeConfig normalizes non-array disabledPacks to empty array", () => {
	const config = parseVibeConfig({ disabledPacks: "retro" });
	assert.deepEqual(config.disabledPacks, []);
});

test("parseVibeConfig normalizes non-string generated.model to default", () => {
	const config = parseVibeConfig({ generated: { model: 123 } });
	assert.equal(config.generated.model, "openai-codex/gpt-5.4-mini");
});

test("parseVibeConfig normalizes empty generated.model to default", () => {
	const config = parseVibeConfig({ generated: { model: "" } });
	assert.equal(config.generated.model, "openai-codex/gpt-5.4-mini");
});

test("parseVibeConfig normalizes non-string generated.prompt to default", () => {
	const config = parseVibeConfig({ generated: { prompt: false } });
	assert.equal(config.generated.prompt, DEFAULT_GENERATED_VIBE_PROMPT);
});

test("parseVibeConfig parses generated.refreshInterval seconds", () => {
	const config = parseVibeConfig({ generated: { refreshInterval: 7 } });
	assert.equal(config.generated.refreshInterval, 7);
});

test("parseVibeConfig normalizes invalid generated.refreshInterval to default", () => {
	const config = parseVibeConfig({ generated: { refreshInterval: -1 } });
	assert.equal(config.generated.refreshInterval, 30);
});

test("parseVibeConfig normalizes zero generated.refreshInterval to default", () => {
	const config = parseVibeConfig({ generated: { refreshInterval: 0 } });
	assert.equal(config.generated.refreshInterval, 30);
});

// ── enabled: false parsing ────────────────────────────────────────────────

test("parseVibeConfig preserves other settings when enabled is false", () => {
	const config = parseVibeConfig({
		enabled: false,
		source: "generated",
		animation: "none",
		safeMode: false,
		generated: { model: "custom/model" },
	});
	assert.equal(config.enabled, false);
	assert.equal(config.source, "generated");
	assert.equal(config.animation, "none");
	assert.equal(config.safeMode, false);
	assert.equal(config.generated.model, "custom/model");
});

// ── DEFAULT_GENERATED_VIBE_PROMPT ─────────────────────────────────────────

test("DEFAULT_GENERATED_VIBE_PROMPT is a non-empty string", () => {
	assert.equal(typeof DEFAULT_GENERATED_VIBE_PROMPT, "string");
	assert.ok(DEFAULT_GENERATED_VIBE_PROMPT.length > 0);
});
