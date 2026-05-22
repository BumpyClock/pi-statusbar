/**
 * SGR mouse packet parsing and classification helpers.
 *
 * Stateless/pure — parses raw terminal input into structured mouse packets
 * and classifies button/scroll events. No side effects.
 */

export interface SgrMousePacket {
	code: number;
	col: number;
	row: number;
	final: "M" | "m";
}

export function parseSgrMousePackets(data: string): SgrMousePacket[] | null {
	const pattern = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/g;
	const packets: SgrMousePacket[] = [];
	let offset = 0;

	for (const match of data.matchAll(pattern)) {
		if (match.index !== offset) return null;
		offset = match.index + match[0].length;
		packets.push({
			code: Number(match[1]),
			col: Number(match[2]),
			row: Number(match[3]),
			final: match[4] as "M" | "m",
		});
	}

	return packets.length > 0 && offset === data.length ? packets : null;
}

export function mouseBaseButton(code: number): number {
	return code & ~(4 | 8 | 16 | 32);
}

export function mouseScrollDelta(packet: SgrMousePacket): number {
	if (packet.final !== "M") return 0;
	const baseButton = mouseBaseButton(packet.code);
	if (baseButton === 64) return 3;
	if (baseButton === 65) return -3;
	return 0;
}

export function isLeftPress(packet: SgrMousePacket): boolean {
	return (
		packet.final === "M" &&
		mouseBaseButton(packet.code) === 0 &&
		(packet.code & 32) === 0
	);
}

export function isLeftDrag(packet: SgrMousePacket): boolean {
	return (
		packet.final === "M" &&
		mouseBaseButton(packet.code) === 0 &&
		(packet.code & 32) !== 0
	);
}

export function isRightPress(packet: SgrMousePacket): boolean {
	return (
		packet.final === "M" &&
		mouseBaseButton(packet.code) === 2 &&
		(packet.code & 32) === 0
	);
}

export function isMouseRelease(packet: SgrMousePacket): boolean {
	return packet.final === "m";
}
