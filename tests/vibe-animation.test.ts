import test from "node:test";
import assert from "node:assert/strict";
import {
	buildShimmer,
	transitionMessages,
	stripAnsiForVibeTest,
	createVibeAnimationController,
	SHIMMER_DEFAULTS,
} from "../vibe-animation.ts";

// ═══════════════════════════════════════════════════════════════════════════
// buildShimmer
// ═══════════════════════════════════════════════════════════════════════════

test("buildShimmer preserves visible text through ANSI codes", () => {
	const text = "Loading data...";
	const result = buildShimmer(text, 3);
	assert.equal(stripAnsiForVibeTest(result), text);
});

test("buildShimmer adds 256-color ANSI codes and resets foreground", () => {
	const result = buildShimmer("hi", 0);
	assert.ok(result.includes("\x1b[38;5;"), "should contain 256-color SGR");
	assert.ok(result.endsWith("\x1b[39m"), "should end with foreground reset");
});

test("buildShimmer returns empty string for empty input", () => {
	assert.equal(buildShimmer("", 0), "");
});

test("buildShimmer skips color codes for space characters", () => {
	const result = buildShimmer("a b", 0);
	assert.equal(stripAnsiForVibeTest(result), "a b");
	// Space must appear raw (not preceded by SGR)
	assert.ok(result.includes(" "), "raw space preserved");
});

test("buildShimmer peak brightness at shimmerHead position", () => {
	const result = buildShimmer("abcde", 2);
	// Char at index 2 should get peak color
	assert.ok(
		result.includes(`\x1b[38;5;${SHIMMER_DEFAULTS.SHIMMER_PEAK}m`),
		"peak level at head",
	);
});

test("buildShimmer base brightness far from shimmerHead", () => {
	// head at 0, char at 20 → well beyond window → base level
	const text = "abcdefghijklmnopqrstu"; // 21 chars
	const result = buildShimmer(text, 0);
	assert.ok(
		result.includes(`\x1b[38;5;${SHIMMER_DEFAULTS.SHIMMER_BASE}m`),
		"base level far from head",
	);
});

test("buildShimmer handles unicode/emoji via Array.from", () => {
	const text = "🚀hi";
	const result = buildShimmer(text, 0);
	assert.equal(stripAnsiForVibeTest(result), text);
});

// ═══════════════════════════════════════════════════════════════════════════
// transitionMessages
// ═══════════════════════════════════════════════════════════════════════════

test("transitionMessages first exit frame shows most of 'from' text", () => {
	const result = transitionMessages("goodbye!", "hello!", 0, 10);
	assert.ok(result.length > 0, "not empty on first frame");
	assert.ok(
		"goodbye!".startsWith(result),
		`should be prefix of 'goodbye!', got '${result}'`,
	);
});

test("transitionMessages last frame shows full 'to' text", () => {
	const result = transitionMessages("goodbye!", "hello!", 9, 10);
	assert.equal(result, "hello!");
});

test("transitionMessages exit phase shrinks from text progressively", () => {
	const from = "abcdefgh"; // 8 chars
	const lengths: number[] = [];
	for (let f = 0; f < 5; f++) {
		lengths.push(transitionMessages(from, "xy", f, 10).length);
	}
	// Each successive exit frame should be <= previous
	for (let i = 1; i < lengths.length; i++) {
		assert.ok(
			lengths[i]! <= lengths[i - 1]!,
			`frame ${i} length ${lengths[i]} should be <= frame ${i - 1} length ${lengths[i - 1]}`,
		);
	}
});

test("transitionMessages enter phase grows to text progressively", () => {
	const to = "newmessage"; // 10 chars
	const lengths: number[] = [];
	// totalFrames=10, exitFrames=5, enter starts at frame 5
	for (let f = 5; f < 10; f++) {
		lengths.push(transitionMessages("old", to, f, 10).length);
	}
	for (let i = 1; i < lengths.length; i++) {
		assert.ok(
			lengths[i]! >= lengths[i - 1]!,
			`enter frame ${i} length ${lengths[i]} should be >= frame ${i - 1} length ${lengths[i - 1]}`,
		);
	}
});

test("transitionMessages uses default totalFrames when omitted", () => {
	// Should not throw; default derived from SHIMMER_DEFAULTS
	const result = transitionMessages("a", "b", 0);
	assert.ok(typeof result === "string");
});

// ═══════════════════════════════════════════════════════════════════════════
// stripAnsiForVibeTest
// ═══════════════════════════════════════════════════════════════════════════

