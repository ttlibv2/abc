import { Char } from '../helper/Char';
import { Helper } from '../helper/Helper';

export class CharacterReader {
	static readonly EOF: Char = undefined;
	static readonly maxStringCacheLen = 12;
	static readonly maxBufferLen = 1024 * 32;
	static readonly minReadAheadLen = 1024;
	static readonly stringCacheSize: number = 512;
	static readonly readAheadLimit = CharacterReader.maxBufferLen * 0.75;
	private stringCache: string[] = Array(CharacterReader.stringCacheSize);

	private charBuf: Char[];
	private reader: string;
	private bufLength: number;
	private bufPos: number = 0;
	private readerPos: number = 0;
	private bufMark: number = -1;

	/**
	 * constructor
	 * @param input
	 * @param length
	 */
	constructor(input: string) {
		this.reader = input;
		this.charBuf = input.split('').map((str) => Char.valueOf(str));
		this.bufLength = this.charBuf.length;
		//this.bufSplitPoint = Math.min(this.bufLength, CharacterReader.readAheadLimit);
	}

	private bufferUp(): void {}

	/**
	 * Gets the current cursor position in the content.
	 * @return current position
	 */
	pos(): number {
		return this.readerPos + this.bufPos;
	}

	/**
	 * Tests if all the content has been read.
	 * @return true if nothing left to read.
	 */
	isEmpty(): boolean {
		this.bufferUp();
		return this.bufPos >= this.bufLength;
	}

	private isEmptyNoBufferUp(): boolean {
		return this.bufPos >= this.bufLength;
	}

	private getAtPos(): Char {
		return this.charBuf[this.bufPos];
	}

	/**
	 * Get the char at the current position.
	 * @return {Char}
	 */
	current(): Char {
		this.bufferUp();
		return this.isEmptyNoBufferUp() ? CharacterReader.EOF : this.getAtPos();
	}

	consume(): Char {
		this.bufferUp();
		let val = this.isEmptyNoBufferUp() ? CharacterReader.EOF : this.getAtPos();
		this.bufPos++;
		return val;
	}

	/**
	 * Unconsume one character (bufPos--).
	 * MUST only be called directly after a consume(), and no chance of a bufferUp.
	 */
	unconsume(): void {
		if (this.bufPos < 1) throw new Error(`WTF: No buffer left to unconsume.`);
		else this.bufPos--;
	}

	/**
	 * Moves the current position by one.
	 */
	advance(): void {
		this.bufPos++;
	}

	mark() {
		// make sure there is enough look ahead capacity
		// if (this.bufLength - this.bufPos < CharacterReader.minReadAheadLen) this.bufSplitPoint = 0;
		// this.bufferUp();
		// this.bufMark = this.bufPos;
	}

	unmark(): void {
		this.bufMark = -1;
	}

	rewindToMark(): void {
		if (this.bufMark === -1) throw new Error('Mark invalid');
		this.bufPos = this.bufMark;
		this.unmark();
	}

	/**
	 * Returns the number of characters between the current position and the next instance of the input char
	 * @param c scan target
	 * @return offset between current position and next instance of target. -1 if not found.
	 */
	nextIndexOf(c: Char | string): number {
		this.bufferUp();
		let index = this.reader.indexOf(c.toString(), this.bufPos);
		return index === -1 ? -1 : index - this.bufPos;
	}

	/**
	 * Reads characters up to the specific char.
	 * @param c the delimiter
	 * @return the chars read
	 */
	consumeTo(c: Char | string): string {
		let seq = c.toString();
		let offset = this.nextIndexOf(seq);
		if (offset !== -1) {
			let consumed = CharacterReader.cacheString(this.charBuf, this.stringCache, this.bufPos, offset);
			this.bufPos += offset;
			return consumed;
		}
		//
		else if (Char.isChar(c) || c.length === 1 || this.bufLength - this.bufPos < seq.length) {
			// nextIndexOf() did a bufferUp(), so if the buffer is shorter than the search string, we must be at EOF
			return this.consumeToEnd();
		}
		//
		else {
			// the string we're looking for may be straddling a buffer boundary, so keep (length - 1) characters
			// unread in case they contain the beginning of the search string
			let endPos = this.bufLength - seq.length + 1;
			let consumed = CharacterReader.cacheString(this.charBuf, this.stringCache, this.bufPos, endPos - this.bufPos);
			this.bufPos = endPos;
			return consumed;
		}
	}

