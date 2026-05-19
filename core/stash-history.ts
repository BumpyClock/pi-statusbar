/**
 * Stash history persistence and recent project prompt scanning.
 * Handles filesystem I/O for stash history and session file reading.
 */

import {
	readFileSync,
	writeFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

import {
	isRecord,
	normalizeStashHistoryEntries,
	getPromptHistoryText,
	hasNonWhitespaceText,
} from "./stash-helpers.ts";

export function getStashHistoryPath(): string {
	const homeDir = process.env.HOME || process.env.USERPROFILE || homedir();
	return join(homeDir, ".pi", "agent", "pi-statusbar", "stash-history.json");
}

export function getSessionsPath(): string {
	const homeDir = process.env.HOME || process.env.USERPROFILE || homedir();
	return join(homeDir, ".pi", "agent", "sessions");
}

export function getProjectSessionsPath(cwd: string): string {
	const projectKey = cwd
		.replace(/^[/\\]+|[/\\]+$/g, "")
		.replace(/:/g, "-")
		.replace(/[\\/]+/g, "-");

	return join(getSessionsPath(), `--${projectKey}--`);
}

export function readRecentProjectPrompts(cwd: string, limit: number): string[] {
	const maxEntries = Math.max(0, Math.floor(limit));
	if (maxEntries === 0) return [];

	const sessionsPath = getProjectSessionsPath(cwd);
	if (!existsSync(sessionsPath)) {
		return [];
	}

	const promptEntries: { text: string; timestamp: number }[] = [];
	let fileNames: string[];
	try {
		fileNames = readdirSync(sessionsPath).filter((fileName) =>
			fileName.endsWith(".jsonl"),
		);
	} catch (error) {
		console.debug(
			`[pi-statusbar] Failed to read sessions dir ${sessionsPath}:`,
			error,
		);
		return [];
	}

	for (const fileName of fileNames) {
		const filePath = join(sessionsPath, fileName);
		let lines: string[];
		try {
			lines = readFileSync(filePath, "utf-8").split("\n");
		} catch (error) {
			console.debug(
				`[pi-statusbar] Failed to read session file ${filePath}:`,
				error,
			);
			continue;
		}

		for (let i = lines.length - 1; i >= 0; i--) {
			const line = lines[i];
			if (!line?.trim()) {
				continue;
			}

			let entry: unknown;
			try {
				entry = JSON.parse(line);
			} catch (error) {
				console.debug(
					`[pi-statusbar] Skipping malformed line in ${filePath}:`,
					error,
				);
				continue;
			}

			if (
				!isRecord(entry) ||
				entry.type !== "message" ||
				!isRecord(entry.message) ||
				entry.message.role !== "user"
			) {
				continue;
			}

			const text = getPromptHistoryText(entry.message.content);
			if (!hasNonWhitespaceText(text)) {
				continue;
			}

			const timestamp =
				typeof entry.message.timestamp === "number"
					? entry.message.timestamp
					: typeof entry.timestamp === "string"
						? Date.parse(entry.timestamp)
						: 0;

			promptEntries.push({
				text,
				timestamp: Number.isFinite(timestamp) ? timestamp : 0,
			});
		}
	}

	promptEntries.sort((a, b) => b.timestamp - a.timestamp);

	const prompts: string[] = [];
	const seen = new Set<string>();
	for (const entry of promptEntries) {
		if (seen.has(entry.text)) {
			continue;
		}

		seen.add(entry.text);
		prompts.push(entry.text);
		if (prompts.length >= maxEntries) {
			return prompts;
		}
	}

	return prompts;
}

export function readPersistedStashHistory(limit: number): string[] {
	const maxEntries = Math.max(0, Math.floor(limit));
	if (maxEntries === 0) return [];

	const stashHistoryPath = getStashHistoryPath();

	try {
		if (!existsSync(stashHistoryPath)) {
			return [];
		}

		const parsed = JSON.parse(readFileSync(stashHistoryPath, "utf-8"));
		if (!isRecord(parsed)) {
			console.debug(
				`[pi-statusbar] Ignoring invalid stash history at ${stashHistoryPath}`,
			);
			return [];
		}

		return normalizeStashHistoryEntries(parsed.history, maxEntries);
	} catch (error) {
		console.debug(
			`[pi-statusbar] Failed to read stash history from ${stashHistoryPath}:`,
			error,
		);
		return [];
	}
}

export function persistStashHistory(history: string[], limit: number): void {
	const stashHistoryPath = getStashHistoryPath();
	const maxEntries = Math.max(0, Math.floor(limit));
	const payload = {
		version: 1,
		history: history.slice(0, maxEntries),
	};

	try {
		mkdirSync(dirname(stashHistoryPath), { recursive: true });
		writeFileSync(stashHistoryPath, JSON.stringify(payload, null, 2) + "\n");
	} catch (error) {
		console.debug(
			`[pi-statusbar] Failed to persist stash history to ${stashHistoryPath}:`,
			error,
		);
	}
}
