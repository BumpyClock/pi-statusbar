import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import type { VibeConfig } from "../vibes/config.ts";
import { BUILTIN_VIBE_PACKS, getUnsafeMessageTexts } from "../vibes/packs.ts";
import { getAllowedPackMessages, isUnsafeMessage } from "../vibes/picker.ts";
import {
	parseVibeConfig,
	nextVibeSetting,
	DEFAULT_GENERATED_VIBE_PROMPT,
} from "../vibes/config.ts";

const FAUX_PROVIDER_PATH = new URL(
	"../node_modules/@earendil-works/pi-ai/dist/providers/faux.js",
	import.meta.url,
).href;

function firstExistingPath(candidates: Array<string | undefined>): string {
	const found = candidates.find(
		(candidate) => candidate && existsSync(candidate),
	);
	if (!found) {
		throw new Error(
			`Unable to locate Pi package path from: ${candidates.join(", ")}`,
		);
	}
	return found;
}

function ensurePiModuleLinks(): { cleanup: () => void } {
	const nodeModulesDir = join(process.cwd(), "node_modules", "@earendil-works");
	mkdirSync(nodeModulesDir, { recursive: true });

	const piAgentPath = firstExistingPath([
		process.env.PI_AGENT_PATH,
		join(process.cwd(), "node_modules", "@earendil-works", "pi-coding-agent"),
		"/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent",
		"/usr/local/lib/node_modules/@earendil-works/pi-coding-agent",
		"/home/linuxbrew/.linuxbrew/lib/node_modules/@earendil-works/pi-coding-agent",
	]);
	const piAiPath = firstExistingPath([
		process.env.PI_AI_PATH,
		join(process.cwd(), "node_modules", "@earendil-works", "pi-ai"),
		join(piAgentPath, "node_modules", "@earendil-works", "pi-ai"),
	]);

	const links = [
		{
			link: join(nodeModulesDir, "pi-coding-agent"),
			target: piAgentPath,
		},
		{
			link: join(nodeModulesDir, "pi-ai"),
			target: piAiPath,
		},
	];

	const createdLinks: string[] = [];
	for (const { link, target } of links) {
		if (!existsSync(link)) {
			symlinkSync(target, link);
			createdLinks.push(link);
		}
	}

	return {
		cleanup() {
			for (const link of createdLinks.reverse()) {
				if (existsSync(link)) {
					rmSync(link, { recursive: true, force: true });
				}
			}
		},
	};
}

/** Build a VibeConfig for tests. Defaults to packs, animation=none. */
function testConfig(overrides: Partial<VibeConfig> = {}): VibeConfig {
	return {
		enabled: true,
		source: "packs",
		disabledPacks: [],
		safeMode: false,
		animation: "none",
		generated: {
			model: "test-provider/test-model",
			prompt:
				'Generate a 2-4 word "{theme}" themed loading message ending in "...". Task: {task} {exclude} Output only the message.',
			refreshInterval: 30,
		},
		...overrides,
	};
}

