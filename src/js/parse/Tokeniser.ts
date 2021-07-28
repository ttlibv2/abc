import { Assert } from '../helper/Assert';
import { Char } from '../helper/Char';
import { Helper } from '../helper/Helper';
import { StringBuilder } from '../helper/StringBuilder';
import { Entities } from '../nodes/Entities';
import { CharacterReader } from './CharacterReader';
import { ParseError, ParseErrorList } from './ParseError';
import { Character, Comment, Doctype, EndTag, StartTag, Tag, Token } from './Token';
import { TokeniserState } from './TokeniserState';

export class Tokeniser {
	static readonly replacementChar = Char.Default;
	static readonly notCharRefCharsSorted: Char[] = Char.array2Char(['\t', '\n', '\r', '\f', ' ', '<', '&']);

	// Some illegal character escapes are parsed by browsers as windows-1252 instead. See issue #1034
	// https://html.spec.whatwg.org/multipage/parsing.html#numeric-character-reference-end-state
	static readonly win1252ExtensionsStart: number = 0x80;
	static readonly win1252Extensions: number[] = [
		// we could build this manually, but Windows-1252 is not a standard java charset so that could break on
		// some platforms - this table is verified with a test
		//0x20AC, 0x0081, 0x201A, 0x0192, 0x201E, 0x2026, 0x2020, 0x2021,
		//0x02C6, 0x2030, 0x0160, 0x2039, 0x0152, 0x008D, 0x017D, 0x008F,
		//0x0090, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2013, 0x2014,
		//0x02DC, 0x2122, 0x0161, 0x203A, 0x0153, 0x009D, 0x017E, 0x0178,
	];

	state = TokeniserState.Data; // current tokenisation state
	emitPending: Token; // the token we are about to emit on next read
	isEmitPending: boolean = false;
	charsString: string = null; // characters pending an emit. Will fall to charsBuilder if more than one

	charsBuilder = new StringBuilder(); // buffers characters to output as one token, if more than one emit per read
	dataBuffer = new StringBuilder(); // buffers data looking for </script>

	tagPending: Tag; // tag we are building up
	startPending = new StartTag();
	endPending = new EndTag();
	charPending = new Character();
	doctypePending = new Doctype(); // doctype building up
	commentPending = new Comment(); // comment building up
	lastStartTag: string; // the last start tag emitted, to test appropriate end tag

	private codepointHolder: number[] = Array(1);
	private multipointHolder: number[] = Array(2);

	constructor(
		private readonly reader: CharacterReader, //
		private readonly errors: ParseErrorList,
	) {}

	read(): Token {
		while (!this.isEmitPending) {
			this.state.read(this, this.reader);
		}

		// if emit is pending, a non-character token was found:
		// return any chars in buffer, and leave token for next read:
		let cb = this.charsBuilder;
		if (cb.length !== 0) {
			let str = cb.toString();
			cb.delete(0, cb.length);
			this.charsString = null;
			return this.charPending.data(str);
		} //
		else if (this.charsString !== null) {
			let token = this.charPending.data(this.charsString);
			this.charsString = null;
			return token;
		} //
		else {
			this.isEmitPending = false;
			return this.emitPending;
		}
	}

	/**
	 * @param {Token} token
	 */
	emit(token: Token): void;

	/**
	 * @param {string} str
	 */
	emit(str: string): void;

	/**
	 * @param {StringBuilder} str
	 */
	emit(str: StringBuilder): void;

	/**
	 * @param {Char} c
	 */
	emit(c: Char): void;

	/**
	 * @param {Char[]} chars
	 */
	emit(chars: Char[]): void;

	/**
	 * @param {number[]} codepoint
	 */
	emit(codepoint: number[]): void;

	/** @private */
	emit(object: any): void {
		//

		// object is token
		if (object instanceof Token) {
			Assert.isFalse(this.isEmitPending);
			this.emitPending = object;
			this.isEmitPending = true;

			if (object.isStartTag()) this.lastStartTag = object.name();
			else if (object.isEndTag() && object.hasAttributes()) {
				throw this.error(`Attributes incorrectly present on end tag`);
			}
		}

		//
		else {
			let apply = (str: String) => {
				if (this.charsString === null) this.charsString = object;
				else {
					if (this.charsBuilder.isEmpty()) {
						this.charsBuilder.append(this.charsString);
					}
					this.charsBuilder.append(object);
				}
			};

			// object is string
			if (Helper.isString(object)) {
				apply(object);
			}

			// object is StringBuilder
			else if (object instanceof StringBuilder) {
				apply(object.toString());
			}

			// object is Char
			else if (object instanceof Char) {
				apply(object.string);
			}

			// object is array char
			else if (Array.isArray(object) && Char.isChar(object[0])) {
				apply(object.map((o) => o.string).join(''));
			}
		}
	}

	getState(): TokeniserState {
		return this.state;
	}

	transition(state: TokeniserState) {
		this.state = state;
		return this;
	}

	advanceTransition(state: TokeniserState) {
		this.reader.advance();
		this.state = state;
		return this;
	}

	createTagPending(start: boolean): Tag {
		return start ? this.startPending.reset() : this.endPending.reset();
	}

	emitTagPending(): void {
		this.tagPending.finaliseTag();
		this.emit(this.tagPending);
	}

	createCommentPending(): void {
		this.commentPending.reset();
	}

