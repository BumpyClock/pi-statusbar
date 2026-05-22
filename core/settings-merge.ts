/**
 * Pure settings-merge helper extracted from index.ts for testability.
 * Deep-merges two settings objects; nested records are recursively merged,
 * non-record values are overridden by the override layer.
 */

import { isRecord } from "./stash-helpers.ts";

export function mergeSettings(
	base: Record<string, unknown>,
	override: Record<string, unknown>,
): Record<string, unknown> {
	const merged: Record<string, unknown> = { ...base };

	for (const [key, overrideValue] of Object.entries(override)) {
		const baseValue = merged[key];
		merged[key] =
			isRecord(baseValue) && isRecord(overrideValue)
				? mergeSettings(baseValue, overrideValue)
				: overrideValue;
	}

	return merged;
}
