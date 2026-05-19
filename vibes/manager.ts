/**
 * @module working-vibes
 *
 * Contextual working messages from AI generation or built-in packs.
 * Coordinates the pack picker, AI generation pipeline, and shimmer animation.
 *
 * Uses module-level singleton state (matching pi-statusbar pattern).
 * Initialise with {@link initVibeManager}, then hook into agent lifecycle:
 * `before_agent_start` → `agent_start` → `tool_call` → `agent_end`.
 */

import { complete, type Context } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { VibeConfig } from "./config.ts";
import { BUILTIN_VIBE_PACKS } from "./packs.ts";
import {
	createVibePicker,
	getAllowedPackMessages,
	type VibePicker,
} from "./picker.ts";
import {
	createVibeAnimationController,
	type VibeAnimationController,
} from "./animation.ts";

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

const VIBE_SYSTEM_PROMPT =
	"You generate short themed loading messages and reply with the requested text only.";

const SAFE_MODE_SUFFIX =
	" Never use profanity, adult language, or offensive content.";

/** Default theme placeholder for generated prompts using {theme}. */
const GENERATED_THEME_DEFAULT = "coding";

const GENERATION_TIMEOUT_MS = 3_000;
const MAX_VIBE_LENGTH = 65;
const MAX_RECENT_VIBES = 5;
const FALLBACK_MESSAGE = "Working";

// ═══════════════════════════════════════════════════════════════════════════
// Module-level State
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Internal state: current config, extension context, generation abort controller,
 * streaming flag, and last vibe timestamp for rate limiting.
 */
let config: VibeConfig | null = null;
let extensionCtx: ExtensionContext | null = null;
let currentGeneration: AbortController | null = null;
let isStreaming = false;
let lastVibeTime = 0;

// Generated source: recent vibes tracked to avoid repeats in AI prompts
let recentVibes: string[] = [];

// Pack source: stateful picker (avoids immediate repeats)
let picker: VibePicker | null = null;

// Animation controller and the setWorkingMessage ref it was created with
let animation: VibeAnimationController | null = null;
let animationSetWorkingMessage: ((msg?: string) => void) | null = null;

// ═══════════════════════════════════════════════════════════════════════════
// Internal: Pack Picker
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Rebuild the pack picker when config changes.
 * Reuses existing picker (via `reset`) to preserve last-pick state.
 */
