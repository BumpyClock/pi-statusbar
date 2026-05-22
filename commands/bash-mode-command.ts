// ═══════════════════════════════════════════════════════════════════════════
// /bash-mode command handler
// ═══════════════════════════════════════════════════════════════════════════

/** Minimal context shape needed by the /bash-mode command. */
export interface BashModeCommandContext {
	ui: { notify: (message: string, level: string) => void };
}

export interface BashModeCommandDeps {
	setBashModeActive: (value: boolean, ctx: BashModeCommandContext) => Promise<void>;
	isBashModeActive: () => boolean;
}

/**
 * Create the `/bash-mode` command handler.
 *
 * Accepts: on, off, toggle (default).
 */
export function createBashModeCommandHandler(deps: BashModeCommandDeps) {
	return async (args: string | undefined, ctx: BashModeCommandContext): Promise<void> => {
		const mode = args?.trim().toLowerCase() || "toggle";
		if (mode === "on") {
			await deps.setBashModeActive(true, ctx);
			return;
		}
		if (mode === "off") {
			await deps.setBashModeActive(false, ctx);
			return;
		}
		if (mode === "toggle") {
			await deps.setBashModeActive(!deps.isBashModeActive(), ctx);
			return;
		}
		ctx.ui.notify("Usage: /bash-mode [on|off|toggle]", "warning");
	};
}
