/**
 * @module vibe-config
 *
 * Type definitions, defaults, and parsing for `statusbar.vibe` config.
 *
 * Users configure vibes under `statusbar.vibe` in settings.json.
 * {@link parseVibeConfig} normalises raw JSON into a validated {@link VibeConfig}.
 * {@link nextVibeSetting} / {@link nextStatusbarVibeSetting} produce updated
 * setting objects that preserve shorthand preset strings and inherited fields.
 */

// ── Types ─────────────────────────────────────────────────────────────────

/** Origin of working messages: built-in packs or AI-generated. */
export type VibeSource = "packs" | "generated";

/** Animation style applied to the working message. `shimmer` = sweeping highlight; `none` = static. */
export type VibeAnimation = "shimmer" | "none";

/**
 * Settings for AI-generated vibe messages (`source: "generated"`).
 *
 * - `model` — provider/model spec, e.g. `"openai-codex/gpt-5.4-mini"`.
 * - `prompt` — template with `{theme}`, `{task}`, `{exclude}` placeholders.
 * - `refreshInterval` — minimum seconds between regeneration on tool calls.
 *   Internally stored as **seconds**; converted to ms at consumption.
 */
export interface GeneratedVibeConfig {
	model: string;
	prompt: string;
	refreshInterval: number;
}

/**
 * Top-level vibe configuration, stored under `statusbar.vibe` in settings.
 *
 * - `enabled` — master switch; when false, no vibe messages display.
 * - `source` — where messages come from.
 * - `disabledPacks` — pack IDs excluded from selection (only affects `source: "packs"`).
 * - `safeMode` — filters out messages tagged or regex-matched as profane.
 * - `animation` — visual effect on the working message line.
 * - `generated` — AI generation settings (only affects `source: "generated"`).
 */
export interface VibeConfig {
	enabled: boolean;
	source: VibeSource;
	disabledPacks: string[];
	safeMode: boolean;
	animation: VibeAnimation;
	generated: GeneratedVibeConfig;
}

// ── Defaults ──────────────────────────────────────────────────────────────

/** Default AI model for generated vibes. */
const DEFAULT_MODEL = "openai-codex/gpt-5.4-mini";

/** Default prompt template for generated vibes. Placeholders: `{theme}`, `{task}`, `{exclude}`. */
export const DEFAULT_GENERATED_VIBE_PROMPT = `Generate a 2-4 word "{theme}" themed loading message ending in "...".

Task: {task}

Be creative, funny, sarcastic, and unexpected. Avoid obvious/clichéd phrases for this theme.
Relevant catchphrases, quotes, and themes should be incorporated into the message.
The message should hint at the task using theme vocabulary. Modify catchphrases, quotes, and themes as needed.
{exclude}
Output only the message, nothing else.`;

const DEFAULT_VIBE_CONFIG: VibeConfig = {
	enabled: true,
	source: "packs",
	disabledPacks: [],
	safeMode: true,
	animation: "shimmer",
	generated: {
		model: DEFAULT_MODEL,
		prompt: DEFAULT_GENERATED_VIBE_PROMPT,
		refreshInterval: 30,
	},
};

// ── Helpers ───────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Coerce unknown to VibeSource, defaulting to `"packs"`. */
function normalizeSource(value: unknown): VibeSource {
	if (value === "packs" || value === "generated") return value;
	return "packs";
}

/** Coerce unknown to VibeAnimation, defaulting to `"shimmer"`. */
function normalizeAnimation(value: unknown): VibeAnimation {
	if (value === "shimmer" || value === "none") return value;
	return "shimmer";
}

/** Coerce unknown to a trimmed, deduped, non-empty string array. */
function normalizeDisabledPacks(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	const result: string[] = [];
	const seen = new Set<string>();
	for (const entry of value) {
		if (typeof entry !== "string") continue;
		const trimmed = entry.trim();
		if (!trimmed || seen.has(trimmed)) continue;
		seen.add(trimmed);
		result.push(trimmed);
	}
	return result;
}

/**
 * Coerce unknown to GeneratedVibeConfig.
 * `refreshInterval` is floored to an integer; non-positive or non-finite → default.
 */
function normalizeGeneratedConfig(value: unknown): GeneratedVibeConfig {
	const defaults = DEFAULT_VIBE_CONFIG.generated;
	if (!isRecord(value)) return { ...defaults };

	const model =
		typeof value.model === "string" && value.model.trim()
			? value.model.trim()
			: defaults.model;

	const prompt =
		typeof value.prompt === "string" && value.prompt.trim()
			? value.prompt.trim()
			: defaults.prompt;

	const refreshInterval =
		typeof value.refreshInterval === "number" &&
		Number.isFinite(value.refreshInterval) &&
		value.refreshInterval > 0
			? Math.floor(value.refreshInterval)
			: defaults.refreshInterval;

	return { model, prompt, refreshInterval };
}

// ── Parser ────────────────────────────────────────────────────────────────

/**
 * Parse and normalise raw `statusbar.vibe` value from settings.json.
 * Returns a fully-populated VibeConfig with defaults for missing/invalid fields.
 */
export function parseVibeConfig(value: unknown): VibeConfig {
	if (!isRecord(value)) {
		return {
			...DEFAULT_VIBE_CONFIG,
			disabledPacks: [],
			generated: { ...DEFAULT_VIBE_CONFIG.generated },
		};
	}

	return {
		enabled: typeof value.enabled === "boolean" ? value.enabled : true,
		source: normalizeSource(value.source),
		disabledPacks: normalizeDisabledPacks(value.disabledPacks),
		safeMode: typeof value.safeMode === "boolean" ? value.safeMode : true,
		animation: normalizeAnimation(value.animation),
		generated: normalizeGeneratedConfig(value.generated),
	};
}

// ── Settings update helpers ───────────────────────────────────────────────

/** Build next `statusbar.vibe` setting value with partial overrides. */
export function nextVibeSetting(
	existing: unknown,
	updates: Partial<Omit<VibeConfig, "generated">> & {
		generated?: Partial<GeneratedVibeConfig>;
	},
): Record<string, unknown> {
	const current = parseVibeConfig(existing);

	const result: Record<string, unknown> = {
		enabled: updates.enabled ?? current.enabled,
		source: updates.source ?? current.source,
		disabledPacks: updates.disabledPacks ?? current.disabledPacks,
		safeMode: updates.safeMode ?? current.safeMode,
		animation: updates.animation ?? current.animation,
		generated: {
			model: updates.generated?.model ?? current.generated.model,
			prompt: updates.generated?.prompt ?? current.generated.prompt,
			refreshInterval:
				updates.generated?.refreshInterval ?? current.generated.refreshInterval,
		},
	};

	return result;
}

/**
 * Build the next `statusbar` setting while preserving existing shorthand preset
 * values and inherited effective vibe config.
 */
export function nextStatusbarVibeSetting(
	existingStatusbarSetting: unknown,
	updates: Parameters<typeof nextVibeSetting>[1],
	effectiveVibe: VibeConfig,
): Record<string, unknown> {
	const statusbar = isRecord(existingStatusbarSetting)
		? existingStatusbarSetting
		: typeof existingStatusbarSetting === "string" &&
				existingStatusbarSetting.trim()
			? { preset: existingStatusbarSetting.trim() }
			: {};

	const baseVibe = isRecord(statusbar.vibe) ? statusbar.vibe : effectiveVibe;
	return { ...statusbar, vibe: nextVibeSetting(baseVibe, updates) };
}
