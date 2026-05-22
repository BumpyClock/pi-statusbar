import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
	getStashHistoryPath,
	getSessionsPath,
	getProjectSessionsPath,
	readPersistedStashHistory,
	persistStashHistory,
	readRecentProjectPrompts,
} from "../core/stash-history.ts";

const LIMIT = 12;

// ── path helpers ─────────────────────────────────────────────────────────

test("getStashHistoryPath returns path under .pi/agent/pi-statusbar", () => {
	const path = getStashHistoryPath();
	assert.ok(path.includes(".pi"), "should include .pi");
	assert.ok(path.includes("pi-statusbar"), "should include pi-statusbar");
	assert.ok(
		path.endsWith("stash-history.json"),
		"should end with stash-history.json",
	);
});

test("getSessionsPath returns path under .pi/agent/sessions", () => {
	const path = getSessionsPath();
	assert.ok(path.includes(".pi"), "should include .pi");
	assert.ok(path.endsWith("sessions"), "should end with sessions");
});

test("getProjectSessionsPath converts cwd to project key", () => {
	const path = getProjectSessionsPath("/Users/test/project");
	assert.ok(path.includes("--Users-test-project--"));
});

test("getProjectSessionsPath strips leading/trailing slashes", () => {
	const path1 = getProjectSessionsPath("/foo/bar/");
	const path2 = getProjectSessionsPath("/foo/bar");
	assert.ok(path1.includes("--foo-bar--"));
	assert.ok(path2.includes("--foo-bar--"));
});

test("getProjectSessionsPath mirrors Pi session key colon handling", () => {
	const path = getProjectSessionsPath("C:\\Users\\me\\proj");
	assert.ok(path.includes("--C--Users-me-proj--"));
});

// ── readPersistedStashHistory / persistStashHistory ──────────────────────

test("persistStashHistory + readPersistedStashHistory round-trip", (t) => {
	const originalHome = process.env.HOME;
	const tmpHome = join(
		tmpdir(),
		`pi-stash-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
	);
	process.env.HOME = tmpHome;

	t.after(() => {
		process.env.HOME = originalHome;
		try {
			rmSync(tmpHome, { recursive: true, force: true });
		} catch {
			/* cleanup */
		}
	});

	const history = ["entry-one", "entry-two", "entry-three"];
	persistStashHistory(history, LIMIT);

	const result = readPersistedStashHistory(LIMIT);
	assert.deepEqual(result, history);
});

test("readPersistedStashHistory returns empty when file missing", (t) => {
	const originalHome = process.env.HOME;
	const tmpHome = join(
		tmpdir(),
		`pi-stash-empty-${Date.now()}-${Math.random().toString(36).slice(2)}`,
	);
	process.env.HOME = tmpHome;

	t.after(() => {
		process.env.HOME = originalHome;
		try {
			rmSync(tmpHome, { recursive: true, force: true });
		} catch {
			/* cleanup */
		}
	});

	const result = readPersistedStashHistory(LIMIT);
	assert.deepEqual(result, []);
});

test("persistStashHistory respects limit", (t) => {
	const originalHome = process.env.HOME;
	const tmpHome = join(
		tmpdir(),
		`pi-stash-limit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
	);
	process.env.HOME = tmpHome;

	t.after(() => {
		process.env.HOME = originalHome;
		try {
			rmSync(tmpHome, { recursive: true, force: true });
		} catch {
			/* cleanup */
		}
	});

	const history = Array.from({ length: 20 }, (_, i) => `entry-${i}`);
	persistStashHistory(history, 5);

	const result = readPersistedStashHistory(5);
	assert.equal(result.length, 5);
	assert.deepEqual(result, [
		"entry-0",
		"entry-1",
		"entry-2",
		"entry-3",
		"entry-4",
	]);
});

// ── readRecentProjectPrompts ─────────────────────────────────────────────

test("readRecentProjectPrompts returns empty for non-existent project path", () => {
	const result = readRecentProjectPrompts("/nonexistent/xyz/abc", 50);
	assert.deepEqual(result, []);
});

