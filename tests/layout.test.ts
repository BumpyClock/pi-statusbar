import test from "node:test";
import assert from "node:assert/strict";
import { visibleWidth } from "@earendil-works/pi-tui";
import {
	computeResponsiveLayout,
	buildContentFromParts,
} from "../statusbar/layout.ts";
import type {
	PresetDef,
	SegmentContext,
	CustomStatusItem,
} from "../types.ts";
import { getDefaultColors } from "../theme.ts";

// ─── helpers ──────────────────────────────────────────────────────────────

/** Minimal stub theme that passes through text unchanged */
const stubTheme = { fg: (_color: string, text: string) => text };

function makeContext(
	overrides: Partial<SegmentContext> = {},
): SegmentContext {
	return {
		model: { id: "test-model", name: "Test", contextWindow: 200000 },
		thinkingLevel: "off",
		sessionId: "test-session",
		cwd: "/tmp/test",
		usageStats: { input: 1000, output: 500, cacheRead: 0, cacheWrite: 0, cost: 0.01 },
		contextPercent: 12,
		contextWindow: 200000,
		autoCompactEnabled: true,
		customCompactionEnabled: false,
		usingSubscription: false,
		sessionStartTime: Date.now(),
		shellModeActive: false,
		shellRunning: false,
		shellName: null,
		shellCwd: null,
		git: { branch: "main", staged: 0, unstaged: 0, untracked: 0 },
		extensionStatuses: new Map(),
		hiddenExtensionStatusKeys: new Set(),
		customItemsById: new Map(),
		options: {},
		theme: stubTheme,
		colors: getDefaultColors(),
		...overrides,
	};
}

/**
 * Very simple preset with few segments so we can reason about widths.
 * "path" renders as ~basename of cwd, "git" as branch name + status.
 */
const tinyPreset: PresetDef = {
	leftSegments: ["path"],
	rightSegments: ["git"],
	secondarySegments: ["context_pct"],
	separator: "ascii",
};

// ─── buildContentFromParts ───────────────────────────────────────────────

test("buildContentFromParts returns empty string for empty parts", () => {
	assert.equal(buildContentFromParts([], tinyPreset), "");
});

test("buildContentFromParts wraps single part with spaces", () => {
	const result = buildContentFromParts(["hello"], tinyPreset);
	// Should have leading space, content, trailing space (after ansi reset)
	assert.ok(result.includes("hello"));
	assert.ok(result.startsWith(" "));
});

test("buildContentFromParts joins multiple parts with separator", () => {
	const result = buildContentFromParts(["aaa", "bbb"], tinyPreset);
	assert.ok(result.includes("aaa"));
	assert.ok(result.includes("bbb"));
	// ascii separator is ">"
	assert.ok(result.includes(">"), "expected ascii separator in output");
});

// ─── computeResponsiveLayout: overflow behavior ─────────────────────────

test("computeResponsiveLayout fits all segments on wide terminal", () => {
	const ctx = makeContext();
	const layout = computeResponsiveLayout(ctx, tinyPreset, 200, []);

	// Wide enough → everything in top, nothing in secondary
	assert.ok(layout.topContent.length > 0, "topContent should have content");
	assert.equal(layout.secondaryContent, "", "secondaryContent should be empty when wide enough");
});

test("computeResponsiveLayout overflows to secondary row on narrow terminal", () => {
	const ctx = makeContext();

	// Render at full width first to measure total content width
	const wide = computeResponsiveLayout(ctx, tinyPreset, 300, []);
	const fullWidth = visibleWidth(wide.topContent);

	// Now use width smaller than the total → should force overflow
	const narrow = computeResponsiveLayout(ctx, tinyPreset, Math.max(10, fullWidth - 5), []);

	assert.ok(narrow.topContent.length > 0, "still has top content");
	assert.ok(narrow.secondaryContent.length > 0, "overflow produced secondary content");
});

test("computeResponsiveLayout returns empty when no segments are visible", () => {
	const ctx = makeContext({ model: undefined, cwd: undefined });

	// Preset with only segments that need model/cwd to render
	const emptyPreset: PresetDef = {
		leftSegments: [],
		rightSegments: [],
		separator: "ascii",
	};

	const layout = computeResponsiveLayout(ctx, emptyPreset, 80, []);
	assert.equal(layout.topContent, "");
	assert.equal(layout.secondaryContent, "");
});

// ─── computeResponsiveLayout: custom item merge ─────────────────────────

test("computeResponsiveLayout includes custom items from customItems param", () => {
	const customItems: CustomStatusItem[] = [
		{
			id: "ci",
			statusKey: "ci-status",
			position: "right",
			hideWhenMissing: false,
			excludeFromExtensionStatuses: true,
		},
	];

	const ctx = makeContext({
		extensionStatuses: new Map([["ci-status", "passing"]]),
		customItemsById: new Map([["ci", customItems[0]]]),
	});

	const layout = computeResponsiveLayout(ctx, tinyPreset, 200, customItems);

	// "passing" should appear somewhere in the output since hideWhenMissing=false
	// and we provided the status value
	const combined = layout.topContent + layout.secondaryContent;
	assert.ok(combined.includes("passing"), "custom item value should appear in layout");
});

test("computeResponsiveLayout does not use stale customItems when empty array passed", () => {
	const customItems: CustomStatusItem[] = [
		{
			id: "ci",
			statusKey: "ci-status",
			position: "secondary",
			hideWhenMissing: false,
			excludeFromExtensionStatuses: true,
		},
	];

	const ctx = makeContext({
		extensionStatuses: new Map([["ci-status", "passing"]]),
		customItemsById: new Map([["ci", customItems[0]]]),
	});

	// Pass items → should see custom segment
	const withItems = computeResponsiveLayout(ctx, tinyPreset, 200, customItems);
	// Pass empty → custom segment gone
	const withoutItems = computeResponsiveLayout(ctx, tinyPreset, 200, []);

	const combinedWith = withItems.topContent + withItems.secondaryContent;
	const combinedWithout = withoutItems.topContent + withoutItems.secondaryContent;

	assert.ok(combinedWith.includes("passing"), "custom item visible when passed");
	// Without custom items, the "passing" value from extension statuses might still show
	// via the extension_statuses segment, but the custom:ci segment should NOT be there.
	// We can verify by checking that the layout differs.
	assert.notEqual(combinedWith, combinedWithout, "layout should differ with/without custom items");
});
