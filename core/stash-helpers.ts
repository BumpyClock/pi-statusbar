/**
 * Pure stash/prompt text helpers extracted from index.ts for testability.
 * No I/O, no side effects — only data normalization.
 */

import { truncateToWidth } from "@earendil-works/pi-tui";

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function hasNonWhitespaceText(text: string): boolean {
	return text.trim().length > 0;
}

export function buildStashPreview(text: string, maxWidth: number): string {
	const compact = text.replace(/\s+/g, " ").trim();
	if (!compact) return "(empty)";
	return truncateToWidth(compact, maxWidth, "…");
}

export function normalizeStashHistoryEntries(
	value: unknown,
	limit: number,
): string[] {
	if (!Array.isArray(value)) {
		return [];
	}

	const history: string[] = [];
	for (const entry of value) {
		if (typeof entry !== "string") {
			continue;
		}

		if (!hasNonWhitespaceText(entry)) {
			continue;
		}

		if (history[history.length - 1] === entry) {
			continue;
		}

		history.push(entry);
		if (history.length >= limit) {
			break;
		}
	}

	return history;
}

export function pushStashHistory(
	history: string[],
	text: string,
	limit: number,
): boolean {
	if (!hasNonWhitespaceText(text)) return false;
	if (history[0] === text) return false;

	history.unshift(text);
	if (history.length > limit) {
		history.length = limit;
	}

	return true;
}

/**
 * Extract displayable text from a user message content value.
 * Handles both plain string content and structured block arrays
 * (e.g. `[{ type: "text", text: "..." }]`).
 */
export function getPromptHistoryText(content: unknown): string {
	if (typeof content === "string") {
		return content.replace(/\s+/g, " ").trim();
	}

	if (!Array.isArray(content)) {
		return "";
	}

	const parts: string[] = [];
	for (const block of content) {
		if (
			!isRecord(block) ||
			block.type !== "text" ||
			typeof block.text !== "string"
		) {
			continue;
		}
		parts.push(block.text);
	}

	return parts.join("\n").replace(/\s+/g, " ").trim();
}