test("stripAnsiForVibeTest removes all ANSI escape sequences", () => {
	const ansi = "\x1b[38;5;244mH\x1b[38;5;255me\x1b[39m";
	assert.equal(stripAnsiForVibeTest(ansi), "He");
});

test("stripAnsiForVibeTest passes through plain text unchanged", () => {
	assert.equal(stripAnsiForVibeTest("hello world"), "hello world");
});

// ═══════════════════════════════════════════════════════════════════════════
// createVibeAnimationController — lifecycle
// ═══════════════════════════════════════════════════════════════════════════

test("controller starts running and renders first frame immediately", () => {
	const calls: (string | undefined)[] = [];
	const ctrl = createVibeAnimationController({
		setWorkingMessage: (msg) => calls.push(msg),
		intervalMs: 999_999, // prevent auto-tick
	});

	ctrl.start("Testing...");
	assert.equal(ctrl.isRunning(), true);
	assert.ok(calls.length >= 1, "should render immediately on start");
	assert.equal(
		stripAnsiForVibeTest(calls[0]!),
		"Testing...",
		"first frame visible text matches",
	);
	ctrl.stop();
});

test("controller stop clears animation and restores default", () => {
	const calls: (string | undefined)[] = [];
	const ctrl = createVibeAnimationController({
		setWorkingMessage: (msg) => calls.push(msg),
		intervalMs: 999_999,
	});

	ctrl.start("Loading...");
	ctrl.stop();
	assert.equal(ctrl.isRunning(), false);
	assert.equal(
		calls[calls.length - 1],
		undefined,
		"stop restores default (undefined)",
	);
});

test("controller stop is idempotent", () => {
	const ctrl = createVibeAnimationController({
		setWorkingMessage: () => {},
		intervalMs: 999_999,
	});

	// Two stops on never-started controller → no throw
	ctrl.stop();
	ctrl.stop();
	assert.equal(ctrl.isRunning(), false);
});

test("controller updateMessage queues transition while running", () => {
	const calls: (string | undefined)[] = [];
	const ctrl = createVibeAnimationController({
		setWorkingMessage: (msg) => calls.push(msg),
		intervalMs: 999_999,
	});

	ctrl.start("First");
	ctrl.updateMessage("Second");
	assert.equal(ctrl.isRunning(), true);
	ctrl.stop();
});

test("controller updateMessage is no-op when not running", () => {
	const calls: (string | undefined)[] = [];
	const ctrl = createVibeAnimationController({
		setWorkingMessage: (msg) => calls.push(msg),
		intervalMs: 999_999,
	});

	ctrl.updateMessage("Ignored");
	assert.equal(calls.length, 0, "no render when not running");
});

test("controller no further updates after stop", async () => {
	const calls: (string | undefined)[] = [];
	const ctrl = createVibeAnimationController({
		setWorkingMessage: (msg) => calls.push(msg),
		intervalMs: 5, // fast ticks
	});

	ctrl.start("Running...");
	ctrl.stop();
	const countAtStop = calls.length;
	// Wait to confirm no more calls fire
	await new Promise((r) => setTimeout(r, 50));
	assert.equal(calls.length, countAtStop, "no calls after stop");
});

test("controller start while running restarts cleanly", () => {
	const calls: (string | undefined)[] = [];
	const ctrl = createVibeAnimationController({
		setWorkingMessage: (msg) => calls.push(msg),
		intervalMs: 999_999,
	});

	ctrl.start("First");
	ctrl.start("Second");
	assert.equal(ctrl.isRunning(), true);
	const lastCall = calls[calls.length - 1]!;
	assert.equal(
		stripAnsiForVibeTest(lastCall),
		"Second",
		"restart shows new message",
	);
	ctrl.stop();
});

// ═══════════════════════════════════════════════════════════════════════════
// SHIMMER_DEFAULTS exports
// ═══════════════════════════════════════════════════════════════════════════

test("SHIMMER_DEFAULTS exports all timing constants", () => {
	assert.equal(typeof SHIMMER_DEFAULTS.SHIMMER_INTERVAL_MS, "number");
	assert.equal(typeof SHIMMER_DEFAULTS.SHIMMER_WINDOW, "number");
	assert.equal(typeof SHIMMER_DEFAULTS.SHIMMER_BASE, "number");
	assert.equal(typeof SHIMMER_DEFAULTS.SHIMMER_PEAK, "number");
	assert.equal(typeof SHIMMER_DEFAULTS.SHIMMER_STEP, "number");
	assert.equal(typeof SHIMMER_DEFAULTS.MESSAGE_HOLD_MS, "number");
	assert.equal(typeof SHIMMER_DEFAULTS.MESSAGE_TRANSITION_MS, "number");
});
