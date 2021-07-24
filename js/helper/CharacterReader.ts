export class CharacterReader {
	static readonly EOF: string = undefined;
	private reader: string;
	private charBuf: string[];
	private bufPos: number;
	private bufLength: number;

	constructor(input: string) {
		this.reader = input;
		this.charBuf = input.split('');
		this.bufLength = input.length;
		this.bufPos = 0;
	}

	private indexOfWithIndex(char: string): number {
		return this.reader.indexOf(char, this.bufPos);
	}

	/**
	 * Reads characters up to the specific char.
	 * @param char the delimiter
	 * @return the chars read
	 */
	consumeTo(char: string): string {
		let pos = this.bufPos;
		let offset = this.indexOfWithIndex(char);
		if (offset !== -1) {
			this.bufPos = offset;
			return this.reader.substring(pos, offset);
		}
		//
		else return this.consumeToEnd();
	}

	/**
	 * Read characters until the first of any delimiters is found.
	 * @param chars delimiters to scan for
	 * @return characters read up to the matched delimiter.
	 */
	consumeToAny(chars: string[]): string {
		let offset = this.charBuf.slice(this.bufPos).findIndex((ch) => chars.includes(ch));
		let is_offset = offset === -1;
		let pos = this.bufPos;
		this.bufPos = is_offset ? this.bufLength - 1 : pos + offset;
		return is_offset ? '' : this.reader.substring(pos, offset + pos);
	}

	/**
	 * Tests if all the content has been read.
	 * @return true if nothing left to read.
	 */
	isEmpty(): boolean {
		return this.bufPos >= this.bufLength;
	}

	/**
	 * Get the char at the current position.
	 * @return char
	 */
	current(): string {
		return this.isEmpty() ? CharacterReader.EOF : this.charBuf[this.bufPos];
	}

	/**
	 * Moves the current position by one.
	 */
	advance(): this {
		this.bufPos++;
		return this;
	}

	private consumeToEnd() {
		let pos = this.bufPos;
		this.bufPos = this.bufLength;
		return this.reader.substring(pos);
	}
}
