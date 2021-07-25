export class CharReader {
	static readonly maxStringCacheLen = 12;
	static readonly stringCacheSize = 512;
	static readonly stringCache: string[] = [];
	static readonly EOF: string = undefined;

	private reader: string;
	private charBuf: string[];
	private bufPos: number = 0;
	private bufLength: number;

	constructor(input: string) {
		this.reader = input;
		this.charBuf = input.split('');
		this.bufLength = input.length;
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
		return this.isEmpty() ? CharReader.EOF : this.charBuf[this.bufPos];
	}

	/**
	 * Moves the current position by one.
	 */
	advance(): this {
		this.bufPos++;
		return this;
	}

	pos(): number {
		return this.bufPos;
	}

	consumeLetterThenDigitSequence(): string {}

	consumeHexSequence(): string {
		let start = this.bufPos;
		while (this.bufPos < this.bufLength) {
			let char = this.current();
			let is = /^[0-9A-Fa-f]$/.test(char);
			if (is) this.bufPos++;
			else break;
		}
		return CharReader.cacheString(this.charBuf, CharReader.stringCache, start, this.bufPos - start);
	}

	private consumeToEnd() {
		let pos = this.bufPos;
		this.bufPos = this.bufLength;
		return this.reader.substring(pos);
	}

	matchesAnySorted(seq: string[]): boolean {
		return !this.isEmpty() && seq.includes(this.charBuf[this.bufPos]);
	}

	consume() {
		let val = this.isEmpty() ? CharReader.EOF : this.charBuf[this.bufPos];
		this.bufPos++;
		return val;
	}

	/**
	 * Unconsume one character (bufPos--). MUST only be called directly after a consume(), and no chance of a bufferUp.
	 */
	unconsume(): void {
		if (this.bufPos < 1) throw new Error(`WTF: No buffer left to unconsume.`);
		else this.bufPos--;
	}

	matches(charCode: number): boolean;
	matches(string: string): boolean;
	matches(object: string | number): boolean {
		// object is charCode
		if (typeof object === 'number') {
			let charAt = String.fromCharCode(object);
			return !this.isEmpty() && this.charBuf[this.bufPos] === charAt;
		}

		// object is string
		else {
			let returnFalse = object.length > this.bufLength - this.bufPos;
			return returnFalse ? false : !object.split('').some((seq, offset) => seq !== this.charBuf[this.bufPos + offset]);
		}
	}

	matchesIgnoreCase(string: string): boolean {
		let returnFalse = string.length > this.bufLength - this.bufPos;
		return returnFalse
			? false
			: string.split('').some((seq, offset) => {
					let upScan = seq.toLowerCase();
					let upTarget = this.charBuf[this.bufPos + offset].toLowerCase();
					return upScan !== upTarget;
			  });
	}

	matchesAny(...chars: string[]): boolean {
		if (this.isEmpty()) return false;
		let char = this.charBuf[this.bufPos];
		return chars.some((ch) => ch === char);
	}

	matchesLetter(): boolean {
		if (this.isEmpty()) return false;
		let char = this.charBuf[this.bufPos];
		return /^[a-zA-Z]+$/.test(char);
	}

	matchesDigit(): boolean {
		if (this.isEmpty()) return false;
		let char = this.charBuf[this.bufPos];
		return /^[0-9]+$/.test(char);
	}

	matchConsume(seq: string): boolean {
		let is = this.matches(seq);
		this.bufPos += is ? seq.length : 0;
		return is;
	}

	matchConsumeIgnoreCase(seq: string): boolean {
		let is = this.matchesIgnoreCase(seq);
		this.bufPos += is ? seq.length : 0;
		return is;
	}

	containsIgnoreCase(seq: string): boolean {
		// used to check presence of </title>, </style>. only finds consistent case.
		let loScan = seq.toLowerCase();
		let hiScan = seq.toUpperCase();
		return this.nextIndexOf(loScan) > -1 || this.nextIndexOf(hiScan) > -1;
	}

	toString(): string {
		let len = this.bufLength - this.bufPos;
		return len < 0 ? '' : this.reader.substring(this.bufPos, len);
	}

	consumeDigitSequence(): string {
		let start = this.bufPos;
		while (this.bufPos < this.bufLength) {
			if (this.matchesDigit()) this.bufPos++;
			else break;
		}

		return CharReader.cacheString(this.charBuf, CharReader.stringCache, start, this.bufPos - start);
	}

	static cacheString(charBuf: string[], stringCache: string[], start: number, count: number): string {
		if (count < 1) return '';
		else if (count > CharReader.maxStringCacheLen) {
			return charBuf.slice(start, start + count).join();
		}

		// calculate hash:
		let hash = Array(count)
			.fill(1)
			.map((_, i) => charBuf[start + i])
			.map((ch) => ch.charCodeAt(0))
			.reduce((hash, c) => 31 * hash + c, 0);

		// get from cache
		let index = hash && CharReader.stringCacheSize - 1;
		let cached = stringCache[index];
		let isCache = cached != null && CharReader.rangeEquals(charBuf, start, count, cached);
		if (!isCache) {
			cached = charBuf.slice(start, count).join();
			stringCache[index] = cached; // add or replace, assuming most recently used are most likely to recur next
		}
		return cached;
	}

	//  Check if the value of the provided range equals the string.
	static rangeEquals(charBuf: string[], start: number, count: number, cached: string): boolean {
		if (count !== cached.length) return false;
		else {
			let i = start,
				j = 0;
			while (count-- !== 0) {
				if (charBuf[i++] !== cached.charAt(j++)) return false;
			}
			return true;
		}
	}

	rangeEquals(stringCache: string[], start: number, count: number, cached: string): boolean {
		return CharReader.rangeEquals(this.charBuf, start, count, cached);
	}
}