	private returnConsume(index: number): string {
		let pos = this.bufPos;
		this.bufPos += Math.max(index, 0);
		return index === -1 ? '' : CharacterReader.cacheString(this.charBuf, this.stringCache, pos, index);
	}

	/**
	 * Read characters until the first of any delimiters is found.
	 * @param chars delimiters to scan for
	 * @return characters read up to the matched delimiter.
	 */
	consumeToAny(chars: Char[]): string {
		this.bufferUp();
		return this.returnConsume(this.charBuf.slice(this.bufPos).findIndex((ch) => chars.includes(ch)));
	}

	// Java: Arrays.binarySearch()
	consumeToAnySorted(chars: Char[]): string {
		return this.consumeToAny(chars);
	}

	// &, <, null
	consumeData(): string {
		let chars = [Char.valueOf('&'), Char.valueOf('<'), Char.NULL];
		return this.consumeToAny(chars);
	}

	// & , ' , "
	consumeAttributeQuoted(single: boolean): string {
		return this.returnConsume(
			this.charBuf.slice(this.bufPos).findIndex((ch) => {
				if (ch.equals('&') || ch === Char.NULL) return true;
				else if (ch.equals(`'`) && single) return true;
				else if (ch.equals(`"`) && !single) return true;
				else return false;
			}),
		);
	}

	// < | nullChar
	consumeRawData(): string {
		return this.returnConsume(this.charBuf.slice(this.bufPos).findIndex((ch) => ch.equals('<') || ch === Char.NULL));
	}

	// '\t', '\n', '\r', '\f', ' ', '/', '>'
	consumeTagName(): string {
		// NOTE: out of spec, added '<' to fix common author bugs; does not stop and append on nullChar but eats
		this.bufferUp();
		let array = ['\t', '\n', '\r', '\f', ' ', '/', '>', '<'];
		return this.returnConsume(this.charBuf.slice(this.bufPos).findIndex((ch) => ch.in(array)));
	}

	consumeToEnd(): string {
		this.bufferUp();
		let data = CharacterReader.cacheString(this.charBuf, this.stringCache, this.bufPos, this.bufLength - this.bufPos);
		this.bufPos = this.bufLength;
		return data;
	}

	consumeLetterSequence(): string {
		this.bufferUp();
		return this.returnConsume(this.charBuf.slice(this.bufPos).findIndex((ch) => !Helper.isLetter(ch)));
	}

	consumeDigitSequence(): string {
		this.bufferUp();
		return this.returnConsume(this.charBuf.slice(this.bufPos).findIndex((ch) => !Helper.isDigit(ch)));
	}

	consumeLetterThenDigitSequence(): string {
		this.bufferUp();
		let pos = this.bufPos;

		// letter
		let index = this.charBuf.slice(this.bufPos).findIndex((ch) => !Helper.isLetter(ch));
		this.bufPos += Math.max(index, 0);

		// digit
		if (!this.isEmptyNoBufferUp()) {
			let index = this.charBuf.slice(this.bufPos).findIndex((ch) => !Helper.isDigit(ch));
			this.bufPos += Math.max(index, 0);
		}

		return CharacterReader.cacheString(this.charBuf, this.stringCache, pos, this.bufPos - pos);
	}

	consumeHexSequence(): string {
		this.bufferUp();
		return this.returnConsume(this.charBuf.slice(this.bufPos).findIndex((ch) => !/^[0-9a-fA-F]/.test(ch.toString())));
	}