function rebuildPicker(): void {
	if (!config) {
		picker = null;
		return;
	}
	const messages = getAllowedPackMessages(BUILTIN_VIBE_PACKS, {
		disabledPacks: config.disabledPacks,
		safeMode: config.safeMode,
	});
	if (picker) {
		picker.reset(messages);
	} else {
		picker = createVibePicker(messages);
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal: Animation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get or create animation controller. Returns `null` when `animation: "none"`.
 * Recreates the controller if `setWorkingMessage` reference changed (e.g. new session).
 */
function ensureAnimation(
	setWorkingMessage: (msg?: string) => void,
): VibeAnimationController | null {
	if (!config || config.animation === "none") return null;

	if (animation && animationSetWorkingMessage !== setWorkingMessage) {
		animation.stop();
		animation = null;
	}

	if (!animation) {
		animation = createVibeAnimationController({ setWorkingMessage });
		animationSetWorkingMessage = setWorkingMessage;
	}

	return animation;
}

/** Display a message: via animation (if enabled) or direct `setWorkingMessage`. */
function setMessage(
	message: string,
	setWorkingMessage: (msg?: string) => void,
): void {
	const anim = ensureAnimation(setWorkingMessage);
	if (anim) {
		if (anim.isRunning()) {
			anim.updateMessage(message);
		} else {
			anim.start(message);
		}
	} else {
		setWorkingMessage(message);
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal: Prompt Building & Response Parsing (Generated Source)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build the AI prompt from the template, substituting:
 * `{theme}` → theme, `{task}` → user prompt (truncated 100 chars with marker),
 * `{exclude}` → recent vibes to avoid repeating.
 */
function buildVibePrompt(userPrompt: string): string {
	if (!config) return userPrompt;

	const task =
		userPrompt.length > 100 ? `${userPrompt.slice(0, 99)}…` : userPrompt;
	const exclude =
		recentVibes.length > 0 ? `Don't use: ${recentVibes.join(", ")}` : "";

	return config.generated.prompt
		.replace(/\{theme\}/g, GENERATED_THEME_DEFAULT)
		.replace(/\{task\}/g, task)
		.replace(/\{exclude\}/g, exclude);
}

/**
 * Normalise AI response into a vibe string:
 * first line only, strip wrapping quotes, enforce trailing `...`, cap at MAX_VIBE_LENGTH.
 * Falls back to `"Working..."` on empty input.
 */
function parseVibeResponse(response: string): string {
	if (!response) return `${FALLBACK_MESSAGE}...`;

	// Take first line only (AI sometimes adds explanations)
	let vibe = response.trim().split("\n")[0].trim();

	// Strip wrapping quotes
	vibe = vibe.replace(/^["']|["']$/g, "");

	// Ensure ellipsis
	if (!vibe.endsWith("...")) {
		vibe = vibe.replace(/\.+$/, "") + "...";
	}

	// Enforce length limit
	if (vibe.length > MAX_VIBE_LENGTH) {
		vibe = vibe.slice(0, MAX_VIBE_LENGTH - 3) + "...";
	}

	if (!vibe || vibe === "...") {
		return `${FALLBACK_MESSAGE}...`;
	}

	return vibe;
}

/** Build the AI Context with optional safe-mode suffix appended to system prompt. */
function buildAiContext(prompt: string, safeMode: boolean): Context {
	const systemPrompt = safeMode
		? VIBE_SYSTEM_PROMPT + SAFE_MODE_SUFFIX
		: VIBE_SYSTEM_PROMPT;

	return {
		systemPrompt,
		messages: [
			{
				role: "user",
				content: [{ type: "text", text: prompt }],
				timestamp: Date.now(),
			},
		],
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal: AI Generation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a vibe string via AI completion.
 *
 * Parses `model` as `provider/modelId`, resolves from the registry,
 * authenticates, and calls `complete`. Returns fallback on any failure.
 */
async function generateVibe(
	userPrompt: string,
	signal: AbortSignal,
): Promise<string> {
	if (!extensionCtx || !config) return `${FALLBACK_MESSAGE}...`;

	const { model: modelSpec } = config.generated;

	// Parse model spec (provider/modelId, modelId may contain slashes)
	const slashIndex = modelSpec.indexOf("/");
	if (slashIndex === -1) return `${FALLBACK_MESSAGE}...`;
	const provider = modelSpec.slice(0, slashIndex);
	const modelId = modelSpec.slice(slashIndex + 1);
	if (!provider || !modelId) return `${FALLBACK_MESSAGE}...`;

	// Resolve model from registry
	const model = extensionCtx.modelRegistry.find(provider, modelId);
	if (!model) {
		console.debug(`[working-vibes] Model not found: ${modelSpec}`);
		return `${FALLBACK_MESSAGE}...`;
	}

	// Get auth
	const auth = await extensionCtx.modelRegistry.getApiKeyAndHeaders(model);
	if (!auth.ok) {
		const message = "error" in auth ? auth.error : "unknown auth error";
		console.debug(`[working-vibes] Auth failed for ${provider}: ${message}`);
		return `${FALLBACK_MESSAGE}...`;
	}

	const aiContext = buildAiContext(
		buildVibePrompt(userPrompt),
		config.safeMode,
	);

	const response = await complete(model, aiContext, {
		apiKey: auth.apiKey,
		headers: auth.headers,
		signal,
	});

	const textContent = response.content.find((c) => c.type === "text");
	if (
		!textContent?.text &&
		response.stopReason === "error" &&
		response.errorMessage
	) {
		console.debug(
			`[working-vibes] Vibe generation failed: ${response.errorMessage}`,
		);
	}

	return parseVibeResponse(textContent?.text || "");
}

/** Track a generated vibe for dedup in future prompts. Skips fallback messages. */
function trackRecentVibe(vibe: string): void {
	if (vibe === `${FALLBACK_MESSAGE}...`) return;
	recentVibes = [vibe, ...recentVibes.filter((v) => v !== vibe)].slice(
		0,
		MAX_RECENT_VIBES,
	);
}

/**
 * Generate a vibe and update the working message.
 *
 * Cancels any in-flight generation before starting. Combines the abort
 * signal with a timeout ({@link GENERATION_TIMEOUT_MS}). Only applies the
 * result if still streaming and this generation wasn't aborted.
 */
async function generateAndUpdate(
	prompt: string,
	setWorkingMessage: (msg?: string) => void,
): Promise<void> {
	// Cancel any in-flight generation
	const controller = new AbortController();
	currentGeneration?.abort();
	currentGeneration = controller;

	const timeoutSignal = AbortSignal.timeout(GENERATION_TIMEOUT_MS);
	const combinedSignal = AbortSignal.any([controller.signal, timeoutSignal]);

	try {
		const vibe = await generateVibe(prompt, combinedSignal);

		// Only update if still streaming and THIS generation wasn't aborted
		if (isStreaming && !controller.signal.aborted) {
			trackRecentVibe(vibe);
			setMessage(vibe, setWorkingMessage);
		}
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			console.debug("[working-vibes] Generation aborted");
		} else {
			console.debug("[working-vibes] Generation failed:", error);
		}
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Exported API
// ═══════════════════════════════════════════════════════════════════════════

/** Initialize vibe manager with extension context and parsed config. */
export function initVibeManager(
	ctx: ExtensionContext,
	vibeConfig: VibeConfig,
): void {
	extensionCtx = ctx;
	config = vibeConfig;
	rebuildPicker();
}

/** Update config (e.g. after settings change). Rebuilds pack picker. */
export function updateVibeConfig(vibeConfig: VibeConfig): void {
	config = vibeConfig;
	rebuildPicker();
}

/** Get current config (null before init). */
export function getVibeConfig(): VibeConfig | null {
	return config;
}

/**
 * Full cleanup: abort generation, stop animation, reset streaming state.
 * Pass setWorkingMessage to restore default working message.
 */
export function disposeVibeManager(
	setWorkingMessage?: (msg?: string) => void,
): void {
	currentGeneration?.abort();
	currentGeneration = null;
	animation?.stop();
	animation = null;
	animationSetWorkingMessage = null;
	isStreaming = false;
	recentVibes = [];
	if (setWorkingMessage) {
		setWorkingMessage(undefined);
	}
}

/**
 * Called on before_agent_start. Sets initial vibe message.
 * Skips when disabled. Pack source picks immediately; generated source
 * shows placeholder then fires async generation.
 */
export function onVibeBeforeAgentStart(
	prompt: string,
	setWorkingMessage: (msg?: string) => void,
): void {
	if (!config?.enabled || !extensionCtx) return;

	lastVibeTime = Date.now();

	if (config.source === "packs") {
		const message = picker?.next();
		if (message) {
			setMessage(message, setWorkingMessage);
		}
	} else {
		// Generated source: placeholder then async
		setMessage("Vibing...", setWorkingMessage);
		generateAndUpdate(prompt, setWorkingMessage);
	}
}

/** Called on agent_start. Marks streaming active. */
export function onVibeAgentStart(): void {
	isStreaming = true;
}

/**
 * Called on `tool_call`. Refreshes vibe message (rate-limited by `refreshInterval` seconds).
 * Skips when disabled or not streaming. For generated source, builds a context hint
 * from the tool name/input or recent agent context.
 */
export function onVibeToolCall(
	toolName: string,
	toolInput: Record<string, unknown>,
	setWorkingMessage: (msg?: string) => void,
	agentContext?: string,
): void {
	if (!config?.enabled || !extensionCtx || !isStreaming) return;

	// Rate limit
	const now = Date.now();
	if (now - lastVibeTime < config.generated.refreshInterval * 1000) return;
	lastVibeTime = now;

	if (config.source === "packs") {
		const message = picker?.next();
		if (message) {
			setMessage(message, setWorkingMessage);
		}
	} else {
		// Generated source: build hint from tool context
		let hint: string;
		if (agentContext && agentContext.length > 10) {
			hint = agentContext.slice(0, 150);
		} else {
			hint = `using ${toolName} tool`;
			if (toolName === "read" && toolInput.path) {
				hint = `reading file: ${toolInput.path}`;
			} else if (toolName === "write" && toolInput.path) {
				hint = `writing file: ${toolInput.path}`;
			} else if (toolName === "edit" && toolInput.path) {
				hint = `editing file: ${toolInput.path}`;
			} else if (toolName === "bash" && toolInput.command) {
				hint = `running command: ${String(toolInput.command).slice(0, 40)}`;
			}
		}
		generateAndUpdate(hint, setWorkingMessage);
	}
}

/**
 * Called on `agent_end`. Full cleanup regardless of enabled state:
 * stops streaming flag, aborts generation, stops animation, resets working message.
 */
export function onVibeAgentEnd(
	setWorkingMessage: (msg?: string) => void,
): void {
	isStreaming = false;
	currentGeneration?.abort();
	currentGeneration = null;
	animation?.stop();
	animation = null;
	animationSetWorkingMessage = null;
	// Explicit reset — idempotent with animation.stop() internal reset
	setWorkingMessage(undefined);
}