	emitCommentPending(): void {
		this.emit(this.commentPending);
	}

	createBogusCommentPending(): void {
		this.commentPending.reset();
		this.commentPending.bogus = true;
	}

	createDoctypePending(): void {
		this.doctypePending.reset();
	}

	emitDoctypePending(): void {
		this.emit(this.doctypePending);
	}

	createTempBuffer(): void {
		Token.reset(this.dataBuffer);
	}

	isAppropriateEndTagToken(): boolean {
		return Helper.notNull(this.lastStartTag) && Helper.equalsIgnoreCase(this.tagPending.name(), this.lastStartTag);
	}

	appropriateEndTagName(): string {
		return this.lastStartTag; // could be null
	}

	error(object: TokeniserState | string): void {
		if (this.errors.canAddError()) {
			let r = this.reader;
			let errorMsg = Helper.isString(object) ? object : `Unexpected character '${r.current()}' in input state [${object}]`;
			this.errors.push(new ParseError(r.pos(), errorMsg));
		}
	}

	eofError(state: TokeniserState): void {
		if (this.errors.canAddError()) {
			let errorMsg = `Unexpectedly reached end of file (EOF) in input state [${state}]`;
			this.errors.push(new ParseError(this.reader.pos(), errorMsg));
		}
	}

	private characterReferenceError(message: string): void {
		if (this.errors.canAddError()) {
			let errorMsg = `Invalid character reference: ${message}`;
			this.errors.push(new ParseError(this.reader.pos(), errorMsg));
		}
	}

	currentNodeInHtmlNS(): boolean {
		// todo: implement namespaces correctly
		return true;
		// Element currentNode = currentNode();
		// return currentNode != null && currentNode.namespace().equals("HTML");
	}

	/**
	 * Return codepoint[]
	 * @param additionalAllowedCharacter
	 * @param inAttr
	 */
	consumeCharacterReference(additionalAllowedCharacter: Character, inAttr: boolean): number[] {
		if (this.reader.isEmpty()) return null;
		else if (Helper.notNull(additionalAllowedCharacter) && this.reader.current().equal(additionalAllowedCharacter.getData())) return null;
		else if (this.reader.matchesAnySorted(Tokeniser.notCharRefCharsSorted)) return null;
		else {
			let codeRef = this.codepointHolder;
			this.reader.mark();

			if (this.reader.matchConsume('#')) {
				// numbered
				let isHexMode = this.reader.matchesIgnoreCase('X');
				let numRef = isHexMode ? this.reader.consumeHexSequence() : this.reader.consumeDigitSequence();
				if (numRef.length === 0) {
					// didn't match anything
					this.characterReferenceError('numeric reference with no numerals');
					this.reader.rewindToMark();
					return null;
				}

				this.reader.unmark();
				if (!this.reader.matchConsume(';')) {
					this.characterReferenceError('missing semicolon'); // missing semi
				}

				let base = isHexMode ? 16 : 10;
				let charval = parseInt(numRef, base);

				if (charval === -1 || (charval >= 0xd800 && charval <= 0xdfff) || charval > 0x10ffff) {
					this.characterReferenceError('character outside of valid range');
					codeRef[0] = Tokeniser.replacementChar.codepoint;
				} //
				else {
					// fix illegal unicode characters to match browser behavior
					if (charval >= Tokeniser.win1252ExtensionsStart && charval < Tokeniser.win1252ExtensionsStart + Tokeniser.win1252Extensions.length) {
						this.characterReferenceError('character is not a valid unicode code point');
						charval = Tokeniser.win1252Extensions[charval - Tokeniser.win1252ExtensionsStart];
					}

					// todo: implement number replacement table
					// todo: check for extra illegal unicode points as parse errors
					codeRef[0] = charval;
				}

				return codeRef;
			} //
			else {
				//name

				// get as many letters as possible, and look for matching entities.
				let nameRef = this.reader.consumeLetterThenDigitSequence();
				let looksLegit = this.reader.matches(';');

				// found if a base named entity without a ;, or an extended entity with the ;.
				let found = Entities.isBaseNamedEntity(nameRef) || (Entities.isNamedEntity(nameRef) && looksLegit);

				if (!found) {
					this.reader.rewindToMark();
					if (looksLegit) {
						// named with semicolon
						this.characterReferenceError('invalid named reference');
					}
					return null;
				}

				if (inAttr && (this.reader.matchesLetter() || this.reader.matchesDigit() || this.reader.matchesAny('=', '-', '_'))) {
					// don't want that to match
					this.reader.rewindToMark();
					return null;
				}

				this.reader.unmark();
				if (!this.reader.matchConsume(';')) this.characterReferenceError('missing semicolon'); // missing semi
				let numChars = Entities.codepointsForName(nameRef, this.multipointHolder);
				if (numChars === 1) {
					codeRef[0] = this.multipointHolder[0];
					return codeRef;
				} //
				else if (numChars === 2) {
					return this.multipointHolder;
				} //
				else {
					Assert.fail('Unexpected characters returned for ' + nameRef);
					return this.multipointHolder;
				}
			}
		}
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
				let c = this.consumeCharacterReference(null, inAttribute);
				if (c == null || c.length === 0) builder.append('&');
				else {
					builder.appendCodePoint(c[0]);
					if (c.length === 2) builder.appendCodePoint(c[1]);
				}
			}
		}
		return builder.toString();
	}
}