	matches(c: Char | string): boolean {
		if (Char.isChar(c)) return !this.isEmpty() && c.equals(this.getAtPos());
		else {
			this.bufferUp();
			let scanLength = c.length;
			if (scanLength > this.bufLength - this.bufPos) return false;
			else {
				let pos = this.bufPos;
				return !c.split('').some((ch, i) => !this.charBuf[pos + i].equals(ch));
			}
		}
	}

	matchesIgnoreCase(seq: string): boolean {
		this.bufferUp();
		let scanLength = seq.length;
		if (scanLength > this.bufLength - this.bufPos) return false;
		else return !seq.split('').some((ch, i) => !this.charBuf[this.bufPos + i].equals(ch));
	}

	matchesAny(...seq: Char[]): boolean {
		if (this.isEmpty()) return false;
		else {
			this.bufferUp();
			let c = this.getAtPos();
			return seq.some((ch) => ch.equals(c));
		}
	}

	matchesAnySorted(seq: Char[]): boolean {
		this.bufferUp();
		let str = this.getAtPos();
		return !this.isEmpty() && seq.some((ch) => ch.equals(str));
	}

	matchesLetter(): boolean {
		if (this.isEmpty()) return false;
		else return Helper.isLetter(this.getAtPos());
	}

	matchesDigit(): boolean {
		if (this.isEmpty()) return false;
		else return Helper.isDigit(this.getAtPos());
	}

	matchConsume(seq: string): boolean {
		if (this.matchesIgnoreCase(seq)) {
			this.bufPos += seq.length;
			return true;
		} else return false;
	}

	containsIgnoreCase(seq: string): boolean {
		// used to check presence of </title>, </style>. only finds consistent case.
		let loScan = seq.toLowerCase();
		let hiScan = seq.toUpperCase();
		return this.nextIndexOf(loScan) > -1 || this.nextIndexOf(hiScan) > -1;
	}

	toString(): string {
		if (this.bufLength - this.bufPos < 0) return '';
		else return this.charBuf.slice(this.bufPos, this.bufLength - this.bufPos).join('');
	}

	/**
	 * Caches short strings, as a flyweight pattern, to reduce GC load. Just for this doc, to prevent leaks.
	 * <p />
	 * Simplistic, and on hash collisions just falls back to creating a new string, vs a full HashMap with Entry list.
	 * That saves both having to create objects as hash keys, and running through the entry list, at the expense of
	 * some more duplicates.
	 */
	static cacheString(charBuf: Char[], stringCache: string[], start: number, count: number): string {
		// limit (no cache):
		if (count > CharacterReader.maxStringCacheLen) return charBuf.slice(start, count).join('');
		else if (count < 1) return '';

		// calculate hash:
		let hash = Array(count)
			.fill(1)
			.map((_, i) => charBuf[start + i])
			.reduce((v, c) => 31 * v + c.charCode, 0);

		// get from cache
		let index = hash & (CharacterReader.stringCacheSize - 1);
		let cached = stringCache[index];

		if (cached != null && CharacterReader.rangeEquals(charBuf, start, count, cached))
			// positive hit
			return cached;
		else {
			cached = charBuf.slice(start, count).join();
			stringCache[index] = cached; // add or replace, assuming most recently used are most likely to recur next
			return cached;
		}
	}

	/**
	 * Check if the value of the provided range equals the string.
	 */
	static rangeEquals(charBuf: Char[], start: number, count: number, cached: string): boolean {
		if (count === cached.length) {
			let i = start;
			let j = 0;
			while (count-- !== 0) {
				if (!charBuf[i++].equals(cached.charAt(j++))) return false;
			}
			return true;
		}
		return false;
	}

	// just used for testing
	rangeEquals(start: number, count: number, cached: string): boolean {
		return CharacterReader.rangeEquals(this.charBuf, start, count, cached);
	}
}
