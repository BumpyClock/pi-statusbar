import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	getAllowedPackMessages,
	isUnsafeMessage,
	createVibePicker,
	type PackFilterOptions,
} from "../vibe-picker.ts";
import type { VibePack, VibeMessage } from "../vibe-packs.ts";

// ── Fixtures ──────────────────────────────────────────────────────────────

const safePack: VibePack = {
	id: "safe-pack",
	label: "Safe Pack",
	messages: [
		{ text: "Vibing..." },
		{ text: "Cooking..." },
		{ text: "Loading..." },
	],
};

const mixedPack: VibePack = {
	id: "mixed-pack",
	label: "Mixed Pack",
	messages: [
		{ text: "Clean message" },
		{ text: "Oh shit, here we go", tags: ["unsafe"] },
		{ text: "Another clean one" },
	],
};

const unsafePack: VibePack = {
	id: "unsafe-pack",
	label: "Unsafe Pack",
	messages: [
		{ text: "What the fuck", tags: ["unsafe"] },
		{ text: "Goddamn right", tags: ["unsafe"] },
	],
};

const regexUnsafePack: VibePack = {
	id: "regex-unsafe-pack",
	label: "Regex Unsafe Pack",
	messages: [
		{ text: "F***ing awesome" }, // no tag, but regex-detectable
		{ text: "Clean text here" },
		{ text: "What a dick move" },
	],
};

const tinyPack: VibePack = {
	id: "tiny-pack",
	label: "Tiny Pack",
	messages: [{ text: "Solo message" }],
};

const allPacks = [safePack, mixedPack, unsafePack, regexUnsafePack, tinyPack];

// ── getAllowedPackMessages ─────────────────────────────────────────────────

describe("getAllowedPackMessages", () => {
	it("returns all messages from all packs when no filters", () => {
		const msgs = getAllowedPackMessages(allPacks, {
			disabledPacks: [],
			safeMode: false,
		});
		const totalExpected = allPacks.reduce(
			(sum, p) => sum + p.messages.length,
			0,
		);
		assert.equal(msgs.length, totalExpected);
	});

	it("excludes disabled packs by stable ID", () => {
		const msgs = getAllowedPackMessages(allPacks, {
			disabledPacks: ["unsafe-pack", "tiny-pack"],
			safeMode: false,
		});
		// Should not contain messages from unsafe-pack or tiny-pack
		const texts = msgs.map((m) => m.text);
		assert.ok(!texts.includes("What the fuck"));
		assert.ok(!texts.includes("Goddamn right"));
		assert.ok(!texts.includes("Solo message"));
		// Should still have safe-pack messages
		assert.ok(texts.includes("Vibing..."));
	});

	it("safe mode excludes tagged unsafe messages", () => {
		const msgs = getAllowedPackMessages([mixedPack], {
			disabledPacks: [],
			safeMode: true,
		});
		const texts = msgs.map((m) => m.text);
		assert.ok(!texts.includes("Oh shit, here we go"));
		assert.ok(texts.includes("Clean message"));
		assert.ok(texts.includes("Another clean one"));
		assert.equal(texts.length, 2);
	});

	it("safe mode excludes regex-detected unsafe messages without tags", () => {
		const msgs = getAllowedPackMessages([regexUnsafePack], {
			disabledPacks: [],
			safeMode: true,
		});
		const texts = msgs.map((m) => m.text);
		assert.ok(!texts.includes("F***ing awesome"));
		assert.ok(!texts.includes("What a dick move"));
		assert.ok(texts.includes("Clean text here"));
		assert.equal(texts.length, 1);
	});

	it("safe mode off keeps all messages including unsafe", () => {
		const msgs = getAllowedPackMessages([mixedPack, unsafePack], {
			disabledPacks: [],
			safeMode: false,
		});
		const texts = msgs.map((m) => m.text);
		assert.ok(texts.includes("Oh shit, here we go"));
		assert.ok(texts.includes("What the fuck"));
		assert.equal(texts.length, 5);
	});

	it("disabled packs + safe mode combine correctly", () => {
		const msgs = getAllowedPackMessages(allPacks, {
			disabledPacks: ["unsafe-pack"],
			safeMode: true,
		});
		const texts = new Set(msgs.map((m) => m.text));
		// unsafe-pack excluded entirely
		assert.ok(!texts.has("What the fuck"));
		assert.ok(!texts.has("Goddamn right"));
		// tagged unsafe in mixed-pack excluded by safe mode
		assert.ok(!texts.has("Oh shit, here we go"));
		// regex unsafe in regex-unsafe-pack excluded by safe mode
		assert.ok(!texts.has("F***ing awesome"));
		// safe messages survive
		assert.ok(texts.has("Vibing..."));
		assert.ok(texts.has("Clean message"));
		assert.ok(texts.has("Solo message"));
	});

	it("returns empty array when all packs disabled", () => {
		const ids = allPacks.map((p) => p.id);
		const msgs = getAllowedPackMessages(allPacks, {
			disabledPacks: ids,
			safeMode: false,
		});
		assert.equal(msgs.length, 0);
	});

	it("per-message pool semantics: uneven packs contribute proportionally", () => {
		// 3 messages from safePack, 1 from tinyPack = 4 total
		const msgs = getAllowedPackMessages([safePack, tinyPack], {
			disabledPacks: [],
			safeMode: false,
		});
		assert.equal(msgs.length, 4);
		// Each message appears exactly once (equal chance per message)
		const texts = msgs.map((m) => m.text);
		assert.equal(new Set(texts).size, 4);
	});
});

// ── isUnsafeMessage ───────────────────────────────────────────────────────

