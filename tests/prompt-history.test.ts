import test from "node:test";
import assert from "node:assert/strict";
import {
	PROMPT_HISTORY_STATE_KEY,
	readPromptHistory,
	snapshotPromptHistory,
	restorePromptHistory,
	trackPromptHistory,
	clearSavedPromptHistory,
} from "../core/prompt-history.ts";

function clearGlobalState() {
	Reflect.deleteProperty(globalThis, PROMPT_HISTORY_STATE_KEY);
}

// ── readPromptHistory ────────────────────────────────────────────────────

test("readPromptHistory returns empty for null/undefined editor", () => {
	assert.deepEqual(readPromptHistory(null), []);
	assert.deepEqual(readPromptHistory(undefined), []);
});

test("readPromptHistory returns empty when editor has no history array", () => {
	assert.deepEqual(readPromptHistory({}), []);
	assert.deepEqual(readPromptHistory({ history: "not-array" }), []);
});

test("readPromptHistory normalizes entries: trims, skips empty", () => {
	const editor = { history: ["  hello  ", "world", "", "  ", "foo"] };
	assert.deepEqual(readPromptHistory(editor), ["hello", "world", "foo"]);
});

test("readPromptHistory dedupes consecutive entries", () => {
	const editor = { history: ["a", "a", "b", "b", "a"] };
	assert.deepEqual(readPromptHistory(editor), ["a", "b", "a"]);
});

test("readPromptHistory respects limit", () => {
	const editor = { history: ["a", "b", "c", "d", "e"] };
	assert.deepEqual(readPromptHistory(editor, 3), ["a", "b", "c"]);
});

test("readPromptHistory rejects non-finite limits", () => {
	const editor = { history: ["a", "b", "c"] };
	assert.deepEqual(readPromptHistory(editor, Number.NaN), []);
	assert.deepEqual(readPromptHistory(editor, Number.POSITIVE_INFINITY), []);
});

test("readPromptHistory skips non-string entries", () => {
	const editor = { history: ["a", 42, null, "b"] };
	assert.deepEqual(readPromptHistory(editor), ["a", "b"]);
});

// ── snapshotPromptHistory / restorePromptHistory ─────────────────────────

test("snapshot and restore round-trips prompt history", () => {
	clearGlobalState();

	const editor = {
		history: ["first", "second", "third"],
		addToHistory(text: string) {
			this.history.unshift(text);
		},
	};

	snapshotPromptHistory(editor);

	const newEditor = {
		history: [] as string[],
		addToHistory(text: string) {
			this.history.unshift(text);
		},
	};

	restorePromptHistory(newEditor);
	// Restore adds in reverse order so history order is preserved
	assert.deepEqual(newEditor.history, ["first", "second", "third"]);
});

test("restorePromptHistory is no-op when no saved state", () => {
	clearGlobalState();

	const editor = {
		history: [] as string[],
		addToHistory(text: string) {
			this.history.unshift(text);
		},
	};

	restorePromptHistory(editor);
	assert.deepEqual(editor.history, []);
});

test("restorePromptHistory is no-op when editor has no addToHistory", () => {
	clearGlobalState();

	const editor = { history: ["saved"] };
	snapshotPromptHistory(editor);

	const newEditor = {};
	restorePromptHistory(newEditor); // should not throw
});

test("snapshotPromptHistory clears stale saved state for empty history", () => {
	clearGlobalState();

	snapshotPromptHistory({ history: ["real"] });
	snapshotPromptHistory({ history: [] });

	const newEditor = {
		history: [] as string[],
		addToHistory(text: string) {
			this.history.unshift(text);
		},
	};

	restorePromptHistory(newEditor);
	assert.deepEqual(newEditor.history, []);
});

// ── trackPromptHistory ──────────────────────────────────────────────────

test("trackPromptHistory patches addToHistory to auto-snapshot", () => {
	clearGlobalState();

	const editor = {
		history: ["initial"] as string[],
		addToHistory(text: string) {
			this.history.unshift(text);
		},
	};

	trackPromptHistory(editor);

	// Adding new entry should trigger snapshot
	editor.addToHistory("new-entry");

	const state = Reflect.get(globalThis, PROMPT_HISTORY_STATE_KEY) as any;
	assert.ok(state);
	assert.ok(state.savedPromptHistory.includes("new-entry"));
});

test("trackPromptHistory is no-op for null/undefined editor", () => {
	trackPromptHistory(null);
	trackPromptHistory(undefined);
	// No error thrown
});

test("trackPromptHistory is no-op when editor has no addToHistory", () => {
	trackPromptHistory({});
	trackPromptHistory({ history: ["stuff"] });
	// No error thrown
});

test("trackPromptHistory re-snapshots if already tracked", () => {
	clearGlobalState();

	const editor = {
		history: ["first"] as string[],
		addToHistory(text: string) {
			this.history.unshift(text);
		},
	};

	trackPromptHistory(editor);
	// Manually add without patched fn
	editor.history.unshift("second");
	trackPromptHistory(editor); // should re-snapshot

	const state = Reflect.get(globalThis, PROMPT_HISTORY_STATE_KEY) as any;
	assert.ok(state.savedPromptHistory.includes("second"));
});

test("trackPromptHistory updates the auto-snapshot limit when retracked", () => {
	clearGlobalState();

	const editor = {
		history: ["first", "second", "third"] as string[],
		addToHistory(text: string) {
			this.history.unshift(text);
		},
	};

	trackPromptHistory(editor, 1);
	trackPromptHistory(editor, 3);
	editor.addToHistory("new-entry");

	const state = Reflect.get(globalThis, PROMPT_HISTORY_STATE_KEY) as any;
	assert.deepEqual(state.savedPromptHistory, ["new-entry", "first", "second"]);
});

// ── clearSavedPromptHistory ─────────────────────────────────────────────

test("clearSavedPromptHistory wipes saved state", () => {
	clearGlobalState();

	snapshotPromptHistory({ history: ["saved"] });
	clearSavedPromptHistory();

	const newEditor = {
		history: [] as string[],
		addToHistory(text: string) {
			this.history.unshift(text);
		},
	};

	restorePromptHistory(newEditor);
	assert.deepEqual(newEditor.history, []);
});
