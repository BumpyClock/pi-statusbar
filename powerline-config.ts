import { visibleWidth } from "@earendil-works/pi-tui";
import { getDefaultColors } from "./theme.ts";
import type {
	BuiltinStatusLineSegmentId,
	ColorScheme,
	ColorValue,
	CustomItemPosition,
	CustomStatusItem,
	PresetDef,
	SemanticColor,
	StatusLineSeparatorStyle,
	StatusLinePreset,
	StatusLineSegmentId,
	StatusLineSegmentOptions,
	UserPresetDef,
} from "./types.ts";

export interface PowerlineConfig {
	preset: string;
	presets: Record<string, UserPresetDef>;
	customItems: CustomStatusItem[];
	mouseScroll: boolean;
	fixedEditor: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeBuiltinPreset(
	value: unknown,
	presets: readonly StatusLinePreset[],
): StatusLinePreset | null {
	if (typeof value !== "string") return null;
	const normalized = value.trim().toLowerCase();
	return (presets as readonly string[]).includes(normalized)
		? (normalized as StatusLinePreset)
		: null;
}

function normalizeCustomItemId(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const normalized = value.trim();
	if (!normalized) return null;
	return /^[a-zA-Z0-9_-]+$/.test(normalized) ? normalized : null;
}

function normalizeCustomItemPosition(value: unknown): CustomItemPosition {
	if (value === "left" || value === "right" || value === "secondary")
		return value;
	return "right";
}

function normalizeCustomColor(value: unknown): ColorValue | undefined {
	if (typeof value !== "string") return undefined;
	const normalized = value.trim();
	return normalized ? (normalized as ColorValue) : undefined;
}

function normalizeCustomPrefix(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const normalized = value.trim();
	return normalized ? normalized : undefined;
}

function normalizeCustomStatusItem(
	raw: unknown,
	idOverride?: string,
): CustomStatusItem | null {
	if (!isRecord(raw)) return null;
	const id = normalizeCustomItemId(idOverride ?? raw.id);
	if (!id) return null;

	const statusKey =
		typeof raw.statusKey === "string" && raw.statusKey.trim()
			? raw.statusKey.trim()
			: id;

	return {
		id,
		statusKey,
		position: normalizeCustomItemPosition(raw.position),
		color: normalizeCustomColor(raw.color),
		prefix: normalizeCustomPrefix(raw.prefix),
		hideWhenMissing: raw.hideWhenMissing !== false,
		excludeFromExtensionStatuses: raw.excludeFromExtensionStatuses !== false,
	};
}

function normalizeCustomItems(raw: unknown): CustomStatusItem[] {
	const normalized: CustomStatusItem[] = [];

	if (Array.isArray(raw)) {
		for (const entry of raw) {
			const item = normalizeCustomStatusItem(entry);
			if (item) normalized.push(item);
		}
	} else if (isRecord(raw)) {
		for (const [id, entry] of Object.entries(raw)) {
			const item = normalizeCustomStatusItem(entry, id);
			if (item) normalized.push(item);
		}
	}

	const deduped = new Map<string, CustomStatusItem>();
	for (const item of normalized) {
		deduped.set(item.id, item);
	}

	return [...deduped.values()];
}

// ── Segment ID validation ─────────────────────────────────────────────────

const BUILTIN_SEGMENT_IDS: ReadonlySet<string> =
	new Set<BuiltinStatusLineSegmentId>([
		"model",
		"shell_mode",
		"path",
		"git",
		"subagents",
		"token_in",
		"token_out",
		"token_total",
		"cost",
		"context_pct",
		"context_total",
		"time_spent",
		"time",
		"session",
		"hostname",
		"cache_read",
		"cache_write",
		"thinking",
		"extension_statuses",
	]);

function isValidSegmentId(value: string): value is StatusLineSegmentId {
	if (BUILTIN_SEGMENT_IDS.has(value)) return true;
	if (value.startsWith("custom:")) {
		const customId = value.slice(7);
		return /^[a-zA-Z0-9_-]+$/.test(customId);
	}
	return false;
}

function normalizeSegmentList(raw: unknown): StatusLineSegmentId[] | undefined {
	if (!Array.isArray(raw)) return undefined;
	const result: StatusLineSegmentId[] = [];
	for (const entry of raw) {
		if (typeof entry !== "string") continue;
		const trimmed = entry.trim();
		if (isValidSegmentId(trimmed)) result.push(trimmed as StatusLineSegmentId);
	}
	return result;
}

// ── Separator validation ──────────────────────────────────────────────────

const VALID_SEPARATORS: ReadonlySet<string> = new Set<StatusLineSeparatorStyle>(
	[
		"powerline",
		"powerline-thin",
		"slash",
		"pipe",
		"block",
		"none",
		"ascii",
		"dot",
		"chevron",
		"star",
	],
);

function normalizeSeparator(
	value: unknown,
): StatusLineSeparatorStyle | undefined {
	if (typeof value !== "string") return undefined;
	const normalized = value.trim().toLowerCase();
	return VALID_SEPARATORS.has(normalized)
		? (normalized as StatusLineSeparatorStyle)
		: undefined;
}

// ── Segment options merge ─────────────────────────────────────────────────

function normalizeSegmentOptions(
	raw: unknown,
): StatusLineSegmentOptions | undefined {
	if (!isRecord(raw)) return undefined;
	const result: StatusLineSegmentOptions = {};

	if (isRecord(raw.model) && typeof raw.model.showThinkingLevel === "boolean") {
		result.model = { showThinkingLevel: raw.model.showThinkingLevel };
	}

	if (isRecord(raw.path)) {
		const pathOptions: NonNullable<StatusLineSegmentOptions["path"]> = {};
		if (
			raw.path.mode === "basename" ||
			raw.path.mode === "abbreviated" ||
			raw.path.mode === "full"
		) {
			pathOptions.mode = raw.path.mode;
		}
		if (
			typeof raw.path.maxLength === "number" &&
			Number.isFinite(raw.path.maxLength) &&
			raw.path.maxLength > 0
		) {
			pathOptions.maxLength = Math.floor(raw.path.maxLength);
		}
		if (Object.keys(pathOptions).length > 0) result.path = pathOptions;
	}

	if (isRecord(raw.git)) {
		const gitOptions: NonNullable<StatusLineSegmentOptions["git"]> = {};
		if (typeof raw.git.showBranch === "boolean")
			gitOptions.showBranch = raw.git.showBranch;
		if (typeof raw.git.showStaged === "boolean")
			gitOptions.showStaged = raw.git.showStaged;
		if (typeof raw.git.showUnstaged === "boolean")
			gitOptions.showUnstaged = raw.git.showUnstaged;
		if (typeof raw.git.showUntracked === "boolean")
			gitOptions.showUntracked = raw.git.showUntracked;
		if (Object.keys(gitOptions).length > 0) result.git = gitOptions;
	}

	if (isRecord(raw.time)) {
		const timeOptions: NonNullable<StatusLineSegmentOptions["time"]> = {};
		if (raw.time.format === "12h" || raw.time.format === "24h")
			timeOptions.format = raw.time.format;
		if (typeof raw.time.showSeconds === "boolean")
			timeOptions.showSeconds = raw.time.showSeconds;
		if (Object.keys(timeOptions).length > 0) result.time = timeOptions;
	}

	return Object.keys(result).length > 0 ? result : undefined;
}

function mergeSegmentOptions(
	parent: StatusLineSegmentOptions | undefined,
	child: StatusLineSegmentOptions | undefined,
): StatusLineSegmentOptions | undefined {
	if (!parent) return child;
	if (!child) return parent;
	const merged: StatusLineSegmentOptions = {};
	if (parent.model || child.model)
		merged.model = { ...parent.model, ...child.model };
	if (parent.path || child.path)
		merged.path = { ...parent.path, ...child.path };
	if (parent.git || child.git) merged.git = { ...parent.git, ...child.git };
	if (parent.time || child.time)
		merged.time = { ...parent.time, ...child.time };
	return merged;
}

// ── User preset parsing ───────────────────────────────────────────────────

const DEFAULT_COLOR_KEYS = new Set(Object.keys(getDefaultColors()));

function normalizePresetColors(
	raw: unknown,
	presetId: string,
): ColorScheme | undefined {
	if (!isRecord(raw)) return undefined;

	const colors: ColorScheme = {};
	for (const [key, rawColor] of Object.entries(raw)) {
		if (!DEFAULT_COLOR_KEYS.has(key)) {
			console.debug(
				`[powerline-footer] Ignoring invalid color key "${key}" in user preset "${presetId}"`,
			);
			continue;
		}
		if (typeof rawColor !== "string") {
			console.debug(
				`[powerline-footer] Ignoring non-string color value for "${key}" in user preset "${presetId}"`,
			);
			continue;
		}

		const color = rawColor.trim();
		if (!color) {
			console.debug(
				`[powerline-footer] Ignoring empty color value for "${key}" in user preset "${presetId}"`,
			);
			continue;
		}

		colors[key as SemanticColor] = color as ColorValue;
	}

	return Object.keys(colors).length > 0 ? colors : undefined;
}

function normalizeUserPreset(
	raw: unknown,
	presetId: string,
): UserPresetDef | null {
	if (!isRecord(raw)) return null;
	const preset: UserPresetDef = {};

	if (typeof raw.extends === "string" && raw.extends.trim()) {
		preset.extends = raw.extends.trim();
	}

	const left = normalizeSegmentList(raw.leftSegments);
	if (left) preset.leftSegments = left;

	const right = normalizeSegmentList(raw.rightSegments);
	if (right) preset.rightSegments = right;

	const secondary = normalizeSegmentList(raw.secondarySegments);
	if (secondary) preset.secondarySegments = secondary;

	const sep = normalizeSeparator(raw.separator);
	if (sep) preset.separator = sep;

	const opts = normalizeSegmentOptions(raw.segmentOptions);
	if (opts) preset.segmentOptions = opts;

	const colors = normalizePresetColors(raw.colors, presetId);
	if (colors) preset.colors = colors;

	return preset;
}

function normalizeUserPresets(
	raw: unknown,
	builtInPresetNames: readonly StatusLinePreset[],
): Record<string, UserPresetDef> {
	if (!isRecord(raw)) return {};
	const result: Record<string, UserPresetDef> = {};
	for (const [id, entry] of Object.entries(raw)) {
		if (!normalizeCustomItemId(id)) {
			console.debug(
				`[powerline-footer] Ignoring user preset with invalid id: "${id}"`,
			);
			continue;
		}
		if (normalizeBuiltinPreset(id, builtInPresetNames)) {
			console.debug(
				`[powerline-footer] Ignoring user preset "${id}" because built-in presets take precedence`,
			);
			continue;
		}
		const preset = normalizeUserPreset(entry, id);
		if (!preset) {
			console.debug(
				`[powerline-footer] Ignoring non-object user preset: "${id}"`,
			);
			continue;
		}
		result[id] = preset;
	}
	return result;
}

export function parsePowerlineConfig(
	value: unknown,
	presets: readonly StatusLinePreset[],
): PowerlineConfig {
	const defaultConfig: PowerlineConfig = {
		preset: "default",
		presets: {},
		customItems: [],
		mouseScroll: true,
		fixedEditor: true,
	};

	const directPreset = normalizeBuiltinPreset(value, presets);
	if (directPreset) return { ...defaultConfig, preset: directPreset };

	if (!isRecord(value)) return defaultConfig;

	const userPresets = normalizeUserPresets(value.presets, presets);
	const builtinPreset = normalizeBuiltinPreset(value.preset, presets);

	// Accept user preset name if defined in user presets map
	let preset: string = builtinPreset ?? defaultConfig.preset;
	if (!builtinPreset && typeof value.preset === "string") {
		const candidateName = value.preset.trim();
		if (candidateName in userPresets) {
			preset = candidateName;
		}
	}

	return {
		preset,
		presets: userPresets,
		customItems: normalizeCustomItems(value.customItems),
		mouseScroll: value.mouseScroll !== false,
		fixedEditor: value.fixedEditor !== false,
	};
}

// ── Preset resolver ───────────────────────────────────────────────────────

export function resolvePresetDef(
	config: PowerlineConfig,
	builtIns: Readonly<Record<StatusLinePreset, PresetDef>>,
): PresetDef {
	const fallback = builtIns.default;

	// Built-in preset → return directly
	if (config.preset in builtIns) {
		return builtIns[config.preset as StatusLinePreset];
	}

	// User preset → resolve extends chain
	const userPreset = config.presets[config.preset];
	if (!userPreset) return fallback;

	const base = resolveExtendsChain(
		userPreset,
		config.presets,
		builtIns,
		new Set([config.preset]),
	);
	if (!base) {
		console.debug(
			`[powerline-footer] Circular or broken extends chain for preset "${config.preset}", using default`,
		);
		return fallback;
	}

	return applyUserPresetOverBase(base, userPreset);
}

function resolveExtendsChain(
	userPreset: UserPresetDef,
	userPresets: Record<string, UserPresetDef>,
	builtIns: Readonly<Record<StatusLinePreset, PresetDef>>,
	visited: Set<string>,
): PresetDef | null {
	const extendsName = userPreset.extends;

	// No extends → use default as base
	if (!extendsName) return builtIns.default;

	// Extends a built-in
	if (extendsName in builtIns) return builtIns[extendsName as StatusLinePreset];

	// Extends another user preset
	if (visited.has(extendsName)) return null; // circular
	const parent = userPresets[extendsName];
	if (!parent) {
		console.debug(
			`[powerline-footer] User preset extends unknown preset "${extendsName}", using default`,
		);
		return builtIns.default;
	}

	visited.add(extendsName);
	const grandparentBase = resolveExtendsChain(
		parent,
		userPresets,
		builtIns,
		visited,
	);
	if (!grandparentBase) return null; // circular deeper

	return applyUserPresetOverBase(grandparentBase, parent);
}

function applyUserPresetOverBase(
	base: PresetDef,
	override: UserPresetDef,
): PresetDef {
	return {
		leftSegments: override.leftSegments ?? [...base.leftSegments],
		rightSegments: override.rightSegments ?? [...base.rightSegments],
		secondarySegments:
			override.secondarySegments ??
			(base.secondarySegments ? [...base.secondarySegments] : undefined),
		separator: override.separator ?? base.separator,
		segmentOptions: mergeSegmentOptions(
			base.segmentOptions,
			override.segmentOptions,
		),
		colors: override.colors
			? { ...base.colors, ...override.colors }
			: base.colors,
	};
}

export function mergeSegmentsWithCustomItems(
	presetDef: PresetDef,
	customItems: readonly CustomStatusItem[],
): {
	leftSegments: StatusLineSegmentId[];
	rightSegments: StatusLineSegmentId[];
	secondarySegments: StatusLineSegmentId[];
} {
	const left: StatusLineSegmentId[] = [...presetDef.leftSegments];
	const right: StatusLineSegmentId[] = [...presetDef.rightSegments];
	const secondary: StatusLineSegmentId[] = [
		...(presetDef.secondarySegments ?? []),
	];

	// Collect all custom:<id> already referenced in resolved preset arrays
	const alreadyPlaced = new Set<string>();
	for (const seg of [...left, ...right, ...secondary]) {
		if (seg.startsWith("custom:")) {
			alreadyPlaced.add(seg);
		}
	}

	for (const item of customItems) {
		const segmentId: StatusLineSegmentId = `custom:${item.id}`;
		if (alreadyPlaced.has(segmentId)) continue; // already placed by preset
		if (item.position === "left") left.push(segmentId);
		else if (item.position === "secondary") secondary.push(segmentId);
		else right.push(segmentId);
	}

	return {
		leftSegments: left,
		rightSegments: right,
		secondarySegments: secondary,
	};
}

export function nextPowerlineSettingWithPreset(
	existingPowerlineSetting: unknown,
	preset: string,
): unknown {
	if (!isRecord(existingPowerlineSetting)) {
		return preset;
	}
	return { ...existingPowerlineSetting, preset };
}

export function nextPowerlineSettingWithOptions(
	existingPowerlineSetting: unknown,
	updates: Partial<Pick<PowerlineConfig, "mouseScroll" | "fixedEditor">>,
	currentPreset: string,
): unknown {
	if (!isRecord(existingPowerlineSetting)) {
		return { preset: currentPreset, ...updates };
	}
	return { ...existingPowerlineSetting, ...updates };
}

export function collectHiddenExtensionStatusKeys(
	customItems: readonly CustomStatusItem[],
): Set<string> {
	const hidden = new Set<string>();
	for (const item of customItems) {
		if (item.excludeFromExtensionStatuses) hidden.add(item.statusKey);
	}
	return hidden;
}

export function isNotificationExtensionStatus(value: string): boolean {
	return value.trimStart().startsWith("[");
}

export function getNotificationExtensionStatuses(
	statuses: ReadonlyMap<string, string>,
	hiddenKeys: ReadonlySet<string>,
): string[] {
	const notifications: string[] = [];
	for (const [statusKey, value] of statuses.entries()) {
		if (
			hiddenKeys.has(statusKey) ||
			!value ||
			!isNotificationExtensionStatus(value)
		) {
			continue;
		}
		notifications.push(value);
	}
	return notifications;
}

export function normalizeExtensionStatusValue(value: string): string | null {
	if (!value || visibleWidth(value) <= 0) {
		return null;
	}

	const stripped = value.replace(/(\x1b\[[0-9;]*m|\s|·|[|])+$/, "");
	return visibleWidth(stripped) > 0 ? stripped : null;
}

export function normalizeCompactExtensionStatus(value: string): string | null {
	if (isNotificationExtensionStatus(value)) {
		return null;
	}

	return normalizeExtensionStatusValue(value);
}