describe("isUnsafeMessage", () => {
	it("detects tagged unsafe messages", () => {
		assert.ok(isUnsafeMessage({ text: "whatever", tags: ["unsafe"] }));
	});

	it("detects regex-based profanity without tags", () => {
		assert.ok(isUnsafeMessage({ text: "What the fuck" }));
		assert.ok(isUnsafeMessage({ text: "Oh shit" }));
		assert.ok(isUnsafeMessage({ text: "son of a bitch" }));
		assert.ok(isUnsafeMessage({ text: "F***ing great" }));
		assert.ok(isUnsafeMessage({ text: "goddamn it" }));
		assert.ok(isUnsafeMessage({ text: "stop being a dick" }));
		assert.ok(isUnsafeMessage({ text: "total bullshit" }));
	});

	it("returns false for clean messages", () => {
		assert.ok(!isUnsafeMessage({ text: "Vibing..." }));
		assert.ok(!isUnsafeMessage({ text: "Loading..." }));
		assert.ok(!isUnsafeMessage({ text: "Reticulating splines..." }));
	});

	it("returns false for messages without tags field", () => {
		assert.ok(!isUnsafeMessage({ text: "Clean" }));
	});

	it("detects case-insensitive profanity variants", () => {
		assert.ok(isUnsafeMessage({ text: "FUCK this" }));
		assert.ok(isUnsafeMessage({ text: "ShIt" }));
		assert.ok(isUnsafeMessage({ text: "GODDAMN" }));
	});
});

// ── createVibePicker ──────────────────────────────────────────────────────

describe("createVibePicker", () => {
	it("returns undefined for empty candidate pool", () => {
		const picker = createVibePicker([]);
		assert.equal(picker.next(), undefined);
	});

	it("returns the sole message when pool has one entry", () => {
		const msgs: VibeMessage[] = [{ text: "Only one" }];
		const picker = createVibePicker(msgs);
		assert.equal(picker.next(), "Only one");
		assert.equal(picker.next(), "Only one");
	});

	it("avoids immediate repeat when at least two candidates exist", () => {
		const msgs: VibeMessage[] = [{ text: "A" }, { text: "B" }];
		// Deterministic: use seeded random that always returns 0
		// With two items, if random returns 0 and last was "A", picker should skip to "B"
		const picker = createVibePicker(msgs);
		const first = picker.next();
		// Call many times; never two same in a row
		let prev = first;
		for (let i = 0; i < 50; i++) {
			const current = picker.next();
			assert.notEqual(
				current,
				prev,
				`immediate repeat detected at iteration ${i}: "${current}"`,
			);
			prev = current;
		}
	});

	it("avoids immediate repeat with deterministic random", () => {
		const msgs: VibeMessage[] = [{ text: "A" }, { text: "B" }, { text: "C" }];
		// Random that always returns 0 → always picks first candidate
		// Should still avoid repeat by excluding last picked from candidates
		const picker = createVibePicker(msgs, () => 0);
		const results: string[] = [];
		for (let i = 0; i < 10; i++) {
			results.push(picker.next()!);
		}
		for (let i = 1; i < results.length; i++) {
			assert.notEqual(
				results[i],
				results[i - 1],
				`repeat at index ${i}: "${results[i]}"`,
			);
		}
	});

	it("uses custom random function for selection", () => {
		const msgs: VibeMessage[] = [{ text: "A" }, { text: "B" }, { text: "C" }];
		// First call: no last, 3 candidates, random()=0 → "A"
		// Second call: last="A", 2 candidates [B,C], random()=0.99 → "C"
		let callCount = 0;
		const randomFn = () => {
			callCount++;
			return callCount === 1 ? 0 : 0.999;
		};
		const picker = createVibePicker(msgs, randomFn);
		assert.equal(picker.next(), "A");
		assert.equal(picker.next(), "C");
	});

	it("reset replaces the message pool", () => {
		const msgs1: VibeMessage[] = [{ text: "Old" }];
		const msgs2: VibeMessage[] = [{ text: "New1" }, { text: "New2" }];
		const picker = createVibePicker(msgs1);
		assert.equal(picker.next(), "Old");

		picker.reset(msgs2);
		const result = picker.next();
		assert.ok(
			result === "New1" || result === "New2",
			`expected New1 or New2, got "${result}"`,
		);
	});

	it("reset to empty pool returns undefined", () => {
		const picker = createVibePicker([{ text: "X" }]);
		assert.equal(picker.next(), "X");
		picker.reset([]);
		assert.equal(picker.next(), undefined);
	});

	it("reset clears last-pick state so any message is valid", () => {
		const msgs: VibeMessage[] = [{ text: "A" }, { text: "B" }];
		const picker = createVibePicker(msgs, () => 0);
		assert.equal(picker.next(), "A"); // last = A
		// Reset with same pool, last cleared → first pick should be "A" again (random=0)
		picker.reset(msgs);
		assert.equal(picker.next(), "A");
	});

	it("equal chance per message across enabled packs (flat pool)", () => {
		// 3-message pack + 1-message pack → 4 candidates, each equally likely
		const msgs = getAllowedPackMessages([safePack, tinyPack], {
			disabledPacks: [],
			safeMode: false,
		});
		assert.equal(msgs.length, 4);
		// With deterministic random cycling 0, 0.25, 0.5, 0.75
		// each of the 4 messages should be picked once
		let call = 0;
		const picker = createVibePicker(msgs, () => {
			const v = (call * 0.25) % 1;
			call++;
			return v;
		});
		const picked = new Set<string>();
		for (let i = 0; i < 4; i++) {
			picked.add(picker.next()!);
		}
		assert.equal(picked.size, 4, "all 4 messages should be reachable");
	});
});
