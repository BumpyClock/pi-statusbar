import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
	getSettingsPath,
	getProjectSettingsPath,
	getGlobalCompactionPolicyPath,
	getCustomCompactionExtensionPath,
	readSettingsFile,
	readWritableSettingsFile,
	readCompactionPolicyEnabled,
	readSettings,
	writeStatusbarSetting,
} from "../core/statusbar-settings.ts";

// ═══════════════════════════════════════════════════════════════════════════
// Path helpers
// ═══════════════════════════════════════════════════════════════════════════

test("getSettingsPath returns global settings.json under .pi/agent", () => {
	const p = getSettingsPath();
	assert.ok(p.endsWith(join(".pi", "agent", "settings.json")));
});

test("getProjectSettingsPath returns .pi/settings.json under cwd", () => {
	const p = getProjectSettingsPath("/tmp/myproject");
	assert.equal(p, join("/tmp/myproject", ".pi", "settings.json"));
});

test("getGlobalCompactionPolicyPath returns compaction-policy.json", () => {
	const p = getGlobalCompactionPolicyPath();
	assert.ok(p.endsWith(join(".pi", "agent", "compaction-policy.json")));
});

test("getCustomCompactionExtensionPath returns pi-custom-compaction dir", () => {
	const p = getCustomCompactionExtensionPath();
	assert.ok(p.endsWith(join("extensions", "pi-custom-compaction")));
});

// ═══════════════════════════════════════════════════════════════════════════
// readSettingsFile
// ═══════════════════════════════════════════════════════════════════════════

test("readSettingsFile returns {} for missing file", () => {
	const result = readSettingsFile("/nonexistent/path/settings.json");
	assert.deepEqual(result, {});
});

