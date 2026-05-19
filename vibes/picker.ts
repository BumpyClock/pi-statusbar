/**
 * @module vibe-picker
 *
 * Pack filtering, safe-mode detection, and random message picker.
 *
 * The picker is **per-invocation** — each call to {@link createVibePicker} builds a
 * fresh `VibePicker` instance with its own “last pick” state so consecutive
 * calls avoid immediate repeats when ≥2 candidates exist.
 */

import { UNSAFE_RE, type VibePack, type VibeMessage } from "./packs.ts";

// ── Types ─────────────────────────────────────────────────────────────────

/** Options for filtering packs: which packs to exclude and whether safe-mode is on. */
export interface PackFilterOptions {
	disabledPacks: string[];
	safeMode: boolean;
}

// ── Unsafe detection ──────────────────────────────────────────────────────

/**
 * Two-layer unsafe check:
 * 1. Explicit `"unsafe"` tag (applied at pack definition time).
 * 2. Runtime regex match via the shared {@link UNSAFE_RE}.
 *
 * The regex layer catches anything the static tagger missed.
 */
export function isUnsafeMessage(message: VibeMessage): boolean {
	if (message.tags?.includes("unsafe")) return true;
	return UNSAFE_RE.test(message.text);
}

// ── Pack filter ───────────────────────────────────────────────────────────

/**
 * Flat list of allowed messages from enabled packs.
 * - Packs whose ID is in `disabledPacks` are excluded entirely.
 * - When `safeMode` is true, unsafe messages (tagged or regex-detected) are excluded.
 * Returns one entry per message → equal selection chance regardless of pack size.
 */
export function getAllowedPackMessages(
	packs: readonly VibePack[],
	options: PackFilterOptions,
): VibeMessage[] {
	const disabled = new Set(options.disabledPacks);

	const result: VibeMessage[] = [];
	for (const pack of packs) {
		if (disabled.has(pack.id)) continue;
		for (const msg of pack.messages) {
			if (options.safeMode && isUnsafeMessage(msg)) continue;
			result.push(msg);
		}
	}
	return result;
}

// ── Picker ────────────────────────────────────────────────────────────────

export interface VibePicker {
	/** Pick next message text. Returns undefined when pool is empty. */
	next(): string | undefined;
	/** Replace message pool and clear last-pick state. */
	reset(messages: readonly VibeMessage[]): void;
}

/**
 * Creates a stateful picker that selects randomly from the message pool.
 * - Avoids immediate repeat when ≥2 candidates exist.
 * - `random` defaults to `Math.random`; inject for deterministic tests.
 */
export function createVibePicker(
	messages: readonly VibeMessage[],
	random: () => number = Math.random,
): VibePicker {
	let pool = [...messages];
	let last: string | undefined;

	function next(): string | undefined {
		if (pool.length === 0) return undefined;
		if (pool.length === 1) {
			last = pool[0].text;
			return last;
		}

		// Build candidates excluding last pick to avoid immediate repeat
		const candidates =
			last !== undefined ? pool.filter((m) => m.text !== last) : pool;

		// Fallback: if filter removed everything (shouldn't happen with ≥2 unique),
		// use full pool
		const source = candidates.length > 0 ? candidates : pool;
		const idx = Math.floor(random() * source.length);
		last = source[idx].text;
		return last;
	}

	function reset(newMessages: readonly VibeMessage[]): void {
		pool = [...newMessages];
		last = undefined;
	}

	return { next, reset };
}
