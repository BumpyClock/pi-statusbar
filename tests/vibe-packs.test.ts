import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	BUILTIN_VIBE_PACKS,
	getBuiltinVibePackIds,
	getUnsafeMessageTexts,
	UNSAFE_RE,
	type VibePack,
} from "../vibe-packs.ts";

describe("vibe-packs", () => {
	// ─── Pack IDs ───────────────────────────────────────────────────────

	it("exports all 31 source-section packs", () => {
		assert.equal(BUILTIN_VIBE_PACKS.length, 31);
	});

	it("getBuiltinVibePackIds returns all pack IDs", () => {
		const ids = getBuiltinVibePackIds();
		assert.equal(ids.length, BUILTIN_VIBE_PACKS.length);
		for (const pack of BUILTIN_VIBE_PACKS) {
			assert.ok(ids.includes(pack.id), `missing pack id: ${pack.id}`);
		}
	});

	it("includes expected pack IDs from acceptance criteria", () => {
		const ids = new Set(getBuiltinVibePackIds());
		// Explicitly required by task
		assert.ok(ids.has("breaking-bad"), "missing breaking-bad");
		assert.ok(ids.has("star-wars"), "missing star-wars");
		assert.ok(ids.has("internet-games"), "missing internet-games");
	});

	it("includes all migrated source sections as pack IDs", () => {
		// Full expected set derived from whimsical/data/messages.ts section headers
		const expectedIds = [
			"originals",
			"breaking-bad",
			"better-call-saul",
			"x-files",
			"seinfeld",
			"friends",
			"the-office",
			"always-sunny",
			"parks-and-rec",
			"arrested-development",
			"30-rock",
			"community",
			"rick-and-morty",
			"it-crowd",
			"silicon-valley",
			"mad-men",
			"sopranos",
			"avatar",
			"spongebob",
			"simpsons",
			"game-of-thrones",
			"star-wars",
			"star-trek",
			"the-matrix",
			"lord-of-the-rings",
			"princess-bride",
			"big-lebowski",
			"anchorman",
			"step-brothers",
			"pop-blockbusters",
			"internet-games",
		];
		const actualIds = new Set(getBuiltinVibePackIds());
		for (const id of expectedIds) {
			assert.ok(actualIds.has(id), `missing expected pack id: ${id}`);
		}
		assert.equal(
			actualIds.size,
			expectedIds.length,
			"extra unexpected pack IDs present",
		);
	});

	// ─── Pack structure ─────────────────────────────────────────────────

	it("all pack IDs are non-empty stable slugs", () => {
		for (const pack of BUILTIN_VIBE_PACKS) {
			assert.ok(pack.id.length > 0, `empty id on pack labeled "${pack.label}"`);
			assert.ok(
				/^[a-z0-9][a-z0-9-]*$/.test(pack.id),
				`invalid slug format: "${pack.id}"`,
			);
		}
	});

	it("all packs have non-empty labels", () => {
		for (const pack of BUILTIN_VIBE_PACKS) {
			assert.ok(pack.label.length > 0, `empty label on pack "${pack.id}"`);
		}
	});

	it("no duplicate pack IDs", () => {
		const ids = getBuiltinVibePackIds();
		const unique = new Set(ids);
		assert.equal(unique.size, ids.length, "duplicate pack IDs found");
	});

	it("all packs have at least one message", () => {
		for (const pack of BUILTIN_VIBE_PACKS) {
			assert.ok(
				pack.messages.length > 0,
				`pack "${pack.id}" has zero messages`,
			);
		}
	});

	it("no duplicate message texts within a pack", () => {
		for (const pack of BUILTIN_VIBE_PACKS) {
			const texts = pack.messages.map((m) => m.text);
			const unique = new Set(texts);
			assert.equal(
				unique.size,
				texts.length,
				`duplicate messages in pack "${pack.id}"`,
			);
		}
	});

	// ─── Corpus completeness ───────────────────────────────────────────

	it("total message count equals source corpus (392 messages from whimsical/data/messages.ts)", () => {
		// This checked-in pack data is now the canonical source. The 392 total
		// was copied from ~/.pi/agent/extensions/whimsical/data/messages.ts during
		// the one-time migration. If BUILTIN_VIBE_PACKS changes intentionally,
		// update EXPECTED_TOTAL and the per-pack count map together.
		const EXPECTED_TOTAL = 392;
		const actual = BUILTIN_VIBE_PACKS.reduce(
			(sum, p) => sum + p.messages.length,
			0,
		);
		assert.equal(
			actual,
			EXPECTED_TOTAL,
			`corpus count mismatch: got ${actual}, expected ${EXPECTED_TOTAL}`,
		);
	});

	it("per-pack message counts match source section counts", () => {
		// Counts are derived from the original whimsical section headings. Keep
		// this map in sync with BUILTIN_VIBE_PACKS when adding/removing messages.
		const expected: Record<string, number> = {
			originals: 19,
			"breaking-bad": 20,
			"better-call-saul": 13,
			"x-files": 14,
			seinfeld: 17,
			friends: 15,
			"the-office": 23,
			"always-sunny": 11,
			"parks-and-rec": 13,
			"arrested-development": 13,
			"30-rock": 9,
			community: 9,
			"rick-and-morty": 11,
			"it-crowd": 7,
			"silicon-valley": 9,
			"mad-men": 6,
			sopranos: 4,
			avatar: 7,
			spongebob: 8,
			simpsons: 14,
			"game-of-thrones": 13,
			"star-wars": 14,
			"star-trek": 8,
			"the-matrix": 7,
			"lord-of-the-rings": 8,
			"princess-bride": 10,
			"big-lebowski": 10,
			anchorman: 9,
			"step-brothers": 4,
			"pop-blockbusters": 29,
			"internet-games": 38,
		};
		for (const pack of BUILTIN_VIBE_PACKS) {
			const exp = expected[pack.id];
			assert.ok(exp !== undefined, `no expected count for pack "${pack.id}"`);
			assert.equal(
				pack.messages.length,
				exp,
				`pack "${pack.id}": got ${pack.messages.length}, expected ${exp}`,
			);
		}
	});

	// ─── Unsafe tagging ────────────────────────────────────────────────

	it("known profane messages are tagged unsafe", () => {
		// These messages contain: fuck, F***ing, shit, bitch, bullshit, dick, goddamn
		const knownUnsafe = [
			"Convincing the flaky test to stop being a dick...",
			"Politely asking bullshit to leave...",
			"You're goddamn right.",
			"Yeah, bitch! Magnets!",
			"Wildcard, bitches! Yeeeehaw!",
			"I'm Ron F***ing Swanson.",
			"Shut the fuck up, Donny.",
			"Fuck it, Dude. Let's go bowling.",
			"New shit has come to light, man.",
		];

		const unsafeTexts = new Set(getUnsafeMessageTexts());
		for (const text of knownUnsafe) {
			assert.ok(unsafeTexts.has(text), `expected unsafe tag on: "${text}"`);
		}
	});

	it("getUnsafeMessageTexts returns the migrated unsafe corpus subset", () => {
		// Keep this exact count in sync with knownUnsafe above and UNSAFE_RE.
		assert.equal(getUnsafeMessageTexts().length, 9);
	});

	it("unsafe messages are deterministic (same set on every call)", () => {
		const a = getUnsafeMessageTexts();
		const b = getUnsafeMessageTexts();
		assert.deepEqual(a, b);
	});

	it("no message without profanity is tagged unsafe", () => {
		for (const pack of BUILTIN_VIBE_PACKS) {
			for (const m of pack.messages) {
				if (m.tags?.includes("unsafe")) {
					assert.ok(
						UNSAFE_RE.test(m.text),
						`false positive unsafe tag: "${m.text}" in pack "${pack.id}"`,
					);
				}
			}
		}
	});
});