test("readRecentProjectPrompts reads user messages from session files", (t) => {
	const originalHome = process.env.HOME;
	const tmpHome = join(
		tmpdir(),
		`pi-prompts-${Date.now()}-${Math.random().toString(36).slice(2)}`,
	);
	process.env.HOME = tmpHome;

	t.after(() => {
		process.env.HOME = originalHome;
		try {
			rmSync(tmpHome, { recursive: true, force: true });
		} catch {
			/* cleanup */
		}
	});

	const cwd = "/test/project";
	const sessionsPath = getProjectSessionsPath(cwd);
	mkdirSync(sessionsPath, { recursive: true });

	const sessionData = [
		JSON.stringify({
			type: "message",
			message: { role: "user", content: "first prompt", timestamp: 1000 },
		}),
		JSON.stringify({
			type: "message",
			message: { role: "user", content: "second prompt", timestamp: 2000 },
		}),
	].join("\n");

	writeFileSync(join(sessionsPath, "session-1.jsonl"), sessionData);

	const result = readRecentProjectPrompts(cwd, 50);
	// Sorted by timestamp descending
	assert.deepEqual(result, ["second prompt", "first prompt"]);
});

test("readRecentProjectPrompts deduplicates across sessions", (t) => {
	const originalHome = process.env.HOME;
	const tmpHome = join(
		tmpdir(),
		`pi-dedup-${Date.now()}-${Math.random().toString(36).slice(2)}`,
	);
	process.env.HOME = tmpHome;

	t.after(() => {
		process.env.HOME = originalHome;
		try {
			rmSync(tmpHome, { recursive: true, force: true });
		} catch {
			/* cleanup */
		}
	});

	const cwd = "/test/dedup";
	const sessionsPath = getProjectSessionsPath(cwd);
	mkdirSync(sessionsPath, { recursive: true });

	// Same prompt in two sessions
	const session1 = JSON.stringify({
		type: "message",
		message: { role: "user", content: "duplicate prompt", timestamp: 1000 },
	});
	const session2 = JSON.stringify({
		type: "message",
		message: { role: "user", content: "duplicate prompt", timestamp: 2000 },
	});

	writeFileSync(join(sessionsPath, "s1.jsonl"), session1);
	writeFileSync(join(sessionsPath, "s2.jsonl"), session2);

	const result = readRecentProjectPrompts(cwd, 50);
	assert.equal(result.length, 1);
	assert.equal(result[0], "duplicate prompt");
});

test("readRecentProjectPrompts respects limit", (t) => {
	const originalHome = process.env.HOME;
	const tmpHome = join(
		tmpdir(),
		`pi-limit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
	);
	process.env.HOME = tmpHome;

	t.after(() => {
		process.env.HOME = originalHome;
		try {
			rmSync(tmpHome, { recursive: true, force: true });
		} catch {
			/* cleanup */
		}
	});

	const cwd = "/test/limit";
	const sessionsPath = getProjectSessionsPath(cwd);
	mkdirSync(sessionsPath, { recursive: true });

	const lines = Array.from({ length: 10 }, (_, i) =>
		JSON.stringify({
			type: "message",
			message: { role: "user", content: `prompt-${i}`, timestamp: i * 1000 },
		}),
	).join("\n");

	writeFileSync(join(sessionsPath, "session.jsonl"), lines);

	const result = readRecentProjectPrompts(cwd, 3);
	assert.equal(result.length, 3);
});

test("readRecentProjectPrompts skips non-user messages", (t) => {
	const originalHome = process.env.HOME;
	const tmpHome = join(
		tmpdir(),
		`pi-skip-${Date.now()}-${Math.random().toString(36).slice(2)}`,
	);
	process.env.HOME = tmpHome;

	t.after(() => {
		process.env.HOME = originalHome;
		try {
			rmSync(tmpHome, { recursive: true, force: true });
		} catch {
			/* cleanup */
		}
	});

	const cwd = "/test/skip";
	const sessionsPath = getProjectSessionsPath(cwd);
	mkdirSync(sessionsPath, { recursive: true });

	const data = [
		JSON.stringify({
			type: "message",
			message: { role: "assistant", content: "not a user prompt" },
		}),
		JSON.stringify({
			type: "message",
			message: { role: "user", content: "real prompt", timestamp: 1000 },
		}),
		JSON.stringify({
			type: "tool_call",
			toolName: "bash",
		}),
	].join("\n");

	writeFileSync(join(sessionsPath, "s.jsonl"), data);

	const result = readRecentProjectPrompts(cwd, 50);
	assert.deepEqual(result, ["real prompt"]);
});
