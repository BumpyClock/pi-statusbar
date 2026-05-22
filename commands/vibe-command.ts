import type { VibeConfig } from "../vibes/config.ts";
import { DEFAULT_GENERATED_VIBE_PROMPT } from "../vibes/config.ts";
import { BUILTIN_VIBE_PACKS, getBuiltinVibePackIds } from "../vibes/packs.ts";

// ═══════════════════════════════════════════════════════════════════════════
// /vibe command handler
// ═══════════════════════════════════════════════════════════════════════════

type VibeConfigUpdates = Partial<Omit<VibeConfig, "generated">> & {
	generated?: Partial<VibeConfig["generated"]>;
};

/** Minimal context shape needed by the /vibe command. */
export interface VibeCommandContext {
	cwd: string;
	ui: {
		notify: (message: string, level: string) => void;
		setWorkingMessage: (message: string | undefined) => void;
	};
}

export interface VibeCommandDeps {
	getVibeConfig: () => VibeConfig;
	writeVibeSettingAndUpdate: (
		cwd: string,
		updates: VibeConfigUpdates,
	) => boolean;
	disposeVibeManager: (
		setWorkingMessage?: (msg: string | undefined) => void,
	) => void;
}

/** Notify user of vibe command result with persistence status. */
export function notifyVibe(
	ctx: Pick<VibeCommandContext, "ui">,
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
 * Create the `/vibe` command handler.
 *
 * Subcommands: off, preset whimsical, source packs|generated, generate <theme>,
 * pack list|enable|disable|reset, safe on|off, animation shimmer|none.
 */
export function createVibeCommandHandler(deps: VibeCommandDeps) {
	return async (args: string | undefined, ctx: VibeCommandContext): Promise<void> => {
		const parts = args?.trim().split(/\s+/) || [];
		const subcommand = parts[0]?.toLowerCase() ?? "";

		// /vibe (no args): show current status
		if (!args || !args.trim()) {
			const v = deps.getVibeConfig();
			if (!v.enabled) {
				ctx.ui.notify("Vibe: off", "info");
				return;
			}
			const allPacks = getBuiltinVibePackIds();
			const enabledCount = allPacks.length - v.disabledPacks.length;
			let status = `Vibe: ${v.source} | Animation: ${v.animation} | Safe: ${v.safeMode ? "on" : "off"} | Packs: ${enabledCount}/${allPacks.length}`;
			if (v.source === "generated") {
				status += ` | Model: ${v.generated.model}`;
			}
			ctx.ui.notify(status, "info");
			return;
		}

		// /vibe off
		if (subcommand === "off") {
			const persisted = deps.writeVibeSettingAndUpdate(ctx.cwd, {
				enabled: false,
			});
			deps.disposeVibeManager(ctx.ui.setWorkingMessage);
			notifyVibe(ctx, persisted, "Vibe disabled");
			return;
		}

		// /vibe preset whimsical
		if (subcommand === "preset") {
			const presetName = parts[1]?.toLowerCase();
			if (presetName !== "whimsical") {
				ctx.ui.notify("Usage: /vibe preset whimsical", "error");
				return;
			}
			const persisted = deps.writeVibeSettingAndUpdate(ctx.cwd, {
				enabled: true,
				source: "packs",
				disabledPacks: [],
				safeMode: true,
				animation: "shimmer",
			});
			notifyVibe(ctx, persisted, "Vibe preset: whimsical");
			return;
		}

		// /vibe source packs|generated
		if (subcommand === "source") {
			const src = parts[1]?.toLowerCase();
			if (src !== "packs" && src !== "generated") {
				ctx.ui.notify("Usage: /vibe source packs|generated", "error");
				return;
			}
			const persisted = deps.writeVibeSettingAndUpdate(ctx.cwd, {
				enabled: true,
				source: src,
			});
			notifyVibe(ctx, persisted, `Vibe source: ${src}`);
			return;
		}

		// /vibe generate <theme>
		if (subcommand === "generate") {
			const theme = parts.slice(1).join(" ");
			if (!theme) {
				ctx.ui.notify("Usage: /vibe generate <theme>", "error");
				return;
			}
			const persisted = deps.writeVibeSettingAndUpdate(ctx.cwd, {
				enabled: true,
				source: "generated",
				generated: {
					prompt: DEFAULT_GENERATED_VIBE_PROMPT.replace(/\{theme\}/g, theme),
				},
			});
			notifyVibe(ctx, persisted, `Vibe generate theme: ${theme}`);
			return;
		}

		// /vibe pack list|enable|disable|reset
		if (subcommand === "pack") {
			const packCmd = parts[1]?.toLowerCase();

			if (packCmd === "list" || !packCmd) {
				const packs = BUILTIN_VIBE_PACKS;
				const disabled = new Set(deps.getVibeConfig().disabledPacks);
				const lines = packs.map(
					(p) =>
						`${disabled.has(p.id) ? "✗" : "✓"} ${p.id} (${p.label}, ${p.messages.length} msgs)`,
				);
				ctx.ui.notify(lines.join("\n"), "info");
				return;
			}

			if (packCmd === "disable") {
				const packId = parts[2]?.toLowerCase();
				const validIds = getBuiltinVibePackIds();
				if (!packId || !validIds.includes(packId)) {
					ctx.ui.notify(
						`Usage: /vibe pack disable <pack-id>\nAvailable: ${validIds.join(", ")}`,
						"error",
					);
					return;
				}
				const disabled = new Set(deps.getVibeConfig().disabledPacks);
				if (disabled.has(packId)) {
					ctx.ui.notify(`Pack "${packId}" already disabled`, "info");
					return;
				}
				const persisted = deps.writeVibeSettingAndUpdate(ctx.cwd, {
					disabledPacks: [...deps.getVibeConfig().disabledPacks, packId],
				});
				notifyVibe(ctx, persisted, `Pack disabled: ${packId}`);
				return;
			}

			if (packCmd === "enable") {
				const packId = parts[2]?.toLowerCase();
				const validIds = getBuiltinVibePackIds();
				if (!packId || !validIds.includes(packId)) {
					ctx.ui.notify(
						`Usage: /vibe pack enable <pack-id>\nAvailable: ${validIds.join(", ")}`,
						"error",
					);
					return;
				}
				const persisted = deps.writeVibeSettingAndUpdate(ctx.cwd, {
					disabledPacks: deps
						.getVibeConfig()
						.disabledPacks.filter((id) => id !== packId),
				});
				notifyVibe(ctx, persisted, `Pack enabled: ${packId}`);
				return;
			}

			if (packCmd === "reset") {
				const persisted = deps.writeVibeSettingAndUpdate(ctx.cwd, {
					disabledPacks: [],
				});
				notifyVibe(ctx, persisted, "All packs enabled");
				return;
			}

			ctx.ui.notify("Usage: /vibe pack [list|enable|disable|reset]", "error");
			return;
		}

		// /vibe safe on|off
		if (subcommand === "safe") {
			const mode = parts[1]?.toLowerCase();
			if (mode !== "on" && mode !== "off") {
				ctx.ui.notify("Usage: /vibe safe on|off", "error");
				return;
			}
			const persisted = deps.writeVibeSettingAndUpdate(ctx.cwd, {
				safeMode: mode === "on",
			});
			notifyVibe(ctx, persisted, `Safe mode: ${mode}`);
			return;
		}

		// /vibe animation shimmer|none
		if (subcommand === "animation") {
			const anim = parts[1]?.toLowerCase();
			if (anim !== "shimmer" && anim !== "none") {
				ctx.ui.notify("Usage: /vibe animation shimmer|none", "error");
				return;
			}
			const persisted = deps.writeVibeSettingAndUpdate(ctx.cwd, {
				animation: anim,
			});
			notifyVibe(ctx, persisted, `Vibe animation: ${anim}`);
			return;
		}

		// Legacy command redirects
		if (subcommand === "mode") {
			ctx.ui.notify(
				"/vibe mode removed. Use: /vibe source packs|generated",
				"warning",
			);
			return;
		}
		if (subcommand === "model") {
			ctx.ui.notify(
				"/vibe model removed. Edit statusbar.vibe.generated.model in settings.json",
				"warning",
			);
			return;
		}

		// Unknown subcommand
		ctx.ui.notify(
			"Usage: /vibe [off|preset|source|generate|pack|safe|animation]",
			"error",
		);
	};
}
