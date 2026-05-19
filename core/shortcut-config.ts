/**
 * Shortcut configuration: types, defaults, parsing, and conflict resolution.
 * Extracted from index.ts for testability. No I/O beyond console.debug logging.
 */

import { TUI_KEYBINDINGS } from "@earendil-works/pi-tui";

import {
	isSupportedSuperShortcut,
	shortcutConflictKey,
	shortcutUsesSuper,
} from "../shortcuts.ts";
import type { BashModeSettings } from "../bash-mode/types.ts";
import { isRecord } from "./stash-helpers.ts";

export const SHORTCUT_MODIFIER_ORDER = [
	"ctrl",
	"alt",
	"super",
	"shift",
] as const;
export const SHORTCUT_MODIFIERS = new Set<string>(SHORTCUT_MODIFIER_ORDER);

export const SHORTCUT_NAMED_KEYS = new Set([
	"escape",
	"esc",
	"enter",
	"return",
	"tab",
	"space",
	"backspace",
	"delete",
	"insert",
	"clear",
	"home",
	"end",
	"pageup",
	"pagedown",
	"up",
	"down",
	"left",
	"right",
]);

export const SHORTCUT_SYMBOL_KEYS = new Set([
	"`",
	"-",
	"=",
	"[",
	"]",
	"\\",
	";",
	"'",
	",",
	".",
	"/",
	"!",
	"@",
	"#",
	"$",
	"%",
	"^",
	"&",
	"*",
	"(",
	")",
	"_",
	"|",
	"~",
	"{",
	"}",
	":",
	"<",
	">",
	"?",
]);

export function normalizeShortcut(value: string): string {
	const parts = value.trim().toLowerCase().split("+");
	if (parts.length <= 1) return parts[0] ?? "";

	const modifierRank = new Map<string, number>(
		SHORTCUT_MODIFIER_ORDER.map((modifier, index) => [modifier, index]),
	);
	const modifiers = parts
		.slice(0, -1)
		.sort((a, b) => (modifierRank.get(a) ?? 99) - (modifierRank.get(b) ?? 99));
	return [...modifiers, parts[parts.length - 1]].join("+");
}

export function isValidShortcutKeyPart(keyPart: string): boolean {
	const lowerKeyPart = keyPart.toLowerCase();

	if (/^[a-z0-9]$/i.test(keyPart)) return true;
	if (/^f([1-9]|1[0-2])$/i.test(keyPart)) return true;
	if (SHORTCUT_NAMED_KEYS.has(lowerKeyPart)) return true;

	return SHORTCUT_SYMBOL_KEYS.has(keyPart);
}

/**
 * Parse and validate a user-provided shortcut override string.
 * Returns normalized shortcut string or null if invalid.
 *
 * Handles:
 * - Modifier normalization (`cmd`/`command` → `super`)
 * - Modifier deduplication check
 * - Key part validation (alphanumeric, function keys, named keys, symbols)
 * - Super shortcut support check (only specific super combos are mappable)
 */
export function parseShortcutOverride(value: unknown): string | null {
	if (typeof value !== "string") {
		return null;
	}

	const trimmed = value.trim();
	if (!trimmed || /\s/.test(trimmed)) {
		return null;
	}

	const parts = trimmed.split("+");
	if (parts.some((part) => part.length === 0)) {
		return null;
	}

	const modifierParts = parts.slice(0, -1).map((part) => {
		const modifier = part.toLowerCase();
		return modifier === "cmd" || modifier === "command" ? "super" : modifier;
	});
	if (new Set(modifierParts).size !== modifierParts.length) {
		return null;
	}

	for (const modifier of modifierParts) {
		if (!SHORTCUT_MODIFIERS.has(modifier)) {
			return null;
		}
	}

	const keyPart = parts[parts.length - 1];
	if (!isValidShortcutKeyPart(keyPart)) {
		return null;
	}

	const normalizedKey = SHORTCUT_SYMBOL_KEYS.has(keyPart)
		? keyPart
		: keyPart.toLowerCase();
	const normalizedShortcut = normalizeShortcut(
		[...modifierParts, normalizedKey].join("+"),
	);
	if (
		shortcutUsesSuper(normalizedShortcut) &&
		!isSupportedSuperShortcut(normalizedShortcut)
	) {
		return null;
	}

	return normalizedShortcut;
}

export function shortcutUsageKey(shortcut: string): string {
	return shortcutConflictKey(normalizeShortcut(shortcut));
}

