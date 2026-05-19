/**
 * Prompt history state helpers: snapshot, restore, and track editor prompt history.
 * Uses global symbols to survive extension reloads within the same process.
 */

import { isRecord } from "./stash-helpers.ts";

const PROMPT_HISTORY_TRACKED = Symbol.for(
	"@bumpyclock/pi-statusbar/promptHistoryTracked",
);
const PROMPT_HISTORY_STATE_KEY = Symbol.for(
	"@bumpyclock/pi-statusbar/promptHistoryState",
);

/**
 * Minimal editor shape for prompt history operations.
 *
 * Pi's editor object is untyped from the extension API, so we define the
 * narrow contract we actually use: a `history` array and an `addToHistory`
 * method. `history` is typed as `unknown` because the upstream Editor class
 * declares it `private`; callers must double-cast (e.g. `as unknown as
 * PromptHistoryEditor`). Functions accept `| null | undefined` to stay
 * compatible with callers passing whatever Pi gives.
 */
export interface PromptHistoryEditor {
	history?: unknown;
	addToHistory?: (text: string) => void;
	/** Allow symbol-keyed tracking flag. */
	[key: symbol]: unknown;
}

type PromptHistoryState = { savedPromptHistory: string[] };

function isPromptHistoryState(value: unknown): value is PromptHistoryState {
	return (
		isRecord(value) &&
		Array.isArray(value.savedPromptHistory) &&
		value.savedPromptHistory.every((entry) => typeof entry === "string")
	);
}

function getPromptHistoryState(): PromptHistoryState {
	const existing = Reflect.get(globalThis, PROMPT_HISTORY_STATE_KEY);
	if (isPromptHistoryState(existing)) {
		return existing;
	}

	const state: PromptHistoryState = { savedPromptHistory: [] };
	Reflect.set(globalThis, PROMPT_HISTORY_STATE_KEY, state);
	return state;
}

export function readPromptHistory(
	editor: PromptHistoryEditor | null | undefined,
	limit = 100,
): string[] {
	const maxEntries = Math.max(0, Math.floor(limit));
	if (maxEntries === 0) return [];

	const history = editor?.history;
	if (!Array.isArray(history)) return [];

	const normalized: string[] = [];
	for (const entry of history) {
		if (typeof entry !== "string") continue;
		const trimmed = entry.trim();
		if (!trimmed) continue;
		if (normalized.length > 0 && normalized[normalized.length - 1] === trimmed)
			continue;
		normalized.push(trimmed);
		if (normalized.length >= maxEntries) break;
	}

	return normalized;
}

export function snapshotPromptHistory(
	editor: PromptHistoryEditor | null | undefined,
	limit = 100,
): void {
	const history = readPromptHistory(editor, limit);
	if (history.length > 0) {
		getPromptHistoryState().savedPromptHistory = [...history];
	}
}

export function restorePromptHistory(
	editor: PromptHistoryEditor | null | undefined,
): void {
	const { savedPromptHistory } = getPromptHistoryState();
	if (!savedPromptHistory.length || typeof editor?.addToHistory !== "function")
		return;

	for (let i = savedPromptHistory.length - 1; i >= 0; i--) {
		editor.addToHistory(savedPromptHistory[i]);
	}
}

export function trackPromptHistory(
	editor: PromptHistoryEditor | null | undefined,
	limit = 100,
): void {
	if (!editor || typeof editor.addToHistory !== "function") return;
	if (editor[PROMPT_HISTORY_TRACKED]) {
		snapshotPromptHistory(editor, limit);
		return;
	}

	const originalAddToHistory = editor.addToHistory.bind(editor);
	editor.addToHistory = (text: string) => {
		originalAddToHistory(text);
		snapshotPromptHistory(editor, limit);
	};
	editor[PROMPT_HISTORY_TRACKED] = true;
	snapshotPromptHistory(editor, limit);
}

export function clearSavedPromptHistory(): void {
	getPromptHistoryState().savedPromptHistory = [];
}
