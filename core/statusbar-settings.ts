/**
 * Settings and config persistence helpers extracted from index.ts.
 *
 * Handles settings-file paths, read/write, compaction-policy detection,
 * and high-level statusbar setting mutators.
 */

import {
	readFileSync,
	writeFileSync,
	existsSync,
	mkdirSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

import { isRecord } from "./stash-helpers.ts";
import { mergeSettings } from "./settings-merge.ts";
import {
	nextStatusbarSettingWithPreset,
	nextStatusbarSettingWithOptions,
} from "../statusbar/config.ts";
import type { StatusbarConfig } from "../statusbar/config.ts";

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// Paths
// ═══════════════════════════════════════════════════════════════════════════

export function getSettingsPath(): string {
	const homeDir = process.env.HOME || process.env.USERPROFILE || homedir();
	return join(homeDir, ".pi", "agent", "settings.json");
}

export function getProjectSettingsPath(cwd: string): string {
	return join(cwd, ".pi", "settings.json");
}

export function getGlobalCompactionPolicyPath(): string {
	const homeDir = process.env.HOME || process.env.USERPROFILE || homedir();
	return join(homeDir, ".pi", "agent", "compaction-policy.json");
}

export function getCustomCompactionExtensionPath(): string {
	const homeDir = process.env.HOME || process.env.USERPROFILE || homedir();
	return join(homeDir, ".pi", "agent", "extensions", "pi-custom-compaction");
}

// ═══════════════════════════════════════════════════════════════════════════
// Low-level file read/write
// ═══════════════════════════════════════════════════════════════════════════

export function readSettingsFile(settingsPath: string): Record<string, unknown> {
	try {
		if (!existsSync(settingsPath)) {
			return {};
		}

		const parsed = JSON.parse(readFileSync(settingsPath, "utf-8"));
		if (!isRecord(parsed)) {
			console.debug(
				`[pi-statusbar] Ignoring non-object settings at ${settingsPath}`,
			);
			return {};
		}

		return parsed;
	} catch (error) {
		// Settings are user-edited input. Log and keep the extension running with defaults
		// instead of crashing the UI during startup.
		console.debug(
			`[pi-statusbar] Failed to read settings from ${settingsPath}:`,
			error,
		);
		return {};
	}
}

export function readWritableSettingsFile(
	settingsPath: string,
): Record<string, unknown> | null {
	if (!existsSync(settingsPath)) {
		return {};
	}

	try {
		const parsed = JSON.parse(readFileSync(settingsPath, "utf-8"));
		if (!isRecord(parsed)) {
			console.debug(
				`[pi-statusbar] Refusing to write settings to non-object file at ${settingsPath}`,
			);
			return null;
		}

		return parsed;
	} catch (error) {
		// Do not overwrite malformed user settings with partial data. Surface the failure
		// through the command handler so the user can fix the file intentionally.
		console.debug(
			`[pi-statusbar] Failed to parse settings at ${settingsPath}:`,
			error,
		);
		return null;
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Compaction policy
// ═══════════════════════════════════════════════════════════════════════════

export function readCompactionPolicyEnabled(configPath: string): boolean | undefined {
	if (!existsSync(configPath)) return undefined;
	try {
		const parsed = JSON.parse(readFileSync(configPath, "utf-8"));
		if (!isRecord(parsed) || typeof parsed.enabled !== "boolean") return false;
		return parsed.enabled;
	} catch (error) {
		console.debug(
			`[pi-statusbar] Failed to read compaction policy from ${configPath}:`,
			error,
		);
		return false;
	}
}

export function detectCustomCompactionEnabled(cwd: string): boolean {
	if (!existsSync(getCustomCompactionExtensionPath())) return false;

	const projectSetting = readCompactionPolicyEnabled(
		join(cwd, ".pi", "compaction-policy.json"),
	);
	if (projectSetting !== undefined) return projectSetting;

	return readCompactionPolicyEnabled(getGlobalCompactionPolicyPath()) ?? false;
}

// ═══════════════════════════════════════════════════════════════════════════
// High-level settings read/write
// ═══════════════════════════════════════════════════════════════════════════

export function readSettings(cwd: string = process.cwd()): Record<string, unknown> {
	return mergeSettings(
		readSettingsFile(getSettingsPath()),
		readSettingsFile(getProjectSettingsPath(cwd)),
	);
}

export function writeStatusbarSetting(
	cwd: string,
	update: (existingStatusbarSetting: unknown) => unknown,
): boolean {
	const globalSettingsPath = getSettingsPath();
	const projectSettingsPath = getProjectSettingsPath(cwd);
	const globalSettings = readWritableSettingsFile(globalSettingsPath);
	const projectSettings = readWritableSettingsFile(projectSettingsPath);

	if (globalSettings === null || projectSettings === null) {
		return false;
	}

	const writeToProject = Object.hasOwn(projectSettings, "statusbar");
	const settingsPath = writeToProject
		? projectSettingsPath
		: globalSettingsPath;
	const settings = writeToProject ? projectSettings : globalSettings;

	settings.statusbar = update(settings.statusbar);

	try {
		mkdirSync(dirname(settingsPath), { recursive: true });
		writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
		return true;
	} catch (error) {
		console.debug(
			`[pi-statusbar] Failed to persist statusbar setting to ${settingsPath}:`,
			error,
		);
		return false;
	}
}

export function writeStatusbarPresetSetting(
	preset: string,
	cwd: string = process.cwd(),
): boolean {
	return writeStatusbarSetting(cwd, (existingStatusbarSetting) =>
		nextStatusbarSettingWithPreset(existingStatusbarSetting, preset),
	);
}

export function writeStatusbarOptionSetting(
	cwd: string,
	updates: Partial<Pick<StatusbarConfig, "mouseScroll" | "fixedEditor">>,
	currentPreset: string,
): boolean {
	return writeStatusbarSetting(cwd, (existingStatusbarSetting) =>
		nextStatusbarSettingWithOptions(
			existingStatusbarSetting,
			updates,
			currentPreset,
		),
	);
}
