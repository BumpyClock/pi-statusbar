import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { KEYBINDINGS } from "../node_modules/@earendil-works/pi-coding-agent/dist/core/keybindings.js";
import {
	isSupportedSuperShortcut,
	matchesConfiguredShortcut,
	shortcutConflictKey,
} from "../shortcuts.ts";

const source = readFileSync(new URL("../index.ts", import.meta.url), "utf-8");

const statusbarShortcutKeys = new Set([
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
]);

function normalizeShortcut(shortcut: string): string {
	const parts = shortcut.trim().toLowerCase().split("+");
	if (parts.length <= 1) return parts[0] ?? "";

	const modifierRank = new Map(
		["ctrl", "alt", "super", "shift"].map((modifier, index) => [
			modifier,
			index,
		]),
	);
	return [
		...parts
			.slice(0, -1)
			.sort(
				(a, b) => (modifierRank.get(a) ?? 99) - (modifierRank.get(b) ?? 99),
			),
		parts[parts.length - 1],
	].join("+");
}

function statusbarDefaults(): Map<string, string> {
	const defaults = new Map<string, string>();
	for (const match of source.matchAll(/^\s+([a-zA-Z0-9]+): "([^"]+)",?$/gm)) {
		const key = match[1];
		const value = match[2];
		if (key && value && statusbarShortcutKeys.has(key)) {
			defaults.set(key, value);
		}
	}
	return defaults;
}