// ═══════════════════════════════════════════════════════════════════════════
// Statusbar shortcut types and defaults
// ═══════════════════════════════════════════════════════════════════════════

export interface StatusbarShortcuts {
	stashHistory: string;
	copyEditor: string;
	cutEditor: string;
	jumpPreviousUserMessage: string;
	jumpNextUserMessage: string;
	jumpPreviousLlmMessage: string;
	jumpNextLlmMessage: string;
	jumpChatBottom: string;
	scrollChatUp: string;
	scrollChatDown: string;
	editorStart: string;
	editorEnd: string;
}

export type StatusbarShortcutKey = keyof StatusbarShortcuts;
export type ChatJumpShortcutKey = Extract<
	StatusbarShortcutKey,
	| "jumpPreviousUserMessage"
	| "jumpNextUserMessage"
	| "jumpPreviousLlmMessage"
	| "jumpNextLlmMessage"
	| "jumpChatBottom"
>;
export type ChatJumpRole = "user" | "assistant";
export type ChatJumpDirection = "previous" | "next";
export type ChatJumpShortcutAction =
	| { kind: "message"; role: ChatJumpRole; direction: ChatJumpDirection }
	| { kind: "bottom" };
export type StatusbarShortcutAction =
	| { kind: "stashHistory" }
	| { kind: "copyEditor" }
	| { kind: "cutEditor" }
	| { kind: "bashMode" }
	| { kind: "chat"; action: ChatJumpShortcutAction };

export const DEFAULT_SHORTCUTS: StatusbarShortcuts = {
	stashHistory: "ctrl+alt+h",
	copyEditor: "ctrl+alt+c",
	cutEditor: "ctrl+alt+x",
	jumpPreviousUserMessage: "ctrl+shift+u",
	jumpNextUserMessage: "ctrl+shift+i",
	jumpPreviousLlmMessage: "ctrl+alt+,",
	jumpNextLlmMessage: "ctrl+alt+.",
	jumpChatBottom: "ctrl+shift+g",
	scrollChatUp: "super+up",
	scrollChatDown: "super+down",
	editorStart: "super+shift+up",
	editorEnd: "super+shift+down",
};

const DEFAULT_BASH_MODE_SETTINGS: BashModeSettings = {
	toggleShortcut: "ctrl+shift+b",
	transcriptMaxLines: 2000,
	transcriptMaxBytes: 512 * 1024,
};

export const CHAT_JUMP_SHORTCUTS: Array<{
	shortcutKey: ChatJumpShortcutKey;
	description: string;
	action: ChatJumpShortcutAction;
}> = [
	{
		shortcutKey: "jumpPreviousUserMessage",
		description: "Jump to previous user message",
		action: { kind: "message", role: "user", direction: "previous" },
	},
	{
		shortcutKey: "jumpNextUserMessage",
		description: "Jump to next user message",
		action: { kind: "message", role: "user", direction: "next" },
	},
	{
		shortcutKey: "jumpPreviousLlmMessage",
		description: "Jump to previous LLM message",
		action: { kind: "message", role: "assistant", direction: "previous" },
	},
	{
		shortcutKey: "jumpNextLlmMessage",
		description: "Jump to next LLM message",
		action: { kind: "message", role: "assistant", direction: "next" },
	},
	{
		shortcutKey: "jumpChatBottom",
		description: "Jump chat to bottom",
		action: { kind: "bottom" },
	},
];

const SHORTCUT_KEYS: StatusbarShortcutKey[] = [
	"stashHistory",
	"copyEditor",
	"cutEditor",
	"jumpPreviousUserMessage",
	"jumpNextUserMessage",
	"jumpPreviousLlmMessage",
	"jumpNextLlmMessage",
	"jumpChatBottom",
	"scrollChatUp",
	"scrollChatDown",
	"editorStart",
	"editorEnd",
];

// ═══════════════════════════════════════════════════════════════════════════
// Reserved shortcuts and conflict resolution
// ═══════════════════════════════════════════════════════════════════════════

const APP_RESERVED_SHORTCUTS = [
	"escape",
	"ctrl+c",
	"ctrl+d",
	"ctrl+z",
	"shift+tab",
	"ctrl+p",
	"shift+ctrl+p",
	"ctrl+l",
	"ctrl+o",
	"shift+ctrl+o",
	"ctrl+t",
	"ctrl+n",
	"ctrl+g",
	"alt+enter",
	"alt+up",
	"alt+down",
	"ctrl+v",
	"alt+v",
	"shift+l",
	"shift+t",
	"ctrl+s",
	"ctrl+r",
	"ctrl+backspace",
	"ctrl+a",
	"ctrl+x",
	"ctrl+u",
] as const;

