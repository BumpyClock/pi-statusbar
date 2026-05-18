/**
 * @module vibe-animation
 *
 * Shimmer animation for working-vibes status messages.
 * Ported from the whimsical extension; fully standalone (no extension lifecycle).
 *
 * A bright window of 256-color ANSI sweeps back and forth across dim base text.
 * Message transitions use a shrink-then-grow character effect.
 *
 * Frame timing is derived from {@link SHIMMER_DEFAULTS.SHIMMER_INTERVAL_MS};
 * all other durations are converted to frame counts at controller creation.
 */

/**
 * Timing and rendering constants. Exported so tests can reason about
 * behaviour without real sleeps.
 */
export const SHIMMER_DEFAULTS = {
	SHIMMER_BASE: 244, // medium gray (256-color)
	SHIMMER_PEAK: 255, // near-white
	SHIMMER_WINDOW: 6, // radius of bright window in chars
	SHIMMER_INTERVAL_MS: 70, // ms between frames
	SHIMMER_STEP: 1, // chars advanced per frame
	MESSAGE_HOLD_MS: 6400, // hold before auto-transition
	MESSAGE_TRANSITION_MS: 980, // exit+enter duration
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// Pure Functions
// ═══════════════════════════════════════════════════════════════════════════

function splitChars(text: string): string[] {
	return Array.from(text);
}

/**
 * Build shimmer effect: a bright window of 256-color ANSI moves across dim
 * base text. Spaces pass through uncolored. Ends with foreground reset.
 */
export function buildShimmer(text: string, shimmerHead: number): string {
	const chars = splitChars(text);
	if (chars.length === 0) return text;

	const { SHIMMER_BASE, SHIMMER_PEAK, SHIMMER_WINDOW } = SHIMMER_DEFAULTS;
	let out = "";
	for (let i = 0; i < chars.length; i++) {
		const ch = chars[i]!;
		if (ch === " ") {
			out += ch;
			continue;
		}
		const d = Math.abs(i - shimmerHead);
		let level: number;
		if (d > SHIMMER_WINDOW) {
			level = SHIMMER_BASE;
		} else {
			const t = 1 - d / SHIMMER_WINDOW;
			level = Math.round(SHIMMER_BASE + (SHIMMER_PEAK - SHIMMER_BASE) * t);
		}
		out += `\x1b[38;5;${level}m${ch}`;
	}
	return `${out}\x1b[39m`;
}

/**
 * Transition between messages: exit phase shrinks `from`, enter phase
 * grows `to`. Frame counts split evenly across totalFrames.
 */
export function transitionMessages(
	from: string,
	to: string,
	frame: number,
	totalFrames?: number,
): string {
	const total =
		totalFrames ??
		Math.max(
			1,
			Math.round(
				SHIMMER_DEFAULTS.MESSAGE_TRANSITION_MS /
					SHIMMER_DEFAULTS.SHIMMER_INTERVAL_MS,
			),
		);

	const fromChars = splitChars(from);
	const toChars = splitChars(to);
	const exitFrames = Math.max(1, Math.floor(total / 2));
	const enterFrames = Math.max(1, total - exitFrames);

	if (frame < exitFrames) {
		const progress = Math.min(1, (frame + 1) / exitFrames);
		const visibleCount = Math.ceil(fromChars.length * (1 - progress));
		return fromChars.slice(0, visibleCount).join("").trimEnd();
	}

	const enterFrame = frame - exitFrames;
	const progress = Math.min(1, (enterFrame + 1) / enterFrames);
	const visibleCount = Math.ceil(toChars.length * progress);
	return toChars.slice(0, visibleCount).join("").trimEnd();
}

/**
 * Strip ANSI escape sequences from text. Test helper for asserting
 * visible content of shimmer output.
 */
export function stripAnsiForVibeTest(text: string): string {
	return text.replace(/\x1b\[[0-9;]*m/g, "");
}

// ═══════════════════════════════════════════════════════════════════════════
// Animation Controller
// ═══════════════════════════════════════════════════════════════════════════

/** Callback to set/clear the working message in the footer. */
export interface AnimationDeps {
	setWorkingMessage(message?: string): void;
	/** Override shimmer tick interval (ms). Default: SHIMMER_DEFAULTS.SHIMMER_INTERVAL_MS */
	intervalMs?: number;
}

/**
 * Controller returned by {@link createVibeAnimationController}.
 *
 * Lifecycle: `start(msg)` → optional `updateMessage(msg)` → `stop()`.
 * `stop()` clears the timer and calls `setWorkingMessage(undefined)` to restore default.
 */
export interface VibeAnimationController {
	/** Start shimmer animation with given message. Restarts if already running. */
	start(message: string): void;
	/** Queue transition to a new message. No-op if not running. */
	updateMessage(message: string): void;
	/** Stop animation, clear timer, restore default working message. Idempotent. */
	stop(): void;
	/** Whether animation loop is active. */
	isRunning(): boolean;
}

/**
 * Create an animation controller wired to `deps.setWorkingMessage`.
 *
 * Frame counts for hold/transition are computed once from the defaults
 * and the active `intervalMs`. After `stop()`, call `start()` again to restart.
 */
export function createVibeAnimationController(
	deps: AnimationDeps,
): VibeAnimationController {
	const {
		SHIMMER_WINDOW,
		SHIMMER_STEP,
		SHIMMER_INTERVAL_MS,
		MESSAGE_HOLD_MS,
		MESSAGE_TRANSITION_MS,
	} = SHIMMER_DEFAULTS;

	const intervalMs = deps.intervalMs ?? SHIMMER_INTERVAL_MS;

	// Compute frame counts from the active interval
	const messageHoldFrames = Math.max(
		1,
		Math.round(MESSAGE_HOLD_MS / intervalMs),
	);
	const messageTransitionFrames = Math.max(
		1,
		Math.round(MESSAGE_TRANSITION_MS / intervalMs),
	);

	// ── mutable animation state ──
	let timer: ReturnType<typeof setInterval> | undefined;
	let currentMessage = "";
	let nextMessage: string | undefined;
	let transitionFrame = 0;
	let holdFramesRemaining = messageHoldFrames;
	let shimmerHead = -SHIMMER_WINDOW;
	let shimmerDirection: 1 | -1 = 1;

	const getDisplayMessage = (): string =>
		nextMessage === undefined
			? currentMessage
			: transitionMessages(
					currentMessage,
					nextMessage,
					transitionFrame,
					messageTransitionFrames,
				);

	const resetShimmer = (): void => {
		shimmerHead = -SHIMMER_WINDOW;
		shimmerDirection = 1;
	};

	const advanceShimmer = (message: string): void => {
		const chars = splitChars(message);
		if (chars.length === 0) {
			resetShimmer();
			return;
		}

		const minHead = -SHIMMER_WINDOW;
		const maxHead = chars.length - 1 + SHIMMER_WINDOW;
		shimmerHead += shimmerDirection * SHIMMER_STEP;

		if (shimmerHead >= maxHead) {
			shimmerHead = maxHead;
			shimmerDirection = -1;
		} else if (shimmerHead <= minHead) {
			shimmerHead = minHead;
			shimmerDirection = 1;
		}
	};

	const advanceMessage = (): void => {
		if (nextMessage !== undefined) {
			transitionFrame += 1;
			if (transitionFrame >= messageTransitionFrames) {
				currentMessage = nextMessage;
				nextMessage = undefined;
				transitionFrame = 0;
				holdFramesRemaining = messageHoldFrames;
			}
			return;
		}

		// No auto-advance to random message — consumer calls updateMessage().
		// Hold counter still decrements for timing consistency.
		if (holdFramesRemaining > 0) {
			holdFramesRemaining -= 1;
		}
	};

	const renderFrame = (): void => {
		const displayMessage = getDisplayMessage();
		deps.setWorkingMessage(buildShimmer(displayMessage, shimmerHead));
		advanceShimmer(displayMessage);
		advanceMessage();
	};

	const stopTimer = (): void => {
		if (timer !== undefined) {
			clearInterval(timer);
			timer = undefined;
		}
	};

	return {
		start(message: string): void {
			stopTimer();

			currentMessage = message;
			nextMessage = undefined;
			transitionFrame = 0;
			holdFramesRemaining = messageHoldFrames;
			resetShimmer();

			// Render first frame immediately (matches whimsical extension behavior)
			renderFrame();

			timer = setInterval(() => {
				try {
					renderFrame();
				} catch (error) {
					console.error("[pi-statusbar] Vibe animation frame failed:", error);
					stopTimer();
				}
			}, intervalMs);
		},

		updateMessage(message: string): void {
			if (timer === undefined) return; // not running
			nextMessage = message;
			transitionFrame = 0;
		},

		stop(): void {
			stopTimer();
			deps.setWorkingMessage(undefined);
		},

		isRunning(): boolean {
			return timer !== undefined;
		},
	};
}
