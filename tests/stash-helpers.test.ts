import test from "node:test";
import assert from "node:assert/strict";
import {
	hasNonWhitespaceText,
	buildStashPreview,
	normalizeStashHistoryEntries,
	pushStashHistory,
	getPromptHistoryText,
} from "../core/stash-helpers.ts";

const LIMIT = 12;

// ── hasNonWhitespaceText ─────────────────────────────────────────────────

test("hasNonWhitespaceText returns true for non-empty text", () => {
	assert.equal(hasNonWhitespaceText("hello"), true);
	assert.equal(hasNonWhitespaceText("  hello  "), true);
});

test("hasNonWhitespaceText returns false for whitespace-only", () => {
	assert.equal(hasNonWhitespaceText(""), false);
	assert.equal(hasNonWhitespaceText("   "), false);
	assert.equal(hasNonWhitespaceText("\t\n"), false);
});

// ── buildStashPreview ────────────────────────────────────────────────────

test("buildStashPreview collapses whitespace and trims", () => {
	const preview = buildStashPreview("  hello   world  \n  ", 72);
	assert.equal(preview, "hello world");
});

test("buildStashPreview returns (empty) for blank input", () => {
	assert.equal(buildStashPreview("", 72), "(empty)");
	assert.equal(buildStashPreview("   ", 72), "(empty)");
});

test("buildStashPreview truncates long text", () => {
	const long = "a".repeat(200);
	const preview = buildStashPreview(long, 20);
	// truncateToWidth returns ANSI-wrapped string; check visible width
	assert.ok(preview.includes("…"), "should contain ellipsis");
	assert.ok(preview.length < 200, "should be shorter than input");
});

// ── normalizeStashHistoryEntries ─────────────────────────────────────────

test("normalizeStashHistoryEntries filters non-strings", () => {
	const result = normalizeStashHistoryEntries(["hello", 42, null, "world"], LIMIT);
	assert.deepEqual(result, ["hello", "world"]);
});

test("normalizeStashHistoryEntries skips whitespace-only entries", () => {
	const result = normalizeStashHistoryEntries(["hello", "   ", "\n", "world"], LIMIT);
	assert.deepEqual(result, ["hello", "world"]);
});

test("normalizeStashHistoryEntries dedupes consecutive identical entries", () => {
	const result = normalizeStashHistoryEntries(["a", "a", "b", "b", "a"], LIMIT);
	assert.deepEqual(result, ["a", "b", "a"]);
});

test("normalizeStashHistoryEntries respects limit", () => {
	const entries = Array.from({ length: 20 }, (_, i) => `entry-${i}`);
	const result = normalizeStashHistoryEntries(entries, 5);
	assert.equal(result.length, 5);
	assert.deepEqual(result, ["entry-0", "entry-1", "entry-2", "entry-3", "entry-4"]);
});

test("normalizeStashHistoryEntries rejects non-finite limits", () => {
	assert.deepEqual(normalizeStashHistoryEntries(["a", "b"], Number.NaN), []);
	assert.deepEqual(
		normalizeStashHistoryEntries(["a", "b"], Number.POSITIVE_INFINITY),
		[],
	);
});

test("normalizeStashHistoryEntries returns empty for non-array", () => {
	assert.deepEqual(normalizeStashHistoryEntries(null, LIMIT), []);
	assert.deepEqual(normalizeStashHistoryEntries("not-array", LIMIT), []);
	assert.deepEqual(normalizeStashHistoryEntries(42, LIMIT), []);
	assert.deepEqual(normalizeStashHistoryEntries({}, LIMIT), []);
});

// ── pushStashHistory ─────────────────────────────────────────────────────

test("pushStashHistory prepends text to history", () => {
	const history = ["old"];
	const changed = pushStashHistory(history, "new", LIMIT);
	assert.equal(changed, true);
	assert.deepEqual(history, ["new", "old"]);
});

test("pushStashHistory rejects whitespace-only text", () => {
	const history = ["old"];
	const changed = pushStashHistory(history, "   ", LIMIT);
	assert.equal(changed, false);
	assert.deepEqual(history, ["old"]);
});

test("pushStashHistory rejects duplicate at head", () => {
	const history = ["same", "other"];
	const changed = pushStashHistory(history, "same", LIMIT);
	assert.equal(changed, false);
	assert.deepEqual(history, ["same", "other"]);
});

test("pushStashHistory truncates to limit", () => {
	const history = Array.from({ length: 5 }, (_, i) => `h${i}`);
	pushStashHistory(history, "new", 4);
	assert.equal(history.length, 4);
	assert.equal(history[0], "new");
});

test("pushStashHistory rejects non-finite limits", () => {
	const history = ["old"];
	assert.equal(pushStashHistory(history, "new", Number.NaN), false);
	assert.deepEqual(history, ["old"]);
});

test("pushStashHistory mutates the array in place", () => {
	const history: string[] = [];
	pushStashHistory(history, "first", LIMIT);
	pushStashHistory(history, "second", LIMIT);
	assert.deepEqual(history, ["second", "first"]);
});

// ── getPromptHistoryText ─────────────────────────────────────────────────

test("getPromptHistoryText normalizes plain string content", () => {
	assert.equal(getPromptHistoryText("  hello   world  "), "hello world");
});

test("getPromptHistoryText handles structured content blocks", () => {
	const content = [
		{ type: "text", text: "first part" },
		{ type: "image", url: "..." },
		{ type: "text", text: "second part" },
	];
	assert.equal(getPromptHistoryText(content), "first part second part");
});

test("getPromptHistoryText returns empty for non-string/non-array", () => {
	assert.equal(getPromptHistoryText(null), "");
	assert.equal(getPromptHistoryText(42), "");
	assert.equal(getPromptHistoryText(undefined), "");
	assert.equal(getPromptHistoryText({}), "");
});

test("getPromptHistoryText skips invalid blocks in array", () => {
	const content = [
		null,
		{ type: "text" }, // missing .text
		{ type: "text", text: 42 }, // .text not string
		{ type: "text", text: "valid" },
	];
	assert.equal(getPromptHistoryText(content), "valid");
});

test("getPromptHistoryText collapses whitespace across blocks", () => {
	const content = [
		{ type: "text", text: "  hello  " },
		{ type: "text", text: "  world  " },
	];
	assert.equal(getPromptHistoryText(content), "hello world");
});
