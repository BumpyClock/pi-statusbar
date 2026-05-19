/**
 * @module vibe-packs
 *
 * Built-in vibe message packs. Each pack is a named collection of pop-culture
 * quotes and one-liners. Messages containing profanity are auto-tagged
 * `"unsafe"` by the shared {@link UNSAFE_RE} so safe-mode filtering can
 * exclude them at runtime.
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

/** Tags that can be applied to individual messages. */
export type VibeMessageTag = "unsafe";

/** A single vibe message with optional tags. */
export interface VibeMessage {
	text: string;
	tags?: VibeMessageTag[];
}

/** A named collection of vibe messages. */
export interface VibePack {
	id: string;
	label: string;
	messages: VibeMessage[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Unsafe detection
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Shared regex that matches obvious and obfuscated profanity
 * (fuck, f\*\*\*ing, shit, bitch, bullshit, dick, goddamn — case-insensitive).
 *
 * Used both here (auto-tagging) and in vibe-picker (runtime catch-all).
 */
export const UNSAFE_RE =
	/\b(?:fuck|shit|bitch|bullshit|dick|goddamn)|\bf\*+ing\b/i;

/**
 * Tag a single message. If text matches {@link UNSAFE_RE}, the message is
 * tagged `"unsafe"` for safe-mode filtering.
 */
function msg(text: string): VibeMessage {
	return UNSAFE_RE.test(text) ? { text, tags: ["unsafe"] } : { text };
}

// ═══════════════════════════════════════════════════════════════════════════
// Pack data
// ═══════════════════════════════════════════════════════════════════════════

const originals: VibePack = {
	id: "originals",
	label: "Originals",
	messages: [
		msg("Schlepping..."),
		msg("Flibbertigibbeting..."),
		msg("Discombobulating..."),
		msg("Reticulating splines..."),
		msg("Bamboozling..."),
		msg("Confabulating..."),
		msg("Tokenmaxxing..."),
		msg("Vibing..."),
		msg("Caffeinating..."),
		msg("Untangling spaghetti..."),
		msg("Consulting the rubber duck..."),
		msg("Negotiating with entropy..."),
		msg("Yeeting bad assumptions into the sun..."),
		msg("Asking what fresh hell this is..."),
		msg("Convincing the flaky test to stop being a dick..."),
		msg("Politely asking bullshit to leave..."),
		msg("Optimizing vibes per second..."),
		msg("Reframing bugs as surprise features..."),
		msg("Performing agile ceremonies for one..."),
	],
};

const breakingBad: VibePack = {
	id: "breaking-bad",
	label: "Breaking Bad",
	messages: [
		msg("I am the one who knocks..."),
		msg("Yeah, Mr. White! Yeah, science!"),
		msg("Say my name."),
		msg("You're goddamn right."),
		msg("Tread lightly."),
		msg("I am the danger."),
		msg("I am not in danger, Skyler. I AM the danger."),
		msg("I'm in the empire business."),
		msg("No more half-measures."),
		msg("Just because you shot Jesse James, don't make you Jesse James."),
		msg("I did it for me. I liked it. I was good at it."),
		msg("Reaching 99.1% purity..."),
		msg("Tight, tight, tight."),
		msg("This is not meth, this is art."),
		msg("Cooking, Mr. White..."),
		msg("Stay out of my territory."),
		msg("Yeah, bitch! Magnets!"),
		msg("Better call Saul."),
		msg("The chemistry must be respected."),
		msg(
			"Whatever you think is supposed to happen — the exact opposite is gonna happen.",
		),
	],
};

const betterCallSaul: VibePack = {
	id: "better-call-saul",
	label: "Better Call Saul",
	messages: [
		msg("S'all good, man!"),
		msg("It's showtime, folks."),
		msg("You don't want a criminal lawyer. You want a CRIMINAL lawyer."),
		msg("A tiger doesn't change its stripes."),
		msg("The universe is random. It's not inevitable. It's simple chaos."),
		msg("You don't save me. I save me."),
		msg("Filing a motion to compile..."),
		msg("Slippin' Jimmy mode engaged..."),
		msg("Sending Huell to handle it..."),
		msg("Cinnabon contingency plan loaded..."),
		msg("In the desert with a flat tire..."),
		msg("You can't help yourself. The fun is too much."),
		msg("I broke my boy."),
	],
};

const xFiles: VibePack = {
	id: "x-files",
	label: "The X-Files",
	messages: [
		msg("The truth is out there."),
		msg("Trust no one."),
		msg("I want to believe."),
		msg("Mulder, it's me..."),
		msg("Nobody down here but the FBI's most unwanted."),
		msg("You're my one in five billion."),
		msg("Toads just fell from the sky."),
		msg("Reopening the X-Files..."),
		msg("Suspecting government involvement..."),
		msg(
			"Dreams are answers to questions we haven't yet figured out how to ask.",
		),
		msg(
			"Did you really think you could call up the devil and ask him to behave?",
		),
		msg("Sometimes the only sane answer to an insane world is insanity."),
		msg("I'd willfully participate in a campaign of misinformation."),
		msg("Cigarette-smoking man is watching the commit log..."),
	],
};

const seinfeld: VibePack = {
	id: "seinfeld",
	label: "Seinfeld",
	messages: [
		msg("No soup for you!"),
		msg("Yada yada yada."),
		msg("These pretzels are making me thirsty."),
		msg("Serenity now!"),
		msg("Master of my domain."),
		msg("Not that there's anything wrong with that."),
		msg("Giddyup."),
		msg("It's not a lie if you believe it."),
		msg("Hello, Newman."),
		msg("Festivus airing of grievances commencing..."),
		msg("Vandelay Industries, importer/exporter."),
		msg("I'm out!"),
		msg("Get OUT!"),
		msg("Shrinkage. There was shrinkage."),
		msg("Anti-dentite bastard."),
		msg("The sea was angry that day, my friends."),
		msg("I'm speechless. I have no speech."),
	],
};

const friends: VibePack = {
	id: "friends",
	label: "Friends",
	messages: [
		msg("PIVOT! PIVOT! PIIIIIVOT!"),
		msg("We were on a break!"),
		msg("Could this BE any slower..."),
		msg("How you doin'?"),
		msg("Joey doesn't share commits."),
		msg("Smelly bug, smelly bug, what are they feeding you..."),
		msg("He's her lobster."),
		msg("Unagi achieved."),
		msg("Oh. My. GOD. (it's Janice)"),
		msg("My eyes! MY EYES!"),
		msg("Gum would be perfection."),
		msg("Welcome to the real world. It sucks. You're gonna love it."),
		msg("No uterus, no opinion."),
		msg("I'll be there for you..."),
		msg("They don't know that we know they know."),
	],
};

const theOffice: VibePack = {
	id: "the-office",
	label: "The Office (US)",
	messages: [
		msg("Bears. Beets. Breakpoints."),
		msg("I DECLARE BANKRUPTCY!"),
		msg("Identity theft is not a joke, Jim."),
		msg("PARKOUR! PARKOUR! PARKOUR!"),
		msg("I am Beyoncé, always."),
		msg(
			"Would I rather be feared or loved? Both. I want people to be afraid of how much they love me.",
		),
		msg("Threat level midnight."),
		msg("I'm not superstitious, but I am a little stitious."),
		msg(
			"Whenever I'm about to do something, I think — would an idiot do that? And if they would, I do not do that thing.",
		),
		msg(
			"And I knew exactly what to do. But in a much more real sense, I had no idea what to do.",
		),
		msg(
			"Wikipedia is the best thing ever. Anyone can write anything about any subject.",
		),
		msg(
			"R is among the most menacing of sounds. That's why they call it 'murder' and not 'mukduk.'",
		),
		msg("Sometimes the ends justify the mean."),
		msg(
			"If I had a gun with two bullets and I was in a room with Hitler, Bin Laden and Toby...",
		),
		msg("Question. What kind of bear is best?"),
		msg("FALSE. Black bear."),
		msg("Going to a Schrute farm for answers..."),
		msg("Boom. Roasted."),
		msg("It's pretzel day!"),
		msg("Did I stutter?"),
		msg(
			"I'm not usually the butt of the joke. I'm usually the face of the joke.",
		),
		msg("Why are you the way that you are?"),
		msg("I'm an early bird and I'm a night owl, so I'm wise and I have worms."),
	],
};

const alwaysSunny: VibePack = {
	id: "always-sunny",
	label: "It's Always Sunny in Philadelphia",
	messages: [
		msg("The gang debugs the codebase."),
		msg("I am a FIVE-star man."),
		msg("I'm the trash man!"),
		msg("Wildcard, bitches! Yeeeehaw!"),
		msg("I have the stride of a gazelle. A beautiful gazelle person."),
		msg("Peaked? Dee, I haven't even begun to peak."),
		msg("Achieving perfect symmetry right now."),
		msg("Bird up!"),
		msg("Day man, fighter of the Night man..."),
		msg(
			"Kitten mittens. Have you ever heard a cat walk across a hardwood floor?",
		),
		msg("Pepe Silvia. PEPE SILVIA!"),
	],
};

const parksAndRec: VibePack = {
	id: "parks-and-rec",
	label: "Parks and Recreation",
	messages: [
		msg("Treat yo' self."),
		msg("Literally."),
		msg("I'm Ron F***ing Swanson."),
		msg("Birthdays were invented by Hallmark to sell cards."),
		msg("Give 100%. 110% is impossible. Only idiots recommend that."),
		msg("Crying: acceptable at funerals and the Grand Canyon."),
		msg(
			"Fishing relaxes me. It's like yoga, except I still get to kill something.",
		),
		msg("Any dog under fifty pounds is a cat and cats are useless."),
		msg("There is only one bad word: taxes."),
		msg("Lil Sebastian, forever."),
		msg("Capitalism: God's way of determining who is smart and who is poor."),
		msg(
			"I would rather bleed out than sit here and talk about my feelings for ten minutes.",
		),
		msg("History began on July 4, 1776. Everything before that was a mistake."),
	],
};

const arrestedDevelopment: VibePack = {
	id: "arrested-development",
	label: "Arrested Development",
	messages: [
		msg("I've made a huge mistake."),
		msg("There's always money in the banana stand."),
		msg("I'm a monster!"),
		msg("STEVE HOLT!"),
		msg("No touching."),
		msg("Annyong."),
		msg("Hey, brother."),
		msg("Not tricks, Michael. Illusions."),
		msg("I just blue myself."),
		msg("It's a banana, Michael. What could it cost? Ten dollars?"),
		msg("Her?"),
		msg("Marry me!"),
		msg("I don't know what I expected."),
	],
};

const thirtyRock: VibePack = {
	id: "30-rock",
	label: "30 Rock",
	messages: [
		msg("I want to go to there."),
		msg("Blerg!"),
		msg("What the what?"),
		msg("Night cheese..."),
		msg("There are no bad ideas, Lemon. Just good ideas that go horribly bad."),
		msg("Good God, Lemon."),
		msg("Lemon, it's after 6. What am I, a farmer?"),
		msg("Working on my night cheese."),
		msg("I'm pretty sure that wolf was a man."),
	],
};

const community: VibePack = {
	id: "community",
	label: "Community",
	messages: [
		msg("Six seasons and a movie!"),
		msg("Cool. Cool cool cool."),
		msg("Pop pop."),
		msg("Streets ahead."),
		msg("You just Britta'd it."),
		msg("Consider yourself Chang'd."),
		msg("And I'm proud of you."),
		msg("Greendale's music department is flat ba-roque."),
		msg("Either I'm god, or truth is relative. Either way: booyah."),
	],
};

const rickAndMorty: VibePack = {
	id: "rick-and-morty",
	label: "Rick and Morty",
	messages: [
		msg("Wubba lubba dub dub!"),
		msg("Get schwifty."),
		msg("I'm Pickle Riiick!"),
		msg("Weddings are basically funerals with cake."),
		msg("Tiny Rick! Tiny Rick!"),
		msg("Don't think about it, Morty."),
		msg("Riggity riggity wrecked, son."),
		msg("Aw geez, Rick..."),
		msg("Show me what you got!"),
		msg("And awaaaay we go!"),
		msg(
			"What about the reality where Hitler cured cancer? The answer is: don't think about it.",
		),
	],
};

const itCrowd: VibePack = {
	id: "it-crowd",
	label: "The IT Crowd",
	messages: [
		msg("Hello, IT. Have you tried turning it off and on again?"),
		msg("0118 999 881 999 119 7253."),
		msg("I'll just put it here with the rest of the fire."),
		msg("Prepare to put mustard on those words."),
		msg("...the oven of shame, set at gas mark egg on your face."),
		msg(
			"I came here to drink milk and kick ass. And I've just finished my milk.",
		),
		msg("Yes you do; you've just used a double negative."),
	],
};

const siliconValley: VibePack = {
	id: "silicon-valley",
	label: "Silicon Valley",
	messages: [
		msg("Clif bars and a gun."),
		msg("You look like someone starved a virgin to death."),
		msg(
			"I don't want to live in a world where someone else is making the world a better place better than we are.",
		),
		msg("Middle-out compression engaged."),
		msg("Tres comas."),
		msg("Always blue! Always blue!"),
		msg("I find parades to be impotent displays of authoritarianism."),
		msg("Pied Piper, baby."),
		msg("Spaces, dear god, spaces."),
	],
};

const madMen: VibePack = {
	id: "mad-men",
	label: "Mad Men",
	messages: [
		msg("If you don't like what's being said, change the conversation."),
		msg("That's what the money is for!"),
		msg("Advertising is based on one thing: happiness."),
		msg("It wasn't a lie — it was ineptitude with insufficient cover."),
		msg(
			"You don't know how to drink. Your whole generation drinks for the wrong reasons.",
		),
		msg("What do women want? Who cares?"),
	],
};

const sopranos: VibePack = {
	id: "sopranos",
	label: "The Sopranos",
	messages: [
		msg("Forget about it."),
		msg("Bada bing, bada boom."),
		msg("Whaddaya gonna do."),
		msg("Gabagool."),
	],
};

const avatar: VibePack = {
	id: "avatar",
	label: "Avatar: The Last Airbender",
	messages: [
		msg("My first girlfriend turned into the moon."),
		msg("That's rough, buddy."),
		msg("I'm just a guy with a boomerang."),
		msg("My cabbages!"),
		msg("HONOR!"),
		msg("It's the quenchiest."),
		msg("Sokka tactics."),
	],
};

const spongebob: VibePack = {
	id: "spongebob",
	label: "Spongebob Squarepants",
	messages: [
		msg("Stop staring at me with them big ol' eyes..."),
		msg("I'm ready! I'm ready!"),
		msg("Rev up those fryers."),
		msg("I never thought I'd get this far."),
		msg("Imaaaagination."),
		msg("F is for friends who do stuff together..."),
		msg("Is mayonnaise an instrument?"),
		msg("The Krabby Patty secret formula is safe."),
	],
};

const simpsons: VibePack = {
	id: "simpsons",
	label: "The Simpsons",
	messages: [
		msg("D'oh!"),
		msg("Woo-hoo!"),
		msg("Mmm... debugging."),
		msg("Worst. Bug. Ever."),
		msg("Don't have a cow, man."),
		msg("Eat my shorts."),
		msg("Trying is the first step towards failure."),
		msg("To alcohol! The cause of — and solution to — all of life's problems."),
		msg("I am so smart. S-M-R-T."),
		msg("Everything's coming up Milhouse."),
		msg("Old man yells at cloud."),
		msg("Me fail English? That's unpossible."),
		msg("Lisa, get in here. In this house we OBEY the laws of thermodynamics."),
		msg(
			"Sensitive love letters are my specialty. 'Dear baby, welcome to Dumpsville. Population: you.'",
		),
	],
};

const gameOfThrones: VibePack = {
	id: "game-of-thrones",
	label: "Game of Thrones",
	messages: [
		msg("Winter is coming to staging."),
		msg("You know nothing, undefined."),
		msg("Hodor."),
		msg("A Lannister always pays his debts."),
		msg("Chaos isn't a pit. Chaos is a ladder."),
		msg("Dracarys."),
		msg("The night is dark and full of errors."),
		msg("What is dead may never die."),
		msg("Hold the door."),
		msg("Shame. Shame. Shame."),
		msg("A lion does not concern himself with the opinion of sheep."),
		msg("When you play the game of thrones, you win or you die."),
		msg(
			"If you think this has a happy ending, you haven't been paying attention.",
		),
	],
};

const starWars: VibePack = {
	id: "star-wars",
	label: "Star Wars",
	messages: [
		msg("May the source be with you."),
		msg("Do or do not. There is no try."),
		msg("These aren't the bugs you're looking for."),
		msg("I find your lack of types disturbing."),
		msg("It's a trap!"),
		msg("I have a bad feeling about this."),
		msg("Hello there."),
		msg("Now THIS is podracing."),
		msg(
			"Hokey religions and ancient frameworks are no match for a debugger at your side, kid.",
		),
		msg("I am one with the Force, the Force is with me."),
		msg("We will watch your career with great interest."),
		msg("Ben! I can hear you breathing."),
		msg("It's over, Anakin, I have the high ground!"),
		msg("You were the chosen one!"),
	],
};

const starTrek: VibePack = {
	id: "star-trek",
	label: "Star Trek",
	messages: [
		msg("Live long and prosper."),
		msg("Make it so."),
		msg("Resistance is futile."),
		msg("Set phasers to refactor."),
		msg("Engage warp deploy."),
		msg("Tea. Earl Grey. Hot."),
		msg("He's dead, Jim."),
		msg("Highly illogical."),
	],
};

const theMatrix: VibePack = {
	id: "the-matrix",
	label: "The Matrix",
	messages: [
		msg("There is no spoon."),
		msg("Following the white rabbit through logs..."),
		msg("Going full Morpheus on the matrix."),
		msg("Taking the red pill."),
		msg("I know kung fu."),
		msg("Free your mind."),
		msg("Dodge this."),
	],
};

const lordOfTheRings: VibePack = {
	id: "lord-of-the-rings",
	label: "Lord of the Rings",
	messages: [
		msg("YOU SHALL NOT PASS."),
		msg("One does not simply deploy on Friday."),
		msg("Run, you fools!"),
		msg("My precious commits."),
		msg("Po-ta-toes. Boil 'em, mash 'em, stick 'em in a stew."),
		msg("We don't deserve them. The fools."),
		msg("And my axe!"),
		msg("What about second breakfast?"),
	],
};

const princessBride: VibePack = {
	id: "princess-bride",
	label: "The Princess Bride",
	messages: [
		msg("Inconceivable!"),
		msg("As you wish."),
		msg(
			"Hello. My name is Inigo Montoya. You killed my build. Prepare to die.",
		),
		msg("Have fun storming the castle."),
		msg("Anybody want a peanut?"),
		msg("Mawage. Mawage is wot bwings us togeder today."),
		msg("Get used to disappointment."),
		msg(
			"You keep using that word. I do not think it means what you think it means.",
		),
		msg("Never go in against a Sicilian when death is on the line."),
		msg(
			"Life is pain, Highness. Anyone who says differently is selling something.",
		),
	],
};

const bigLebowski: VibePack = {
	id: "big-lebowski",
	label: "The Big Lebowski",
	messages: [
		msg("The Dude abides."),
		msg("That rug really tied the room together."),
		msg("Yeah, well, that's just, like, your opinion, man."),
		msg("This aggression will not stand, man."),
		msg("Shut the fuck up, Donny."),
		msg("Eight-year-olds, Dude."),
		msg("Fuck it, Dude. Let's go bowling."),
		msg("Obviously you're not a golfer."),
		msg("New shit has come to light, man."),
		msg("Hey, careful man, there's a beverage here!"),
	],
};

const anchorman: VibePack = {
	id: "anchorman",
	label: "Anchorman",
	messages: [
		msg("I'm kind of a big deal."),
		msg("60% of the time, it works every time."),
		msg("I'm in a glass case of emotion."),
		msg("Stay classy, San Diego."),
		msg("Boy, that escalated quickly."),
		msg("I love lamp."),
		msg("It stings the nostrils. In a good way."),
		msg("Don't act like you're not impressed."),
		msg("By the beard of Zeus!"),
	],
};

const stepBrothers: VibePack = {
	id: "step-brothers",
	label: "Step Brothers",
	messages: [
		msg("Did we just become best friends?"),
		msg("This is a house of learned doctors."),
		msg("You have the voice of an angel — a combination of Fergie and Jesus."),
		msg("PRESTIGE WORLDWIDE."),
	],
};

const popBlockbusters: VibePack = {
	id: "pop-blockbusters",
	label: "Pop / Blockbusters",
	messages: [
		msg("I'll be back."),
		msg("Houston, we have a problem."),
		msg("You can't handle the truth!"),
		msg("Show me the money."),
		msg("I see dead processes."),
		msg("Say hello to my little linter."),
		msg("Why so serious?"),
		msg("I'm Batman."),
		msg("With great power comes great undefined behavior."),
		msg("Yippee-ki-yay, mister buffer."),
		msg("To infinity, and beyond!"),
		msg("Wakanda forever."),
		msg("I am Iron Man."),
		msg("I am Groot."),
		msg("On your left."),
		msg("Avengers, assemble the imports."),
		msg("Whatever it takes."),
		msg("Toto, we're not in localhost anymore."),
		msg("Frankly, my dear, I don't give a fork."),
		msg("Here's looking at you, kid."),
		msg("E.T. phone server."),
		msg("Run, Forrest, run!"),
		msg("Life is like a box of bug reports."),
		msg("Heeeere's commit-y!"),
		msg("They're heeeere."),
		msg("Soylent green is dependencies!"),
		msg("Wax on, wax off."),
		msg("You're gonna need a bigger heap."),
		msg("Are you not entertained?"),
	],
};

const internetGames: VibePack = {
	id: "internet-games",
	label: "Internet / Games / Nerd Canon",
	messages: [
		msg("Making fetch happen."),
		msg("Loading the Konami code for tests..."),
		msg("Make coding great again..."),
		msg("This is the way"),
		msg("waaazaaaaap"),
		msg("Pac-Manning through tech debt."),
		msg("Rolling for initiative against CI."),
		msg("Critical hit on the bug."),
		msg("Press F to pay respects to the build."),
		msg("Achievement unlocked: it compiled."),
		msg("GG no re."),
		msg("Slop forking open source."),
		msg("Speedrunning the refactor, any%."),
		msg("Frame-perfect commit."),
		msg("But our princess is in another castle."),
		msg("Do a barrel roll."),
		msg("Finish him!"),
		msg("Choose your weapon."),
		msg("Game over, man. Game over!"),
		msg("It's dangerous to go alone, take this: console.log()"),
		msg("All your branches are belong to us."),
		msg("The cake is a lie."),
		msg("Would you kindly..."),
		msg("Stay a while and listen."),
		msg("Snake? Snake?! SNAAAAKE!"),
		msg("Hadouken!"),
		msg("Fatality."),
		msg("You died. (deploy this anyway?)"),
		msg("Praise the sun."),
		msg("git gud."),
		msg("Tabs vs spaces holy war engaged."),
		msg("There is no spoon, but there is a stack overflow."),
		msg("This is fine. (everything is on fire)"),
		msg("Stonks."),
		msg("Big if true."),
		msg("It's free real estate."),
		msg("Sir, this is a Wendy's."),
		msg("They had us in the first half, not gonna lie."),
	],
};

// ═══════════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════════

/**
 * All built-in packs in display order. Consumers iterate this to build the
 * candidate message pool (after applying disabledPacks / safeMode filters).
 */
export const BUILTIN_VIBE_PACKS: readonly VibePack[] = [
	originals,
	breakingBad,
	betterCallSaul,
	xFiles,
	seinfeld,
	friends,
	theOffice,
	alwaysSunny,
	parksAndRec,
	arrestedDevelopment,
	thirtyRock,
	community,
	rickAndMorty,
	itCrowd,
	siliconValley,
	madMen,
	sopranos,
	avatar,
	spongebob,
	simpsons,
	gameOfThrones,
	starWars,
	starTrek,
	theMatrix,
	lordOfTheRings,
	princessBride,
	bigLebowski,
	anchorman,
	stepBrothers,
	popBlockbusters,
	internetGames,
];

/** Returns the set of all built-in pack IDs. */
export function getBuiltinVibePackIds(): string[] {
	return BUILTIN_VIBE_PACKS.map((p) => p.id);
}

/** Returns the text of all messages tagged "unsafe" across all built-in packs. */
export function getUnsafeMessageTexts(): string[] {
	return BUILTIN_VIBE_PACKS.flatMap((p) =>
		p.messages.filter((m) => m.tags?.includes("unsafe")).map((m) => m.text),
	);
}