const EXTRA_RESERVED_SHORTCUTS = ["alt+s"] as const;

function reservedShortcuts(): Set<string> {
	const shortcuts = new Set<string>(
		[...EXTRA_RESERVED_SHORTCUTS, ...APP_RESERVED_SHORTCUTS].map(
			normalizeShortcut,
		),
	);

	for (const definition of Object.values(TUI_KEYBINDINGS)) {
		const defaultKeys = definition.defaultKeys;
		const keys =
			defaultKeys === undefined
				? []
				: Array.isArray(defaultKeys)
					? defaultKeys
					: [defaultKeys];
		for (const key of keys) {
			shortcuts.add(normalizeShortcut(key));
		}
	}

	return shortcuts;
}

function findShortcutReplacement(
	key: StatusbarShortcutKey,
	used: Set<string>,
): string | null {
	const preferred = DEFAULT_SHORTCUTS[key];
	if (!used.has(shortcutUsageKey(preferred))) {
		return preferred;
	}

	for (const shortcutKey of SHORTCUT_KEYS) {
		const candidate = DEFAULT_SHORTCUTS[shortcutKey];
		if (!used.has(shortcutUsageKey(candidate))) {
			return candidate;
		}
	}

	return null;
}

export function resolveShortcutConfig(
	settings: Record<string, unknown>,
): StatusbarShortcuts {
	const resolved: StatusbarShortcuts = { ...DEFAULT_SHORTCUTS };
	const shortcutSettings = settings.statusbarShortcuts;

	if (isRecord(shortcutSettings)) {
		for (const key of SHORTCUT_KEYS) {
			const override = parseShortcutOverride(shortcutSettings[key]);
			if (override) {
				resolved[key] = override;
			}
		}
	}

	const used = new Set(Array.from(reservedShortcuts(), shortcutUsageKey));

	for (const key of SHORTCUT_KEYS) {
		const configured = resolved[key];
		const configuredUsageKey = shortcutUsageKey(configured);

		if (!used.has(configuredUsageKey)) {
			used.add(configuredUsageKey);
			continue;
		}

		const replacement = findShortcutReplacement(key, used);
		if (!replacement) {
			console.debug(
				`[pi-statusbar] Shortcut conflict for ${key}: "${configured}" is already in use`,
			);
			continue;
		}

		console.debug(
			`[pi-statusbar] Shortcut conflict for ${key}: "${configured}" replaced with "${replacement}"`,
		);

		resolved[key] = replacement;
		used.add(shortcutUsageKey(replacement));
	}

	return resolved;
}

export function parseBashModeSettings(
	settings: Record<string, unknown>,
): BashModeSettings {
	const raw = isRecord(settings.bashMode) ? settings.bashMode : {};

	const configuredToggleShortcut = parseShortcutOverride(raw.toggleShortcut);
	const toggleShortcut =
		configuredToggleShortcut &&
		!reservedShortcuts().has(shortcutUsageKey(configuredToggleShortcut))
			? configuredToggleShortcut
			: DEFAULT_BASH_MODE_SETTINGS.toggleShortcut;

	if (configuredToggleShortcut && toggleShortcut !== configuredToggleShortcut) {
		console.debug(
			`[pi-statusbar] Bash mode shortcut conflict: "${configuredToggleShortcut}" replaced with "${toggleShortcut}"`,
		);
	}
	const transcriptMaxLines =
		typeof raw.transcriptMaxLines === "number" &&
		Number.isFinite(raw.transcriptMaxLines)
			? Math.max(100, Math.floor(raw.transcriptMaxLines))
			: DEFAULT_BASH_MODE_SETTINGS.transcriptMaxLines;
	const transcriptMaxBytes =
		typeof raw.transcriptMaxBytes === "number" &&
		Number.isFinite(raw.transcriptMaxBytes)
			? Math.max(16 * 1024, Math.floor(raw.transcriptMaxBytes))
			: DEFAULT_BASH_MODE_SETTINGS.transcriptMaxBytes;

	return {
		toggleShortcut,
		transcriptMaxLines,
		transcriptMaxBytes,
	};
}
