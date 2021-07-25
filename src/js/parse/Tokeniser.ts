import { ParseError, ParseErrorList } from './ParseError';
import { TokeniserState } from './TokeniserState';
import { StringBuilder } from '../helper/StringBuilder';
import { Assert } from '../helper/Assert';
import { Helper } from '../helper/Helper';
import * as tk from './Token';
import { CharacterReader } from './CharacterReader';

export class Tokeniser {
	static readonly replacementChar: string = '\uFFFD';
	static readonly notCharRefCharsSorted: string[] = ['\t', '\n', '\r', '\f', ' ', '<', '&'];

	// Some illegal character escapes are parsed by browsers as windows-1252 instead. See issue #1034
	// https://html.spec.whatwg.org/multipage/parsing.html#numeric-character-reference-end-state
	static readonly win1252ExtensionsStart = 0x80;
	static readonly win1252Extensions: number[] = [
		// we could build this manually, but Windows-1252 is not a standard java charset so that could break on
		// some platforms - this table is verified with a test
		// 0x20AC, 0x0081, 0x201A, 0x0192, 0x201E, 0x2026, 0x2020, 0x2021,
		// 0x02C6, 0x2030, 0x0160, 0x2039, 0x0152, 0x008D, 0x017D, 0x008F,
		// 0x0090, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2013, 0x2014,
		// 0x02DC, 0x2122, 0x0161, 0x203A, 0x0153, 0x009D, 0x017E, 0x0178,
	];

	//---------------------------

	private state: TokeniserState = TokeniserState.Data; // current tokenisation state
	private emitPending: tk.Token; // the token we are about to emit on next read
	private isEmitPending: boolean = false;
	private charsString: string = null; // characters pending an emit. Will fall to charsBuilder if more than one
	private charsBuilder = new StringBuilder(); // buffers characters to output as one token, if more than one emit per read
	dataBuffer = new StringBuilder(); // buffers data looking for </script>

	tagPending: tk.Tag; // tag we are building up
	startPending = new tk.StartTag();
	endPending = new tk.EndTag();
	charPending = new tk.Character();
	doctypePending = new tk.Doctype(); // doctype building up
	commentPending = new tk.Comment(); // comment building up
	protected lastStartTag: string; // the last start tag emitted, to test appropriate end tag

	protected readonly codepointHolder: number[] = [];
	protected readonly multipointHolder: number[] = [];

	constructor(
		protected readonly reader: CharacterReader, //
		protected readonly errors: ParseErrorList,
	) {}

	read(): tk.Token {
		while (!this.isEmitPending) {
			this.state.read(this, this.reader);
		}

		// if emit is pending, a non-character token was found: return
		// any chars in buffer, and leave token for next read:
		let cb = this.charsBuilder;
		if (cb.length !== 0) {
			let str = cb.toString();
			cb.delete(0, cb.length);
			this.charsString = null;
			return this.charPending.data(str);
		}

		//
		else if (this.charsString !== null) {
			let token = this.charPending.data(this.charsString);
			this.charsString = null;
			return token;
		}

		//
		else {
			this.isEmitPending = false;
			return this.emitPending;
		}
	}

	emitToken(token: tk.Token): void {
		Assert.isFalse(this.isEmitPending);
		this.emitPending = token;
		this.isEmitPending = true;

		if (token.isStartTag()) {
			let startTag = token.asStartTag();
			this.lastStartTag = startTag.get_tagName();
		}

		//
		else if (token.isEndTag()) {
			let endTag = token.asEndTag();
			if (endTag.hasAttributes()) {
				this.error('Attributes incorrectly present on end tag');
			}
		}
	}

	emitString(string: string | StringBuilder): void {
		let str = string.toString();

		if (this.charsString === null) {
			this.charsString = str;
		}
		//
		else {
			if (this.charsBuilder.length === 0) {
				this.charsBuilder.append(this.charsString);
			}
			this.charsBuilder.append(str);
		}
	}

	emitChars(chars: string[]): void {
		this.emitString(chars.join(''));
	}

	emitPoint(codePoints: number[]): void {
		let str = codePoints.map((cp) => String.fromCodePoint(cp)).join('');
		this.emitString(str);
	}

	getState(): TokeniserState {
		return this.state;
	}

	transition(state: TokeniserState) {
		this.state = state;
	}

	advanceTransition(state: TokeniserState) {
		this.reader.advance();
		this.state = state;
	}

	createTagPending(start: boolean): tk.Tag {
		this.tagPending = start ? this.startPending.reset() : this.endPending.reset();
		return this.tagPending;
	}

	emitTagPending(): void {
		this.tagPending.finaliseTag();
		this.emitToken(this.tagPending);
	}

	createCommentPending(): void {
		this.commentPending.reset();
	}

	emitCommentPending(): void {
		this.emitToken(this.commentPending);
	}

	createBogusCommentPending(): void {
		this.commentPending.reset();
		this.commentPending.bogus = true;
	}

	createDoctypePending(): void {
		this.doctypePending.reset();
	}

	emitDoctypePending(): void {
		this.emitToken(this.doctypePending);
	}

	createTempBuffer(): void {
		tk.Token.reset(this.dataBuffer);
	}

	isAppropriateEndTagToken(): boolean {
		return Helper.notNull(this.lastStartTag) && Helper.equalsIgnoreCase(this.tagPending.get_tagName(), this.lastStartTag);
	}

	appropriateEndTagName(): string {
		return this.lastStartTag; // could be null
	}

	error(state: TokeniserState | string): void {
		if (this.errors.canAddError()) {
			let errorMsg = typeof state === 'string' ? state : `Unexpected character '${this.reader.current()}' in input state [${state}]`;
			this.errors.push(new ParseError(this.reader.pos(), errorMsg));
		}
	}

	eofError(state: TokeniserState): void {
		if (this.errors.canAddError()) {
			let errorMsg = `Unexpectedly reached end of file (EOF) in input state [${state}]`;
			this.errors.push(new ParseError(this.reader.pos(), errorMsg));
		}
	}

	characterReferenceError(message: string): void {
		if (this.errors.canAddError()) {
			let errorMsg = `Invalid character reference: ${message}`;
			this.errors.push(new ParseError(this.reader.pos(), errorMsg));
		}
	}

	currentNodeInHtmlNS(): boolean {
		return true;
	}

	/**
	 * Utility method to consume reader and unescape entities found within.
	 * @param inAttribute if the text to be unescaped is in an attribute
	 * @return unescaped string from reader
	 */
	unescapeEntities(inAttribute: boolean): string {
		let builder = new StringBuilder();
		while (!this.reader.isEmpty()) {
			builder.append(this.reader.consumeTo('&'));
			if (this.reader.matches('&')) {
				this.reader.consume();
				let c: number[] = this.consumeCharacterReference(null, inAttribute);
				if (c === null || c.length === 0) builder.append('&');
				else {
					builder.appendCodePoint(c[0]);
					if (c.length === 2) builder.appendCodePoint(c[1]);
				}
			}
		}
		return builder.toString();
	}

	consumeCharacterReference(arg0: string, arg1: boolean): string[] {
		throw new Error('Method not implemented.');
	}
}