function makeFakeModelRegistry(model: unknown) {
	return {
		find(provider: string, modelId: string) {
			return provider === "test-provider" && modelId === "test-model"
				? model
				: undefined;
		},
		async getApiKeyAndHeaders() {
			return { ok: true, apiKey: "test-key", headers: {} };
		},
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Pack source
// ═══════════════════════════════════════════════════════════════════════════

test("pack source: safeMode=true never returns unsafe corpus messages", async () => {
	const {
		initVibeManager,
		onVibeBeforeAgentStart,
		onVibeAgentStart,
		disposeVibeManager,
	} = await import("../vibes/manager.ts");

	const cfg = testConfig({
		source: "packs",
		safeMode: true,
		animation: "none",
	});
	initVibeManager({ modelRegistry: makeFakeModelRegistry(null) } as any, cfg);
	onVibeAgentStart();

	const unsafeTexts = new Set(getUnsafeMessageTexts());
	assert.ok(
		unsafeTexts.size > 0,
		"test prerequisite: unsafe corpus must be non-empty",
	);

	// Sample many messages — none should be unsafe
	const messages: string[] = [];
	for (let i = 0; i < 100; i++) {
		onVibeBeforeAgentStart("task", (msg) => {
			if (msg !== undefined) messages.push(msg);
		});
	}

	for (const msg of messages) {
		assert.ok(
			!unsafeTexts.has(msg),
			`unsafe message leaked through safeMode: "${msg}"`,
		);
		assert.ok(
			!isUnsafeMessage({ text: msg }),
			`regex-detected unsafe message leaked: "${msg}"`,
		);
	}

	disposeVibeManager();
});

test("pack source: safeMode=false pool includes unsafe corpus messages", async () => {
	const { initVibeManager, onVibeAgentStart, disposeVibeManager } =
		await import("../vibes/manager.ts");

	const cfg = testConfig({
		source: "packs",
		safeMode: false,
		animation: "none",
	});
	initVibeManager({ modelRegistry: makeFakeModelRegistry(null) } as any, cfg);
	onVibeAgentStart();

	const unsafeTexts = new Set(getUnsafeMessageTexts());
	assert.ok(
		unsafeTexts.size > 0,
		"test prerequisite: unsafe corpus must be non-empty",
	);

	// Verify the pool actually includes unsafe messages when safeMode=false
	const allMessages = getAllowedPackMessages(BUILTIN_VIBE_PACKS, {
		disabledPacks: [],
		safeMode: false,
	}).map((m) => m.text);
	const unsafeInPool = allMessages.filter((t) => unsafeTexts.has(t));
	assert.ok(
		unsafeInPool.length > 0,
		"unsafe messages should be in pool when safeMode=false",
	);

	disposeVibeManager();
});

test("pack source: onVibeBeforeAgentStart sets a message from packs", async () => {
	const {
		initVibeManager,
		onVibeBeforeAgentStart,
		onVibeAgentStart,
		disposeVibeManager,
	} = await import("../vibes/manager.ts");

	const cfg = testConfig({ source: "packs", animation: "none" });
	initVibeManager({ modelRegistry: makeFakeModelRegistry(null) } as any, cfg);
	onVibeAgentStart();

	const updates: Array<string | undefined> = [];
	onVibeBeforeAgentStart("fix a bug", (msg) => updates.push(msg));

	assert.ok(updates.length > 0, "setWorkingMessage should be called");

	// Verify message is from the allowed pack pool
	const allMessages = getAllowedPackMessages(BUILTIN_VIBE_PACKS, {
		disabledPacks: [],
		safeMode: false,
	}).map((m) => m.text);
	assert.ok(
		allMessages.includes(updates[0]!),
		`Message "${updates[0]}" should be from built-in packs`,
	);

	disposeVibeManager();
});

test("pack source: messages preserve original punctuation (no forced ellipses)", async () => {
	const {
		initVibeManager,
		onVibeBeforeAgentStart,
		onVibeAgentStart,
		disposeVibeManager,
	} = await import("../vibes/manager.ts");

	const cfg = testConfig({ source: "packs", animation: "none" });
	initVibeManager({ modelRegistry: makeFakeModelRegistry(null) } as any, cfg);
	onVibeAgentStart();

	// Collect several messages
	const messages: string[] = [];
	for (let i = 0; i < 30; i++) {
		onVibeBeforeAgentStart("task", (msg) => {
			if (msg !== undefined) messages.push(msg);
		});
	}

	// Pack messages have mixed punctuation. Some end in "." or "!" not "..."
	// Verify we didn't force-add ellipses to non-ellipsis messages.
	const packTexts = getAllowedPackMessages(BUILTIN_VIBE_PACKS, {
		disabledPacks: [],
		safeMode: false,
	}).map((m) => m.text);

	for (const msg of messages) {
		assert.ok(
			packTexts.includes(msg),
			`"${msg}" should be unmodified pack text`,
		);
	}

	disposeVibeManager();
});

// ═══════════════════════════════════════════════════════════════════════════
// Enabled off
// ═══════════════════════════════════════════════════════════════════════════

test("enabled:false skips onVibeBeforeAgentStart", async () => {
	const {
		initVibeManager,
		onVibeBeforeAgentStart,
		onVibeAgentStart,
		disposeVibeManager,
	} = await import("../vibes/manager.ts");

	const cfg = testConfig({ enabled: false });
	initVibeManager({ modelRegistry: makeFakeModelRegistry(null) } as any, cfg);
	onVibeAgentStart();

	const updates: Array<string | undefined> = [];
	onVibeBeforeAgentStart("fix a bug", (msg) => updates.push(msg));

	assert.equal(
		updates.length,
		0,
		"setWorkingMessage should NOT be called when disabled",
	);
	disposeVibeManager();
});

test("enabled:false skips onVibeToolCall", async () => {
	const {
		initVibeManager,
		onVibeAgentStart,
		onVibeToolCall,
		disposeVibeManager,
	} = await import("../vibes/manager.ts");

	const cfg = testConfig({ enabled: false });
	initVibeManager({ modelRegistry: makeFakeModelRegistry(null) } as any, cfg);
	onVibeAgentStart();

	const updates: Array<string | undefined> = [];
	onVibeToolCall("read", { path: "foo.ts" }, (msg) => updates.push(msg));

	assert.equal(
		updates.length,
		0,
		"setWorkingMessage should NOT be called when disabled",
	);
	disposeVibeManager();
});

test("onVibeAgentEnd still resets even when disabled", async () => {
	const { initVibeManager, onVibeAgentEnd, disposeVibeManager } = await import(
		"../vibes/manager.ts"
	);

	const cfg = testConfig({ enabled: false });
	initVibeManager({ modelRegistry: makeFakeModelRegistry(null) } as any, cfg);

	const updates: Array<string | undefined> = [];
	onVibeAgentEnd((msg) => updates.push(msg));

	assert.deepEqual(updates, [undefined], "onVibeAgentEnd should reset message");
	disposeVibeManager();
});

// ═══════════════════════════════════════════════════════════════════════════
// Cleanup / dispose
// ═══════════════════════════════════════════════════════════════════════════

test("disposeVibeManager resets working message when callback provided", async () => {
	const { initVibeManager, disposeVibeManager } = await import(
		"../vibes/manager.ts"
	);

	const cfg = testConfig();
	initVibeManager({ modelRegistry: makeFakeModelRegistry(null) } as any, cfg);

	const updates: Array<string | undefined> = [];
	disposeVibeManager((msg) => updates.push(msg));

	assert.deepEqual(updates, [undefined]);
});

test("disposeVibeManager without callback does not throw", async () => {
	const { initVibeManager, disposeVibeManager } = await import(
		"../vibes/manager.ts"
	);

	const cfg = testConfig();
	initVibeManager({ modelRegistry: makeFakeModelRegistry(null) } as any, cfg);
	assert.doesNotThrow(() => disposeVibeManager());
});

// ═══════════════════════════════════════════════════════════════════════════
// Animation cleanup after agent_end
// ═══════════════════════════════════════════════════════════════════════════

test("onVibeAgentEnd resets message after animation was active", async () => {
	const {
		initVibeManager,
		onVibeAgentStart,
		onVibeBeforeAgentStart,
		onVibeAgentEnd,
		disposeVibeManager,
	} = await import("../vibes/manager.ts");

	// Use shimmer animation so animation controller is created
	const cfg = testConfig({ source: "packs", animation: "shimmer" });
	initVibeManager({ modelRegistry: makeFakeModelRegistry(null) } as any, cfg);
	onVibeAgentStart();

	const updates: Array<string | undefined> = [];
	const setMsg = (msg?: string) => updates.push(msg);

	// Start animation
	onVibeBeforeAgentStart("task", setMsg);
	assert.ok(updates.length > 0, "should have rendered at least one frame");

	// Wait a tick for animation to schedule frames
	await new Promise((r) => setTimeout(r, 20));

	// End agent → should stop animation and reset message
	const endUpdates: Array<string | undefined> = [];
	onVibeAgentEnd((msg) => endUpdates.push(msg));

	assert.deepEqual(
		endUpdates,
		[undefined],
		"onVibeAgentEnd should reset message to undefined",
	);

	// Verify no further animation frames fire after stop
	const countAfterEnd = endUpdates.length;
	await new Promise((r) => setTimeout(r, 100));
	assert.equal(
		endUpdates.length,
		countAfterEnd,
		"no further updates after agent_end",
	);

	disposeVibeManager();
});

test("disposeVibeManager stops animation and resets message", async () => {
	const {
		initVibeManager,
		onVibeAgentStart,
		onVibeBeforeAgentStart,
		disposeVibeManager,
	} = await import("../vibes/manager.ts");

	// Shimmer animation active
	const cfg = testConfig({ source: "packs", animation: "shimmer" });
	initVibeManager({ modelRegistry: makeFakeModelRegistry(null) } as any, cfg);
	onVibeAgentStart();

	const renderCalls: Array<string | undefined> = [];
	const setMsg = (msg?: string) => renderCalls.push(msg);
	onVibeBeforeAgentStart("task", setMsg);

	// Dispose with callback → resets
	const disposeUpdates: Array<string | undefined> = [];
	disposeVibeManager((msg) => disposeUpdates.push(msg));

	assert.deepEqual(disposeUpdates, [undefined]);

	// No further animation frames
	const count = renderCalls.length;
	await new Promise((r) => setTimeout(r, 100));
	assert.equal(renderCalls.length, count, "no animation frames after dispose");
});

// ═══════════════════════════════════════════════════════════════════════════
// Config access
// ═══════════════════════════════════════════════════════════════════════════

test("getVibeConfig returns current config", async () => {
	const { initVibeManager, getVibeConfig, disposeVibeManager } = await import(
		"../vibes/manager.ts"
	);

	const cfg = testConfig({ safeMode: true });
	initVibeManager({ modelRegistry: makeFakeModelRegistry(null) } as any, cfg);

	const got = getVibeConfig();
	assert.equal(got?.safeMode, true);
	assert.equal(got?.source, "packs");
	disposeVibeManager();
});

test("updateVibeConfig replaces config", async () => {
	const {
		initVibeManager,
		updateVibeConfig,
		getVibeConfig,
		disposeVibeManager,
	} = await import("../vibes/manager.ts");

	const cfg = testConfig({ safeMode: false });
	initVibeManager({ modelRegistry: makeFakeModelRegistry(null) } as any, cfg);

	updateVibeConfig(testConfig({ safeMode: true, source: "generated" }));
	const got = getVibeConfig();
	assert.equal(got?.safeMode, true);
	assert.equal(got?.source, "generated");
	disposeVibeManager();
});

// ═══════════════════════════════════════════════════════════════════════════
// Command transitions: preset whimsical → generate theme → off
// ═══════════════════════════════════════════════════════════════════════════

test("command transition: preset whimsical → generate theme → off", async () => {
	const {
		initVibeManager,
		updateVibeConfig,
		getVibeConfig,
		onVibeAgentStart,
		onVibeBeforeAgentStart,
		disposeVibeManager,
	} = await import("../vibes/manager.ts");

	// Step 1: preset whimsical (packs, enabled, safeMode on)
	const presetWhimsical = parseVibeConfig(
		nextVibeSetting(parseVibeConfig(undefined), {
			enabled: true,
			source: "packs",
			disabledPacks: [],
			safeMode: true,
			animation: "none",
		}),
	);
	initVibeManager(
		{ modelRegistry: makeFakeModelRegistry(null) } as any,
		presetWhimsical,
	);
	onVibeAgentStart();

	const packUpdates: Array<string | undefined> = [];
	onVibeBeforeAgentStart("task", (msg) => packUpdates.push(msg));
	assert.ok(packUpdates.length > 0, "preset whimsical should produce messages");
	assert.ok(packUpdates[0] !== undefined, "message should be defined");

	const cfg1 = getVibeConfig();
	assert.equal(cfg1?.source, "packs");
	assert.equal(cfg1?.enabled, true);

	// Step 2: generate theme (switches to generated source)
	const generateTheme = parseVibeConfig(
		nextVibeSetting(getVibeConfig(), {
			enabled: true,
			source: "generated",
			generated: {
				prompt: DEFAULT_GENERATED_VIBE_PROMPT.replace(
					/\{theme\}/g,
					"star trek",
				),
			},
		}),
	);
	updateVibeConfig(generateTheme);

	const cfg2 = getVibeConfig();
	assert.equal(cfg2?.source, "generated");
	assert.equal(cfg2?.enabled, true);
	assert.ok(cfg2?.generated.prompt.includes('"star trek"'));

	// Step 3: off
	const offConfig = parseVibeConfig(
		nextVibeSetting(getVibeConfig(), { enabled: false }),
	);
	updateVibeConfig(offConfig);

	const cfg3 = getVibeConfig();
	assert.equal(cfg3?.enabled, false);
	// Source preserved even when off
	assert.equal(cfg3?.source, "generated");

	// Disabled → no messages
	const offUpdates: Array<string | undefined> = [];
	onVibeBeforeAgentStart("task", (msg) => offUpdates.push(msg));
	assert.equal(
		offUpdates.length,
		0,
		"disabled config should produce no messages",
	);

	disposeVibeManager();
});

// ═══════════════════════════════════════════════════════════════════════════
// Generated source (faux provider)
// ═══════════════════════════════════════════════════════════════════════════

test("generated source: system prompt includes loading messages instruction", async () => {
	const links = ensurePiModuleLinks();

	try {
		const { fauxAssistantMessage, registerFauxProvider } = await import(
			FAUX_PROVIDER_PATH
		);
		const {
			initVibeManager,
			onVibeAgentStart,
			onVibeBeforeAgentStart,
			disposeVibeManager,
		} = await import("../vibes/manager.ts");

		const registration = registerFauxProvider({
			provider: "test-provider",
			models: [{ id: "test-model" }],
		});

		try {
			const model = registration.getModel("test-model");
			assert.ok(model);

			registration.setResponses([
				(context: { systemPrompt?: string }) => {
					assert.match(context.systemPrompt ?? "", /loading messages/i);
					return fauxAssistantMessage("Engaging warp drive...");
				},
			]);

			const cfg = testConfig({
				source: "generated",
				animation: "none",
				safeMode: false,
			});
			initVibeManager(
				{ modelRegistry: makeFakeModelRegistry(model) } as any,
				cfg,
			);

			const updates: Array<string | undefined> = [];
			onVibeAgentStart();
			onVibeBeforeAgentStart("fix a bug", (message) => {
				updates.push(message);
			});

			// Wait for async generation
			const start = Date.now();
			while (
				!updates.includes("Engaging warp drive...") &&
				Date.now() - start < 2000
			) {
				await new Promise((resolve) => setTimeout(resolve, 10));
			}

			// First update is placeholder
			assert.equal(updates[0], "Vibing...");
			assert.ok(updates.includes("Engaging warp drive..."));

			disposeVibeManager();
		} finally {
			registration.unregister();
		}
	} finally {
		links.cleanup();
	}
});

test("generated source: safeMode adds profanity instruction to system prompt", async () => {
	const links = ensurePiModuleLinks();

	try {
		const { fauxAssistantMessage, registerFauxProvider } = await import(
			FAUX_PROVIDER_PATH
		);
		const {
			initVibeManager,
			onVibeAgentStart,
			onVibeBeforeAgentStart,
			disposeVibeManager,
		} = await import("../vibes/manager.ts");

		const registration = registerFauxProvider({
			provider: "test-provider",
			models: [{ id: "test-model" }],
		});

		try {
			const model = registration.getModel("test-model");
			assert.ok(model);

			registration.setResponses([
				(context: { systemPrompt?: string }) => {
					assert.match(
						context.systemPrompt ?? "",
						/profanity/i,
						"safe mode should add profanity instruction",
					);
					assert.match(context.systemPrompt ?? "", /loading messages/i);
					return fauxAssistantMessage("Debugging gently...");
				},
			]);

			const cfg = testConfig({
				source: "generated",
				animation: "none",
				safeMode: true,
			});
			initVibeManager(
				{ modelRegistry: makeFakeModelRegistry(model) } as any,
				cfg,
			);

			onVibeAgentStart();
			const updates: Array<string | undefined> = [];
			onVibeBeforeAgentStart("fix a bug", (msg) => updates.push(msg));

			const start = Date.now();
			while (
				!updates.includes("Debugging gently...") &&
				Date.now() - start < 2000
			) {
				await new Promise((resolve) => setTimeout(resolve, 10));
			}

			assert.ok(updates.includes("Debugging gently..."));
			disposeVibeManager();
		} finally {
			registration.unregister();
		}
	} finally {
		links.cleanup();
	}
});
