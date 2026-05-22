import type { StatusbarConfig } from "../statusbar/config.ts";
import { PRESETS } from "../statusbar/presets.ts";
import {
	writeStatusbarPresetSetting,
	writeStatusbarOptionSetting,
} from "../core/statusbar-settings.ts";

// ═══════════════════════════════════════════════════════════════════════════
// /statusbar command handler
// ═══════════════════════════════════════════════════════════════════════════

/** Minimal context shape needed by the /statusbar command. */
export interface StatusbarCommandContext {
	cwd: string;
	hasUI?: boolean;
	ui: {
		notify: (message: string, level: string) => void;
		setStatus: (key: string, value: unknown) => void;
		setEditorComponent: (component: unknown) => void;
		setFooter: (footer: unknown) => void;
		setHeader: (header: unknown) => void;
		setWidget: (id: string, widget: unknown) => void;
	};
}

export interface StatusbarCommandDeps {
	isEnabled: () => boolean;
	getConfig: () => StatusbarConfig;

	/** Toggle enabled/disabled. Handles all state teardown/setup internally. */
	toggleStatusbar: (ctx: StatusbarCommandContext) => void;

	/** Apply a mouse-scroll config change and reinstall compositor if needed. */
	applyMouseScroll: (value: boolean, ctx: StatusbarCommandContext) => void;

	/** Apply a fixed-editor config change and reinstall editor if needed. */
	applyFixedEditor: (value: boolean, ctx: StatusbarCommandContext) => void;

	/** Apply a preset change, reset layout, and reinstall editor if needed. */
	applyPreset: (preset: string, ctx: StatusbarCommandContext) => void;

	/** Set currentCtx from the command context. */
	setCurrentCtx: (ctx: StatusbarCommandContext) => void;
}

function isValidPreset(value: string, config: StatusbarConfig): boolean {
	return Object.hasOwn(PRESETS, value) || Object.hasOwn(config.presets, value);
}

export function normalizePreset(
	value: unknown,
	config: StatusbarConfig,
): string | null {
	if (typeof value !== "string") {
		return null;
	}

	const preset = value.trim();
	if (isValidPreset(preset, config)) return preset;

	const builtInPreset = preset.toLowerCase();
	return Object.hasOwn(PRESETS, builtInPreset) ? builtInPreset : null;
}

/** Notify with persistence status. */
function notifyOption(
	ctx: StatusbarCommandContext,
	persisted: boolean,
	message: string,
): void {
	if (persisted) {
		ctx.ui.notify(message, "info");
	} else {
		ctx.ui.notify(`${message} (not persisted; check settings.json)`, "warning");
	}
}

/**
 * Create the `/statusbar` command handler.
 *
 * Subcommands: (none = toggle), mouse-scroll, fixed-editor, <preset-name>.
 */
export function createStatusbarCommandHandler(deps: StatusbarCommandDeps) {
	return async (
		args: string | undefined,
		ctx: StatusbarCommandContext,
	): Promise<void> => {
		deps.setCurrentCtx(ctx);

		if (!args?.trim()) {
			deps.toggleStatusbar(ctx);
			return;
		}

		const config = deps.getConfig();
		const normalizedArgs = args.trim().toLowerCase();

		// /statusbar mouse-scroll [on|off|toggle]
		const mouseScrollMatch = normalizedArgs.match(
			/^mouse-scroll(?:\s+(on|off|toggle))?$/,
		);
		if (mouseScrollMatch) {
			const mode = mouseScrollMatch[1] ?? "toggle";
			const newValue = mode === "toggle" ? !config.mouseScroll : mode === "on";
			deps.applyMouseScroll(newValue, ctx);

			const persisted = writeStatusbarOptionSetting(
				ctx.cwd,
				{ mouseScroll: newValue },
				config.preset,
			);
			notifyOption(
				ctx,
				persisted,
				`Statusbar mouse scroll ${newValue ? "enabled" : "disabled"}`,
			);
			return;
		}

		// /statusbar fixed-editor [on|off|toggle]
		const fixedEditorMatch = normalizedArgs.match(
			/^fixed-editor(?:\s+(on|off|toggle))?$/,
		);
		if (fixedEditorMatch) {
			const mode = fixedEditorMatch[1] ?? "toggle";
			const newValue = mode === "toggle" ? !config.fixedEditor : mode === "on";
			deps.applyFixedEditor(newValue, ctx);

			const persisted = writeStatusbarOptionSetting(
				ctx.cwd,
				{ fixedEditor: newValue },
				config.preset,
			);
			notifyOption(
				ctx,
				persisted,
				`Statusbar fixed editor ${newValue ? "enabled" : "disabled"}`,
			);
			return;
		}

		// /statusbar <preset-name>
		const preset = normalizePreset(args, config);
		if (preset) {
			deps.applyPreset(preset, ctx);

			const persisted = writeStatusbarPresetSetting(preset, ctx.cwd);
			notifyOption(ctx, persisted, `Preset set to: ${preset}`);
			return;
		}

		// Show available presets
		const builtInNames = Object.keys(PRESETS);
		const userNames = Object.keys(config.presets).filter(
			(n) => !builtInNames.includes(n),
		);
		const presetList = [...builtInNames, ...userNames].join(", ");
		ctx.ui.notify(`Available presets: ${presetList}`, "info");
	};
}