test("chat jump shortcuts are configurable and route through fixed editor scrolling", () => {
	const defaults = statusbarDefaults();
	assert.equal(defaults.get("jumpPreviousUserMessage"), "ctrl+shift+u");
	assert.equal(defaults.get("jumpNextUserMessage"), "ctrl+shift+i");
	assert.equal(defaults.get("jumpPreviousLlmMessage"), "ctrl+alt+,");
	assert.equal(defaults.get("jumpNextLlmMessage"), "ctrl+alt+.");
	assert.equal(defaults.get("jumpChatBottom"), "ctrl+shift+g");
	assert.equal(defaults.get("scrollChatUp"), "super+up");
	assert.equal(defaults.get("scrollChatDown"), "super+down");
	assert.equal(defaults.get("editorStart"), "super+shift+up");
	assert.equal(defaults.get("editorEnd"), "super+shift+down");
	assert.match(source, /const CHAT_JUMP_SHORTCUTS:/);
	assert.match(source, /shortcutKey: "jumpPreviousUserMessage"/);
	assert.match(source, /shortcutKey: "jumpNextUserMessage"/);
	assert.match(source, /shortcutKey: "jumpPreviousLlmMessage"/);
	assert.match(source, /shortcutKey: "jumpNextLlmMessage"/);
	assert.match(source, /shortcutKey: "jumpChatBottom"/);
	assert.match(
		source,
		/pi\.registerShortcut\(resolvedShortcuts\[shortcutKey\]/,
	);
	assert.match(
		source,
		/function collectChatMessageStartLines\(role: ChatJumpRole\): number\[\]/,
	);
	assert.match(source, /componentName === "UserMessageComponent"/);
	assert.match(source, /componentName === "SkillInvocationMessageComponent"/);
	assert.match(source, /componentName === "AssistantMessageComponent"/);
	assert.match(
		source,
		/fixedEditorCompositor\.jumpToPreviousRootTarget\(targets\)/,
	);
	assert.match(
		source,
		/fixedEditorCompositor\.jumpToNextRootTarget\(targets\)/,
	);
	assert.match(source, /fixedEditorCompositor\.jumpToRootBottom\(\)/);
	assert.match(
		source,
		/function getChatJumpShortcutAction\(\s*data: string,?\s*\): ChatJumpShortcutAction \| null/,
	);
	assert.match(
		source,
		/let resolvedShortcuts = resolveShortcutConfig\(startupSettings\)/,
	);
	assert.match(source, /resolvedShortcuts = resolveShortcutConfig\(settings\)/);
	assert.match(
		source,
		/keyboardScrollShortcuts: \{\n\s+up: resolvedShortcuts\.scrollChatUp,\n\s+down: resolvedShortcuts\.scrollChatDown,/,
	);
	assert.match(
		source,
		/editorBoundaryShortcuts: \{\n\s+start: resolvedShortcuts\.editorStart,\n\s+end: resolvedShortcuts\.editorEnd,/,
	);
	assert.match(
		source,
		/modifier === "cmd" \|\| modifier === "command" \? "super" : modifier/,
	);
	assert.match(
		source,
		/shortcutUsesSuper\(normalizedShortcut\) &&\s*!isSupportedSuperShortcut\(normalizedShortcut\)/,
	);
	assert.match(
		source,
		/jumpToChatMessage\(ctx, action\.action\.role, action\.action\.direction\)/,
	);
});

test("super shortcut matching rejects plain keys and unsupported command aliases", () => {
	assert.equal(matchesConfiguredShortcut("c", "super+c"), false);
	assert.equal(matchesConfiguredShortcut("X", "super+shift+x"), false);
	assert.equal(matchesConfiguredShortcut("\x1b[A", "super+up"), false);
	assert.equal(matchesConfiguredShortcut("\x1b[1;9A", "super+up"), true);
	assert.equal(matchesConfiguredShortcut("\x1b[1;10A", "super+shift+up"), true);
	assert.equal(matchesConfiguredShortcut("\x1b[122;9u", "super+z"), false);
	assert.equal(isSupportedSuperShortcut("super+c"), false);
	assert.equal(isSupportedSuperShortcut("super+shift+x"), false);
	assert.equal(isSupportedSuperShortcut("super+z"), false);
	assert.equal(isSupportedSuperShortcut("super+up"), true);
	assert.equal(shortcutConflictKey("super+home"), "super+up");
	assert.equal(shortcutConflictKey("super+end"), "super+down");
	assert.equal(shortcutConflictKey("super+shift+home"), "super+shift+up");
	assert.equal(shortcutConflictKey("super+shift+end"), "super+shift+down");
});

test("editor submits follow the fixed chat viewport to bottom", () => {
	assert.match(source, /function followSubmittedEditorToBottom\(\): void/);
	assert.match(
		source,
		/onEditorSubmit: \(\) => followSubmittedEditorToBottom\(\)/,
	);
	assert.match(source, /Object\.defineProperty\(editor, "onSubmit"/);
	assert.match(
		source,
		/followSubmittedEditorToBottom\(\);\n\s+handler\(text\);/,
	);
	assert.match(
		source,
		/keybindings\.matches\(data, "app\.message\.followUp"\)/,
	);
});

test("thinking level changes invalidate statusbar rendering", () => {
	assert.match(source, /let currentThinkingLevel: string \| null = null/);
	assert.match(
		source,
		/pi\.on\("thinking_level_select"[\s\S]*currentCtx = ctx;[\s\S]*currentThinkingLevel =[\s\S]*getThinkingLevelFn\?\.\(\) \?\?[\s\S]*typeof event\.level === "string"[\s\S]*requestImmediateStatusRender\(\{ deferDuringTyping: false \}\);[\s\S]*\}\);/,
	);
	assert.match(
		source,
		/if \([\s\S]*e\.type === "thinking_level_change" &&[\s\S]*typeof e\.thinkingLevel === "string"[\s\S]*\) \{\s*thinkingLevelFromSession = e\.thinkingLevel;/,
	);
	assert.match(
		source,
		/const thinkingLevel =[\s\S]*currentThinkingLevel \?\?[\s\S]*thinkingLevelFromSession \?\?[\s\S]*getThinkingLevelFn\?\.\(\) \?\?[\s\S]*"off"/,
	);
});

test("context usage changes repaint from live streaming message usage", () => {
	assert.match(source, /const CONTEXT_STATUS_RENDER_MS = 250/);
	assert.match(
		source,
		/function getUsageTokenTotal\(usage: SessionAssistantUsage\): number/,
	);
	assert.match(
		source,
		/const totalTokens =[\s\S]*"totalTokens" in usage && typeof usage\.totalTokens === "number"/,
	);
	assert.match(
		source,
		/return \([\s\S]*totalTokens \|\|[\s\S]*usage\.input \+ usage\.output \+ usage\.cacheRead \+ usage\.cacheWrite[\s\S]*\);/,
	);
	assert.match(
		source,
		/let liveAssistantUsage: SessionAssistantUsage \| null = null/,
	);
	assert.doesNotMatch(source, /const requestContextStatusRender/);
	assert.match(
		source,
		/lastUserPrompt = "";\n\s+isStreaming = false;\n\s+liveAssistantUsage = null;\n\s+stashedEditorText = null;/,
	);
	assert.match(
		source,
		/pi\.on\("agent_start", async \(_event, ctx\) => \{\n\s+isStreaming = true;\n\s+liveAssistantUsage = null;\n\s+onVibeAgentStart\(\);\n\s+dismissWelcome\(ctx\);\n\s+currentCtx = ctx;\n\s+\}\);/,
	);
	assert.match(
		source,
		/pi\.on\("message_update"[\s\S]*isSessionAssistantMessage\(event\.message\)[\s\S]*event\.message\.stopReason !== "error"[\s\S]*event\.message\.stopReason !== "aborted"[\s\S]*getUsageTokenTotal\(event\.message\.usage\) > 0[\s\S]*liveAssistantUsage = event\.message\.usage;[\s\S]*currentCtx = ctx;[\s\S]*layoutDirty = true;[\s\S]*statusRenderScheduler\.schedule\(CONTEXT_STATUS_RENDER_MS\);[\s\S]*\}\);/,
	);
	assert.match(
		source,
		/pi\.on\("message_end"[\s\S]*currentCtx = ctx;[\s\S]*isSessionAssistantMessage\(event\.message\)[\s\S]*event\.message\.stopReason === "error"[\s\S]*event\.message\.stopReason === "aborted"[\s\S]*liveAssistantUsage = null;[\s\S]*getUsageTokenTotal\(event\.message\.usage\) > 0[\s\S]*liveAssistantUsage = event\.message\.usage;[\s\S]*requestImmediateStatusRender\(\{ deferDuringTyping: false \}\);[\s\S]*\}\);/,
	);
	assert.match(
		source,
		/pi\.on\("agent_end", async \(_event, ctx\) => \{\n\s+isStreaming = false;\n\s+liveAssistantUsage = null;\n\s+currentCtx = ctx;/,
	);
	assert.match(
		source,
		/pi\.on\("session_tree", async \(_event, ctx\) => \{\n\s+currentCtx = ctx;\n\s+currentThinkingLevel = null;\n\s+liveAssistantUsage = null;\n\s+requestImmediateStatusRender\(\{ deferDuringTyping: false \}\);\n\s+\}\);/,
	);
	assert.match(
		source,
		/if \(getUsageTokenTotal\(m\.usage\) > 0\) \{\n\s+lastAssistant = m;\n\s+\}/,
	);
	assert.match(
		source,
		/const coreContextUsage =[\s\S]*isStreaming && liveAssistantUsage \? null : readCoreContextUsage\(ctx\)/,
	);
	assert.match(
		source,
		/const contextTokens =[\s\S]*coreContextUsage\?\.contextTokens \?\?[\s\S]*latestUsage \? getUsageTokenTotal\(latestUsage\) : 0/,
	);
});

test("extension status changes invalidate statusbar rendering", () => {
	assert.match(source, /let forceNextLayoutRecompute = false/);
	assert.match(
		source,
		/let restoreFooterStatusRepaintHook: \(\(\) => void\) \| null = null/,
	);
	assert.match(
		source,
		/const requestImmediateStatusRender = \([\s\S]*options: \{ deferDuringTyping\?: boolean \} = \{\},[\s\S]*\) => \{/,
	);
	assert.match(
		source,
		/if \([\s\S]*options\.deferDuringTyping !== false &&[\s\S]*Date\.now\(\) - lastEditorInputAt < EDITOR_STATUS_DEFER_MS[\s\S]*\) \{\s*statusRenderScheduler\.schedule\(\);\s*return;\s*\}/,
	);
	assert.match(
		source,
		/forceNextLayoutRecompute = true;\n\s+statusRenderScheduler\.cancel\(\);\n\s+statusRenderScheduler\.schedule\(0\);/,
	);
	assert.match(
		source,
		/const installFooterStatusRepaintHook = \([\s\S]*footerData: ReadonlyFooterDataProvider,[\s\S]*\) => \{/,
	);
	assert.match(
		source,
		/setExtensionStatus\?: \(key: string, text: string \| undefined\) => void/,
	);
	assert.match(
		source,
		/const setExtensionStatusAndRepaint = function setExtensionStatusAndRepaint/,
	);
	assert.match(
		source,
		/originalSetExtensionStatus\.call\(this, key, text\);\n\s+requestImmediateStatusRender\(\);/,
	);
	assert.match(source, /installFooterStatusRepaintHook\(footerData\);/);
	assert.match(
		source,
		/if \([\s\S]*writableFooterData\.setExtensionStatus === setExtensionStatusAndRepaint[\s\S]*\) \{\s*writableFooterData\.setExtensionStatus = originalSetExtensionStatus;/,
	);
	assert.match(
		source,
		/if \([\s\S]*clearExtensionStatusesAndRepaint &&[\s\S]*writableFooterData\.clearExtensionStatuses ===[\s\S]*clearExtensionStatusesAndRepaint[\s\S]*\)/,
	);
	assert.match(
		source,
		/restoreFooterStatusRepaintHook\?\.\(\);\n\s+restoreFooterStatusRepaintHook = null;/,
	);
});

test("fixed editor captures Pi status messages with the editor cluster", () => {
	assert.match(source, /let fixedStatusContainer: any = null/);
	assert.match(
		source,
		/const statusContainerCandidate =[\s\S]*tuiChildren\[editorContainerMatch\.index - 2\] \?\? null/,
	);
	assert.match(
		source,
		/fixedStatusContainer =[\s\S]*statusContainerCandidate &&[\s\S]*typeof statusContainerCandidate\.render === "function"/,
	);
	assert.match(
		source,
		/compositor[\s\S]*\.renderHidden\(fixedStatusContainer, width\)[\s\S]*\.filter\(\(line\) => visibleWidth\(line\) > 0\)/,
	);
	assert.match(
		source,
		/statusLines: \[[\s\S]*\.\.\.aboveWidgetLines,[\s\S]*\.\.\.renderStatusbarStatusLines\(width\),[\s\S]*\.\.\.statusContainerLines,[\s\S]*\]/,
	);
	assert.match(
		source,
		/if \(fixedStatusContainer\?\.render\)[\s\S]*compositor\.hideRenderable\(fixedStatusContainer\)/,
	);
	assert.match(source, /fixedStatusContainer = null/);
});

test("shutdown cleanup resets terminal modes even before compositor install", () => {
	assert.match(
		source,
		/import \{[\s\S]*emergencyTerminalModeReset,[\s\S]*TerminalSplitCompositor,[\s\S]*\} from "\.\/fixed-editor\/terminal-split\.ts"/,
	);
	assert.match(source, /const hadCompositor = fixedEditorCompositor !== null/);
	assert.match(
		source,
		/if \(!hadCompositor && options\?\.resetExtendedKeyboardModes\)/,
	);
	assert.match(
		source,
		/process\.stdout\.write\(emergencyTerminalModeReset\(\)\)/,
	);
});

test("statusbar shortcut defaults do not claim reserved Pi shortcuts", () => {
	const reservedKeys = new Map<string, string>();
	for (const [id, definition] of Object.entries(KEYBINDINGS)) {
		const keys =
			definition.defaultKeys === undefined
				? []
				: Array.isArray(definition.defaultKeys)
					? definition.defaultKeys
					: [definition.defaultKeys];
		for (const key of keys) {
			reservedKeys.set(normalizeShortcut(key), id);
		}
	}

	for (const [name, shortcut] of statusbarDefaults()) {
		const conflict = reservedKeys.get(normalizeShortcut(shortcut));
		assert.equal(
			conflict,
			undefined,
			`${name} default ${shortcut} conflicts with ${conflict}`,
		);
	}
});

test("statusbar fallback routing rejects reserved Pi shortcut defaults", () => {
	assert.doesNotMatch(source, /KeybindingsManager/);
	assert.match(source, /TUI_KEYBINDINGS/);
	assert.match(source, /const APP_RESERVED_SHORTCUTS = \[/);
	assert.match(source, /"alt\+enter"/);
	assert.match(source, /"alt\+up"/);
	assert.match(source, /"alt\+down"/);
	assert.match(source, /"ctrl\+s"/);
	assert.match(source, /"shift\+l"/);
	assert.match(
		source,
		/for \(const definition of Object\.values\(TUI_KEYBINDINGS\)\)/,
	);
	assert.doesNotMatch(source, /RESERVED_TUI_KEYBINDING_IDS/);
	assert.match(
		source,
		/const EXTRA_RESERVED_SHORTCUTS = \["alt\+s"\] as const/,
	);
	assert.match(
		source,
		/const SHORTCUT_MODIFIER_ORDER = \["ctrl", "alt", "super", "shift"\] as const/,
	);
	assert.match(
		source,
		/const SHORTCUT_MODIFIERS = new Set(?:<string>)?\(SHORTCUT_MODIFIER_ORDER\)/,
	);
	assert.match(source, /modifierRank\.get\(a\)/);
	assert.match(
		source,
		/configuredToggleShortcut &&\s*!reservedShortcuts\(\)\.has\(shortcutUsageKey\(configuredToggleShortcut\)\)/,
	);
});

test("statusbar shortcuts have terminal-input fallback routing", () => {
	assert.match(
		source,
		/function getStatusbarShortcutAction\(\s*data: string,?\s*\): StatusbarShortcutAction \| null/,
	);
	assert.match(
		source,
		/matchesConfiguredShortcut\(data, resolvedShortcuts\.stashHistory\)/,
	);
	assert.match(
		source,
		/matchesConfiguredShortcut\(data, resolvedShortcuts\.copyEditor\)/,
	);
	assert.match(
		source,
		/matchesConfiguredShortcut\(data, resolvedShortcuts\.cutEditor\)/,
	);
	assert.match(
		source,
		/matchesConfiguredShortcut\(data, bashModeSettings\.toggleShortcut\)/,
	);
	assert.match(source, /runStatusbarShortcut\(ctx, statusbarShortcutAction\)/);
});
