import { Assert } from '../helper/Assert';
import { Helper } from '../helper/Helper';

/**
 * A character queue with parsing helpers.
 */
export class TokenQueue {
	queue: string = '';
	pos: number = 0;

	// escape char for chomp balanced.
	private static readonly ESC: string = `\\`; // char

	/**
	 * Create a new TokenQueue.
	 * @param data string of data to back queue.
	 */
	constructor(data: string) {
		this.queue = Assert.notNull(data);
	}

	/**
	 * Is the queue empty?
	 * @return true if no data left in queue.
	 */
	isEmpty(): boolean {
		return this.remainingLength() === 0;
	}

	private remainingLength(): number {
		return this.queue.length - this.pos;
	}

	/**
	 * Add a string to the start of the queue.
	 * @param seq string to add.
	 */
	addFirst(seq: string): void {
		this.queue = seq + this.queue.substring(this.pos);
		this.pos = 0;
	}

	/**
	 * Tests if the next characters on the queue match the sequence. Case insensitive.
	 * @param seq String to check queue for.
	 * @return true if the next characters match.
	 */
	matches(seq: string): boolean {
		let str = seq.substring(this.pos, seq.length);
		return this.queue.toLowerCase() === str.toLowerCase();
	}

	/**
	 * Tests if the next characters match any of the sequences. Case insensitive.
	 * @param seq list of strings to case insensitively check for
	 * @return true of any matched, false if none did
	 */
	matchesAny(...seq: string[]): boolean {
		return [...seq].some((s) => this.matches(s));
	}

	/**
	 * Tests if the queue matches the sequence (as with match), and if they do, removes the matched string from the
	 * queue.
	 * @param seq String to search for, and if found, remove from queue.
	 * @return true if found and removed, false if not found.
	 */
	matchChomp(seq: string): boolean {
		if (this.matches(seq)) {
			this.pos += seq.length;
			return true;
		} else return false;
	}

	/**
	 * Tests if queue starts with a whitespace character.
	 * @return if starts with whitespace
	 */
	matchesWhitespace(): boolean {
		let codepoint = this.queue.codePointAt(this.pos);
		return !this.isEmpty() && Helper.isWhitespace(codepoint);
	}

	/**
	 * Test if the queue matches a word character (letter or digit).
	 * @return if matches a word character
	 */
	matchesWord(): boolean {
		return !this.isEmpty() && Helper.isLetterOrDigit(this.queue.charAt(this.pos));
	}

	/**
	 * Drops the next character off the queue.
	 */
	advance() {
		if (!this.isEmpty()) this.pos++;
	}

	/**
	 * Consume one character off queue.
	 * @return first character on queue.
	 */
	consume(): string;

	/**
	 * Consumes the supplied sequence of the queue. If the queue does not start with the supplied sequence, will
	 * throw an illegal state exception -- but you should be running match() against that condition.
	 * <p>
	 * Case insensitive.
	 * @param seq sequence to remove from head of queue.
	 */
	consume(seq: string): void;

	/**
	 * @private
	 */
	consume(seq?: string): any {
		if (seq === undefined) return this.queue.charAt(this.pos++);
		else if (!this.matches(seq)) throw new Error(`Queue did not match expected sequence`);
		else {
			let len = seq.length;
			if (len > this.remainingLength()) throw new Error(`Queue not long enough to consume sequence`);
			else this.pos += len;
		}
	}

	/**
	 * Pulls a string off the queue, up to but exclusive of the match sequence, or to the queue running out.
	 * @param seq String to end on (and not include in return, but leave on queue). <b>Case sensitive.</b>
	 * @return The matched data consumed from queue.
	 */
	consumeTo(seq: string): string {
		let offset = this.queue.indexOf(seq, this.pos);
		if (offset === -1) return this.remainder();
		else {
			let consumed = this.queue.substring(this.pos, offset);
			this.pos += consumed.length;
			return consumed;
		}
	}

	consumeToIgnoreCase(seq: string): string {
		let start = this.pos,
			first = seq.substring(0, 1);
		let canScan = first.toLowerCase() === first.toUpperCase();

		while (!this.isEmpty()) {
			if (this.matches(seq)) break;
			if (!canScan) this.pos++;
			else {
				let skip = this.queue.indexOf(first, this.pos) - this.pos;
				if (skip === 0) this.pos++;
				else if (skip < 0) this.pos = this.queue.length;
				else this.pos += skip;
			}
		}

		return this.queue.substring(start, this.pos);
	}

	/**
   Consumes to the first sequence provided, or to the end of the queue. Leaves the terminator on the queue.
   @param seq any number of terminators to consume to. <b>Case insensitive.</b>
   @return consumed string  
   */
	consumeToAny(...seq: string[]): string {
		let start = this.pos;
		while (!this.isEmpty() && !this.matchesAny(...seq)) this.pos++;
		return this.queue.substring(start, this.pos);
	}