test("readSettingsFile returns parsed object", () => {
	const dir = join(tmpdir(), `pi-test-rsf-${Date.now()}`);
	mkdirSync(dir, { recursive: true });
	const file = join(dir, "settings.json");
	writeFileSync(file, JSON.stringify({ statusbar: "compact" }));
	try {
		const result = readSettingsFile(file);
		assert.deepEqual(result, { statusbar: "compact" });
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("readSettingsFile returns {} for non-object JSON", () => {
	const dir = join(tmpdir(), `pi-test-rsf-arr-${Date.now()}`);
	mkdirSync(dir, { recursive: true });
	const file = join(dir, "settings.json");
	writeFileSync(file, "[1,2,3]");
	try {
		const result = readSettingsFile(file);
		assert.deepEqual(result, {});
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("readSettingsFile returns {} for malformed JSON", () => {
	const dir = join(tmpdir(), `pi-test-rsf-bad-${Date.now()}`);
	mkdirSync(dir, { recursive: true });
	const file = join(dir, "settings.json");
	writeFileSync(file, "{bad json");
	try {
		const result = readSettingsFile(file);
		assert.deepEqual(result, {});
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

// ═══════════════════════════════════════════════════════════════════════════
// readWritableSettingsFile
// ═══════════════════════════════════════════════════════════════════════════

test("readWritableSettingsFile returns {} for missing file", () => {
	const result = readWritableSettingsFile("/nonexistent/path/settings.json");
	assert.deepEqual(result, {});
});

test("readWritableSettingsFile returns null for non-object JSON", () => {
	const dir = join(tmpdir(), `pi-test-rwsf-${Date.now()}`);
	mkdirSync(dir, { recursive: true });
	const file = join(dir, "settings.json");
	writeFileSync(file, '"just a string"');
	try {
		const result = readWritableSettingsFile(file);
		assert.equal(result, null);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("readWritableSettingsFile returns null for malformed JSON", () => {
	const dir = join(tmpdir(), `pi-test-rwsf-bad-${Date.now()}`);
	mkdirSync(dir, { recursive: true });
	const file = join(dir, "settings.json");
	writeFileSync(file, "not json");
	try {
		const result = readWritableSettingsFile(file);
		assert.equal(result, null);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

// ═══════════════════════════════════════════════════════════════════════════
// readCompactionPolicyEnabled
// ═══════════════════════════════════════════════════════════════════════════

test("readCompactionPolicyEnabled returns undefined for missing file", () => {
	assert.equal(readCompactionPolicyEnabled("/nonexistent"), undefined);
});

test("readCompactionPolicyEnabled returns true when enabled", () => {
	const dir = join(tmpdir(), `pi-test-comp-${Date.now()}`);
	mkdirSync(dir, { recursive: true });
	const file = join(dir, "compaction-policy.json");
	writeFileSync(file, JSON.stringify({ enabled: true }));
	try {
		assert.equal(readCompactionPolicyEnabled(file), true);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("readCompactionPolicyEnabled returns false when disabled", () => {
	const dir = join(tmpdir(), `pi-test-comp-dis-${Date.now()}`);
	mkdirSync(dir, { recursive: true });
	const file = join(dir, "compaction-policy.json");
	writeFileSync(file, JSON.stringify({ enabled: false }));
	try {
		assert.equal(readCompactionPolicyEnabled(file), false);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("readCompactionPolicyEnabled returns false for non-boolean enabled", () => {
	const dir = join(tmpdir(), `pi-test-comp-nb-${Date.now()}`);
	mkdirSync(dir, { recursive: true });
	const file = join(dir, "compaction-policy.json");
	writeFileSync(file, JSON.stringify({ enabled: "yes" }));
	try {
		assert.equal(readCompactionPolicyEnabled(file), false);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

// ═══════════════════════════════════════════════════════════════════════════
// writeStatusbarSetting
// ═══════════════════════════════════════════════════════════════════════════

test("writeStatusbarSetting writes to global settings by default", () => {
	const dir = join(tmpdir(), `pi-test-wss-${Date.now()}`);
	const globalDir = join(dir, "global", ".pi", "agent");
	const projectDir = join(dir, "project");
	mkdirSync(globalDir, { recursive: true });
	mkdirSync(join(projectDir, ".pi"), { recursive: true });

	// Write initial global settings
	writeFileSync(
		join(globalDir, "settings.json"),
		JSON.stringify({ other: true }),
	);

	// Patch HOME so getSettingsPath() resolves here
	const origHome = process.env.HOME;
	process.env.HOME = join(dir, "global");
	try {
		const result = writeStatusbarSetting(projectDir, () => "compact");
		assert.equal(result, true);

		const written = JSON.parse(
			readFileSync(
				join(globalDir, "settings.json"),
				"utf-8",
			),
		);
		assert.equal(written.other, true);
		assert.equal(written.statusbar, "compact");
	} finally {
		process.env.HOME = origHome;
		rmSync(dir, { recursive: true, force: true });
	}
});

test("writeStatusbarSetting writes to project when project has statusbar key", () => {
	const dir = join(tmpdir(), `pi-test-wss-proj-${Date.now()}`);
	const globalDir = join(dir, "global", ".pi", "agent");
	const projectDir = join(dir, "project");
	mkdirSync(globalDir, { recursive: true });
	mkdirSync(join(projectDir, ".pi"), { recursive: true });

	writeFileSync(
		join(globalDir, "settings.json"),
		JSON.stringify({ other: true }),
	);
	writeFileSync(
		join(projectDir, ".pi", "settings.json"),
		JSON.stringify({ statusbar: { preset: "compact" } }),
	);

	const origHome = process.env.HOME;
	process.env.HOME = join(dir, "global");
	try {
		const result = writeStatusbarSetting(projectDir, (existing) => ({
			...(typeof existing === "object" && existing !== null ? existing : {}),
			mouseScroll: false,
		}));
		assert.equal(result, true);

		const written = JSON.parse(
			readFileSync(
				join(projectDir, ".pi", "settings.json"),
				"utf-8",
			),
		);
		assert.equal(written.statusbar.preset, "compact");
		assert.equal(written.statusbar.mouseScroll, false);
	} finally {
		process.env.HOME = origHome;
		rmSync(dir, { recursive: true, force: true });
	}
});

test("writeStatusbarSetting returns false for malformed settings file", () => {
	const dir = join(tmpdir(), `pi-test-wss-bad-${Date.now()}`);
	const globalDir = join(dir, "global", ".pi", "agent");
	mkdirSync(globalDir, { recursive: true });
	writeFileSync(join(globalDir, "settings.json"), "not json");

	const origHome = process.env.HOME;
	process.env.HOME = join(dir, "global");
	try {
		const result = writeStatusbarSetting("/tmp/nonexistent-project", () => "x");
		assert.equal(result, false);
	} finally {
		process.env.HOME = origHome;
		rmSync(dir, { recursive: true, force: true });
	}
});

// ═══════════════════════════════════════════════════════════════════════════
// readSettings (merges global + project)
// ═══════════════════════════════════════════════════════════════════════════

test("readSettings merges global and project settings", () => {
	const dir = join(tmpdir(), `pi-test-rs-${Date.now()}`);
	const globalDir = join(dir, "global", ".pi", "agent");
	const projectDir = join(dir, "project");
	mkdirSync(globalDir, { recursive: true });
	mkdirSync(join(projectDir, ".pi"), { recursive: true });

	writeFileSync(
		join(globalDir, "settings.json"),
		JSON.stringify({ statusbar: { preset: "default", mouseScroll: true } }),
	);
	writeFileSync(
		join(projectDir, ".pi", "settings.json"),
		JSON.stringify({ statusbar: { preset: "compact" } }),
	);

	const origHome = process.env.HOME;
	process.env.HOME = join(dir, "global");
	try {
		const result = readSettings(projectDir);
		const sb = result.statusbar as Record<string, unknown>;
		assert.equal(sb.preset, "compact");
		assert.equal(sb.mouseScroll, true); // deep-merged from global
	} finally {
		process.env.HOME = origHome;
		rmSync(dir, { recursive: true, force: true });
	}
});