	/**
	 * Pulls a string off the queue (like consumeTo), and then pulls off the matched string (but does not return it).
	 * <p>
	 * If the queue runs out of characters before finding the seq, will return as much as it can (and queue will go
	 * isEmpty() == true).
	 * @param seq String to match up to, and not include in return, and to pull off queue. <b>Case sensitive.</b>
	 * @return Data matched from queue.
	 */
	chompTo(seq: string): string {
		let data = this.consumeTo(seq);
		this.matchChomp(seq);
		return data;
	}

	chompToIgnoreCase(seq: string): string {
		let data = this.consumeToIgnoreCase(seq);
		this.matchChomp(seq);
		return data;
	}

	/**
	 * Pulls a balanced string off the queue. E.g. if queue is "(one (two) three) four", (,) will return "one (two) three",
	 * and leave " four" on the queue. Unbalanced openers and closers can be quoted (with ' or ") or escaped (with \). Those escapes will be left
	 * in the returned string, which is suitable for regexes (where we need to preserve the escape), but unsuitable for
	 * contains text strings; use unescape for that.
	 * @param open opener
	 * @param close closer
	 * @return data matched from the queue
	 */
	chompBalanced(open: string, close: string): string {
		let start = -1, end = -1, 	depth = 0, last = '0';
		let inSingleQuote = false, inDoubleQuote = false, inRegexQE = false;
		do {
			if (this.isEmpty()) break;
			let c = this.consume();
			if (last !== TokenQueue.ESC) {
				// inSingleQuote
				if (c === `'` && c !== open && !inDoubleQuote) {
					inSingleQuote = !inSingleQuote;
				}

				// inDoubleQuote
				else if (c === `"` && c !== open && !inSingleQuote) {
					inDoubleQuote = !inDoubleQuote;
				}

				//
				if (inSingleQuote || inDoubleQuote || inRegexQE) {
					last = c;
					continue;
				}

				if (c === open) {
					depth++;
					start = start === -1 ? this.pos : start;
				}
				//
				else if (c === close) depth--;
			}
			//
			else if (c === 'Q') inRegexQE = true;
			else if (c === 'E') inRegexQE = false;

			if (depth > 0 && last !== '0') end = this.pos;
			last = c;
		} while (depth > 0);

		let out = end >= 0 ? this.queue.substring(start, end) : '';
		if (depth > 0) throw new Error(`Did not find balanced marker at '${out}'`);
		return out;
	}

	/**
	 * Unescape a \ escaped string.
	 * @param in backslash escaped string
	 * @return unescaped string
	 */
	static unescape(input: string): string {
		let last = '0', out = '';
		for (let c of input.split('')) {
			if (c !== TokenQueue.ESC || last === TokenQueue.ESC) out += c;
			last = c;
		}
		return out;
	}

	/**
	 * Pulls the next run of whitespace characters of the queue.
	 * @return Whether consuming whitespace or not
	 */
	consumeWhitespace(): boolean {
		let seen = false;
		while (this.matchesWhitespace()) {
			this.pos++;
			seen = true;
		}
		return seen;
	}

	/**
	 * Retrieves the next run of word type (letter or digit) off the queue.
	 * @return String of word characters from queue, or empty string if none.
	 */
	consumeWord(): string {
		let start = this.pos;
		while (this.matchesWord()) this.pos++;
		return this.queue.substring(start, this.pos);
	}

	/**
	 * Consume a CSS element selector (tag name, but | instead of : for namespaces
	 * (or *| for wildcard namespace), to not conflict with :pseudo selects).
	 * @return tag name
	 */
	consumeElementSelector(): string {
		let start = this.pos;
		while (!this.isEmpty() && (this.matchesWord() || this.matchesAny('*|', '|', '_', '-'))) this.pos++;
		return this.queue.substring(start, this.pos);
	}

	/**
	 * Consume a CSS identifier (ID or class) off the queue (letter, digit, -, _)
	 * http://www.w3.org/TR/CSS2/syndata.html#value-def-identifier
	 * @return identifier
	 */
	consumeCssIdentifier(): string {
		let start = this.pos;
		while (!this.isEmpty() && (this.matchesWord() || this.matchesAny('-', '_'))) this.pos++;
		return this.queue.substring(start, this.pos);
	}

	/**
	 * Consume and return whatever is left on the queue.
	 * @return remained of queue.
	 */
	remainder(): string {
		let remainder = this.queue.substring(this.pos);
		this.pos = this.queue.length;
		return remainder;
	}

	toString(): string {
		return this.queue.substring(this.pos);
	}
}
