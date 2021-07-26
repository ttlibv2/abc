import { Helper } from '../helper/Helper';
import { DocumentType } from '../nodes/DocumentType';
import { CharacterReader } from './CharacterReader';
import { CData, EOF } from './Token';
import { Tokeniser } from './Tokeniser';
import { Char } from '../helper/Char';

export class TokeniserState {
	//==========================================
	static readonly nullChar: string = Char.NULL.charAt(0);
	static readonly attributeNameCharsSorted: Char[] = Char.arrayOf(['\t', '\n', '\f', '\r', ' ', '"', "'", '/', '<', '=', '>']);
	static readonly attributeValueUnquoted: Char[] = Char.arrayOf(['\u0000', '\t', '\n', '\f', '\r', ' ', '"', '&', "'", '<', '=', '>', '`']);
	static readonly replacementChar: Char = Tokeniser.replacementChar;
	static readonly replacementStr: string = String(Tokeniser.replacementChar);
	static readonly eof: string = CharacterReader.EOF.charAt(0);

	private constructor(private readCb: (t: Tokeniser, r: CharacterReader, thisArgs?: any) => void) {}

	read(t: Tokeniser, r: CharacterReader): void {
		this.readCb(t, r, this);
	}

	/**
	 * Handles RawtextEndTagName, ScriptDataEndTagName, and ScriptDataEscapedEndTagName. Same body impl, just
	 * different else exit transitions.
	 */
	private static handleDataEndTag(t: Tokeniser, r: CharacterReader, elseTransition: TokeniserState): void {
		// matchesLetter
		if (r.matchesLetter()) {
			let name = r.consumeLetterSequence();
			t.tagPending.appendTagName(name);
			t.dataBuffer.append(name);
		} //
		else {
			let needsExitTransition = !(t.isAppropriateEndTagToken() && !r.isEmpty());
			if (!needsExitTransition) {
				let c = r.consume();
				switch (c.charAt(0)) {
					case '\t':
					case '\n':
					case '\r':
					case '\f':
					case ' ':
						t.transition(TokeniserState.BeforeAttributeName);
						break;
					case '/':
						t.transition(TokeniserState.SelfClosingStartTag);
						break;
					case '>':
						t.emitTagPending();
						t.transition(TokeniserState.Data);
						break;
					default:
						t.dataBuffer.append(c);
						needsExitTransition = true;
				}
			}

			//
			if (needsExitTransition) {
				t.emitString('</');
				t.emitString(t.dataBuffer);
				t.transition(elseTransition);
			}
		}
	}

	private static readRawData(t: Tokeniser, r: CharacterReader, current: TokeniserState, advance: TokeniserState): void {
		switch (r.current().charAt(0)) {
			case '<':
				t.advanceTransition(advance);
				break;
			case TokeniserState.nullChar:
				t.error(current);
				r.advance();
				t.emitString(TokeniserState.replacementStr);
				break;
			case TokeniserState.eof:
				t.emitToken(new EOF());
				break;
			default:
				let data = r.consumeRawData();
				t.emitString(data);
				break;
		}
	}

	private static readCharRef(t: Tokeniser, advance: TokeniserState): void {
		let c = t.consumeCharacterReference(null, false);
		if (Helper.isNull(c)) t.emitString('&');
		else t.emitChars(c);
		t.transition(advance);
	}

	private static readEndTag(t: Tokeniser, r: CharacterReader, a: TokeniserState, b: TokeniserState): void {
		if (r.matchesLetter()) {
			t.createTagPending(false);
			t.transition(a);
		} else {
			t.emitString('</');
			t.transition(b);
		}
	}

	private static handleDataDoubleEscapeTag(t: Tokeniser, r: CharacterReader, primary: TokeniserState, fallback: TokeniserState): void {
		if (r.matchesLetter()) {
			let name = r.consumeLetterSequence();
			t.dataBuffer.append(name);
			t.emitString(name);
			return;
		}

		//
		let c = r.consume();
		switch (c) {
			case '\t':
			case '\n':
			case '\r':
			case '\f':
			case ' ':
			case '/':
			case '>':
				if (t.dataBuffer.toString() === 'script') t.transition(primary);
				else t.transition(fallback);
				t.emitString(c);
				break;
			default:
				r.unconsume();
				t.transition(fallback);
		}
	}

	private static anythingElse(t: Tokeniser, r: CharacterReader) {
		t.emitString('</');
		t.emitString(t.dataBuffer);
		r.unconsume();
		t.transition(TokeniserState.Rcdata);
	}

	//=====================================================
	//
	//=====================================================

	// Data
	static Data = new TokeniserState((t, r, thisArgs) => {
		switch (r.current()) {
			case '&':
				t.advanceTransition(TokeniserState.CharacterReferenceInData);
				break;
			case '<':
				t.advanceTransition(TokeniserState.TagOpen);
				break;
			case TokeniserState.nullChar:
				t.error(thisArgs); // NOT replacement character (oddly?)
				t.emitString(r.consume());
				break;
			case TokeniserState.eof:
				t.emitToken(new EOF());
				break;
			default:
				let data = r.consumeData();
				t.emitString(data);
				break;
		}
	});

	// CharacterReferenceInData
	static CharacterReferenceInData: TokeniserState = new TokeniserState((t, r, thisArgs) => {
		TokeniserState.readCharRef(t, TokeniserState.Data);
	});

	// handles data in title, textarea etc
	// Rcdata
	static Rcdata = new TokeniserState((t, r, thisArgs) => {
		switch (r.current()) {
			case '&':
				t.advanceTransition(TokeniserState.CharacterReferenceInRcdata);
				break;
			case '<':
				t.advanceTransition(TokeniserState.RcdataLessthanSign);
				break;
			case TokeniserState.nullChar:
				t.error(thisArgs);
				r.advance();
				t.emitString(TokeniserState.replacementStr);
				break;
			case TokeniserState.eof:
				t.emitToken(new EOF());
				break;
			default:
				let data = r.consumeData();
				t.emitString(data);
				break;
		}
	});

	// CharacterReferenceInRcdata
	static CharacterReferenceInRcdata = new TokeniserState((t, r, thisArgs) => {
		TokeniserState.readCharRef(t, TokeniserState.Rcdata);
	});

	// Rawtext
	static Rawtext = new TokeniserState((t, r, thisArgs) => {
		TokeniserState.readRawData(t, r, thisArgs, TokeniserState.RawtextLessthanSign);
	});

	// ScriptData
	static ScriptData = new TokeniserState((t, r, thisArgs) => {
		TokeniserState.readRawData(t, r, thisArgs, TokeniserState.ScriptDataLessthanSign);
	});

	// PLAINTEXT
	static PLAINTEXT = new TokeniserState((t, r, thisArgs) => {
		switch (r.current()) {
			case TokeniserState.nullChar:
				t.error(thisArgs);
				r.advance();
				t.emitString(TokeniserState.replacementStr);
				break;
			case TokeniserState.eof:
				t.emitToken(new EOF());
				break;
			default:
				let data = r.consumeTo(TokeniserState.nullChar);
				t.emitString(data);
				break;
		}
	});

	// from < in data
	// TagOpen
	static TagOpen = new TokeniserState((t, r, thisArgs) => {
		switch (r.current()) {
			case '!':
				t.advanceTransition(TokeniserState.MarkupDeclarationOpen);
				break;
			case '/':
				t.advanceTransition(TokeniserState.EndTagOpen);
				break;
			case '?':
				t.createBogusCommentPending();
				t.advanceTransition(TokeniserState.BogusComment);
				break;
			default:
				if (r.matchesLetter()) {
					t.createTagPending(true);
					t.transition(TokeniserState.TagName);
				} else {
					t.error(thisArgs);
					t.emitString('<'); // char that got us here
					t.transition(TokeniserState.Data);
				}
				break;
		}
	});

	// EndTagOpen
	static EndTagOpen = new TokeniserState((t, r, thisArgs) => {
		if (r.isEmpty()) {
			t.eofError(thisArgs);
			t.emitString('</');
			t.transition(TokeniserState.Data);
		} else if (r.matchesLetter()) {
			t.createTagPending(false);
			t.transition(TokeniserState.TagName);
		} else if (r.matches('>')) {
			t.error(thisArgs);
			t.advanceTransition(TokeniserState.Data);
		} else {
			t.error(thisArgs);
			t.createBogusCommentPending();
			t.advanceTransition(TokeniserState.BogusComment);
		}
	});

	// TagName
	// from < or </ in data, will have start or end tag pending
	// previous TagOpen state did NOT consume, will have a letter char in current
	static TagName = new TokeniserState((t, r, thisArgs) => {
		let tagName = r.consumeTagName();
		t.tagPending.appendTagName(tagName);

		let c: string = r.consume();
		switch (c) {
			case '\t':
			case '\n':
			case '\r':
			case '\f':
			case ' ':
				t.transition(TokeniserState.BeforeAttributeName);
				break;
			case '/':
				t.transition(TokeniserState.SelfClosingStartTag);
				break;
			case '<': // NOTE: out of spec, but clear author intent
				r.unconsume();
				t.error(thisArgs);
			// intended fall through to next >
			case '>':
				t.emitTagPending();
				t.transition(TokeniserState.Data);
				break;
			case TokeniserState.nullChar: // replacement
				t.tagPending.appendTagName(TokeniserState.replacementStr);
				break;
			case TokeniserState.eof: // should emit pending tag?
				t.eofError(thisArgs);
				t.transition(TokeniserState.Data);
				break;
			default:
				// buffer underrun
				t.tagPending.appendTagName(c);
		}
	});

	// RcdataLessthanSign
	// from < in rcdata
	static RcdataLessthanSign = new TokeniserState((t, r, thisArgs) => {
		if (r.matches('/')) {
			t.createTempBuffer();
			t.advanceTransition(TokeniserState.RCDATAEndTagOpen);
		}

		//
		else if (r.matchesLetter() && Helper.notNull(t.appropriateEndTagName()) && !r.containsIgnoreCase('</' + t.appropriateEndTagName())) {
			// diverge from spec: got a start tag, but there's no appropriate end tag (</title>), so rather than
			// consuming to EOF; break out here
			t.tagPending = t.createTagPending(false).set_tagName(t.appropriateEndTagName());
			t.emitTagPending();
			t.transition(TokeniserState.TagOpen); // straight into TagOpen, as we came from < and looks like we're on a start tag
		} else {
			t.emitString('<');
			t.transition(TokeniserState.Rcdata);
		}
	});

	// RCDATAEndTagOpen
	static RCDATAEndTagOpen = new TokeniserState((t, r, thisArgs) => {
		if (r.matchesLetter()) {
			t.createTagPending(false);
			t.tagPending.appendTagName(r.current());
			t.dataBuffer.append(r.current());
			t.advanceTransition(TokeniserState.RCDATAEndTagName);
		} else {
			t.emitString('</');
			t.transition(TokeniserState.Rcdata);
		}
	});

	// RCDATAEndTagName
	static RCDATAEndTagName = new TokeniserState((t, r, thisArgs) => {
		if (r.matchesLetter()) {
			let name = r.consumeLetterSequence();
			t.tagPending.appendTagName(name);
			t.dataBuffer.append(name);
			return;
		}

		let c = r.consume();
		switch (c) {
			case '\t':
			case '\n':
			case '\r':
			case '\f':
			case ' ':
				if (t.isAppropriateEndTagToken()) t.transition(TokeniserState.BeforeAttributeName);
				else TokeniserState.anythingElse(t, r);
				break;
			case '/':
				if (t.isAppropriateEndTagToken()) t.transition(TokeniserState.SelfClosingStartTag);
				else TokeniserState.anythingElse(t, r);
				break;
			case '>':
				if (t.isAppropriateEndTagToken()) {
					t.emitTagPending();
					t.transition(TokeniserState.Data);
				} else TokeniserState.anythingElse(t, r);
				break;
			default:
				TokeniserState.anythingElse(t, r);
		}
	});

	// RawtextLessthanSign
	static RawtextLessthanSign = new TokeniserState((t, r, thisArgs) => {
		if (r.matches('/')) {
			t.createTempBuffer();
			t.advanceTransition(TokeniserState.RawtextEndTagOpen);
		} else {
			t.emitString('<');
			t.transition(TokeniserState.Rawtext);
		}
	});

	// RawtextEndTagOpen
	static RawtextEndTagOpen = new TokeniserState((t, r, thisArgs) => {
		TokeniserState.readEndTag(t, r, TokeniserState.RawtextEndTagName, TokeniserState.Rawtext);
	});

	// RawtextEndTagName
	static RawtextEndTagName = new TokeniserState((t, r, thisArgs) => {
		TokeniserState.handleDataEndTag(t, r, TokeniserState.Rawtext);
	});

	// ScriptDataLessthanSign
	static ScriptDataLessthanSign = new TokeniserState((t, r, thisArgs) => {
		switch (r.consume()) {
			case '/':
				t.createTempBuffer();
				t.transition(TokeniserState.ScriptDataEndTagOpen);
				break;
			case '!':
				t.emitString('<!');
				t.transition(TokeniserState.ScriptDataEscapeStart);
				break;
			case TokeniserState.eof:
				t.emitString('<');
				t.eofError(thisArgs);
				t.transition(TokeniserState.Data);
				break;
			default:
				t.emitString('<');
				r.unconsume();
				t.transition(TokeniserState.ScriptData);
		}
	});

	// ScriptDataEndTagOpen
	static ScriptDataEndTagOpen = new TokeniserState((t, r, thisArgs) => {
		TokeniserState.readEndTag(t, r, TokeniserState.ScriptDataEndTagName, TokeniserState.ScriptData);
	});

	// ScriptDataEndTagName
	static ScriptDataEndTagName = new TokeniserState((t, r, thisArgs) => {
		TokeniserState.handleDataEndTag(t, r, TokeniserState.ScriptData);
	});

	// ScriptDataEscapeStart
	static ScriptDataEscapeStart = new TokeniserState((t, r, thisArgs) => {
		if (r.matches('-')) {
			t.emitString('-');
			t.advanceTransition(TokeniserState.ScriptDataEscapeStartDash);
		} else {
			t.transition(TokeniserState.ScriptData);
		}
	});

	// ScriptDataEscapeStartDash
	static ScriptDataEscapeStartDash = new TokeniserState((t, r, thisArgs) => {
		if (r.matches('-')) {
			t.emitString('-');
			t.advanceTransition(TokeniserState.ScriptDataEscapedDashDash);
		} else {
			t.transition(TokeniserState.ScriptData);
		}
	});

	// ScriptDataEscaped
	static ScriptDataEscaped = new TokeniserState((t, r, thisArgs) => {
		if (r.isEmpty()) {
			t.eofError(thisArgs);
			t.transition(TokeniserState.Data);
			return;
		}

		switch (r.current()) {
			case '-':
				t.emitString('-');
				t.advanceTransition(TokeniserState.ScriptDataEscapedDash);
				break;
			case '<':
				t.advanceTransition(TokeniserState.ScriptDataEscapedLessthanSign);
				break;
			case TokeniserState.nullChar:
				t.error(thisArgs);
				r.advance();
				t.emitString(TokeniserState.replacementChar);
				break;
			default:
				let data = r.consumeToAny(['-', '<', TokeniserState.nullChar]);
				t.emitString(data);
		}
	});

	// ScriptDataEscapedDash
	static ScriptDataEscapedDash = new TokeniserState((t, r, thisArgs) => {
		if (r.isEmpty()) {
			t.eofError(thisArgs);
			t.transition(TokeniserState.Data);
			return;
		}

		let c = r.consume();
		switch (c) {
			case '-':
				t.emitString(c);
				t.transition(TokeniserState.ScriptDataEscapedDashDash);
				break;
			case '<':
				t.transition(TokeniserState.ScriptDataEscapedLessthanSign);
				break;
			case TokeniserState.nullChar:
				t.error(thisArgs);
				t.emitString(TokeniserState.replacementChar);
				t.transition(TokeniserState.ScriptDataEscaped);
				break;
			default:
				t.emitString(c);
				t.transition(TokeniserState.ScriptDataEscaped);
		}
	});

	// ScriptDataEscapedDashDash
	static ScriptDataEscapedDashDash = new TokeniserState((t, r, thisArgs) => {
		if (r.isEmpty()) {
			t.eofError(thisArgs);
			t.transition(TokeniserState.Data);
			return;
		}

		let c = r.consume();
		switch (c) {
			case '-':
				t.emitString(c);
				break;
			case '<':
				t.transition(TokeniserState.ScriptDataEscapedLessthanSign);
				break;
			case '>':
				t.emitString(c);
				t.transition(TokeniserState.ScriptData);
				break;
			case TokeniserState.nullChar:
				t.error(thisArgs);
				t.emitString(TokeniserState.replacementChar);
				t.transition(TokeniserState.ScriptDataEscaped);
				break;
			default:
				t.emitString(c);
				t.transition(TokeniserState.ScriptDataEscaped);
		}
	});

	// ScriptDataEscapedLessthanSign
	static ScriptDataEscapedLessthanSign = new TokeniserState((t, r, thisArgs) => {
		if (r.matchesLetter()) {
			t.createTempBuffer();
			t.dataBuffer.append(r.current());
			t.emitString('<');
			t.emitString(r.current());
			t.advanceTransition(TokeniserState.ScriptDataDoubleEscapeStart);
		} else if (r.matches('/')) {
			t.createTempBuffer();
			t.advanceTransition(TokeniserState.ScriptDataEscapedEndTagOpen);
		} else {
			t.emitString('<');
			t.transition(TokeniserState.ScriptDataEscaped);
		}
	});

	// ScriptDataEscapedEndTagOpen
	static ScriptDataEscapedEndTagOpen = new TokeniserState((t, r, thisArgs) => {
		if (r.matchesLetter()) {
			t.createTagPending(false);
			t.tagPending.appendTagName(r.current());
			t.dataBuffer.append(r.current());
			t.advanceTransition(TokeniserState.ScriptDataEscapedEndTagName);
		} else {
			t.emitString('</');
			t.transition(TokeniserState.ScriptDataEscaped);
		}
	});

	// ScriptDataEscapedEndTagName
	static ScriptDataEscapedEndTagName = new TokeniserState((t, r, thisArgs) => {
		TokeniserState.handleDataEndTag(t, r, TokeniserState.ScriptDataEscaped);
	});

	// ScriptDataDoubleEscapeStart
	static ScriptDataDoubleEscapeStart = new TokeniserState((t, r, thisArgs) => {
		TokeniserState.handleDataDoubleEscapeTag(t, r, TokeniserState.ScriptDataDoubleEscaped, TokeniserState.ScriptDataEscaped);
	});

	// ScriptDataDoubleEscaped
	static ScriptDataDoubleEscaped = new TokeniserState((t, r, thisArgs) => {
		let c = r.current();
		switch (c) {
			case '-':
				t.emitString(c);
				t.advanceTransition(TokeniserState.ScriptDataDoubleEscapedDash);
				break;
			case '<':
				t.emitString(c);
				t.advanceTransition(TokeniserState.ScriptDataDoubleEscapedLessthanSign);
				break;
			case TokeniserState.nullChar:
				t.error(thisArgs);
				r.advance();
				t.emitString(TokeniserState.replacementChar);
				break;
			case TokeniserState.eof:
				t.eofError(thisArgs);
				t.transition(TokeniserState.Data);
				break;
			default:
				let data = r.consumeToAny(['-', '<', TokeniserState.nullChar]);
				t.emitString(data);
		}
	});

	// ScriptDataDoubleEscapedDash
	static ScriptDataDoubleEscapedDash = new TokeniserState((t, r, thisArgs) => {
		let c = r.consume();
		switch (c) {
			case '-':
				t.emitString(c);
				t.transition(TokeniserState.ScriptDataDoubleEscapedDashDash);
				break;
			case '<':
				t.emitString(c);
				t.transition(TokeniserState.ScriptDataDoubleEscapedLessthanSign);
				break;
			case TokeniserState.nullChar:
				t.error(thisArgs);
				t.emitString(TokeniserState.replacementChar);
				t.transition(TokeniserState.ScriptDataDoubleEscaped);
				break;
			case TokeniserState.eof:
				t.eofError(thisArgs);
				t.transition(TokeniserState.Data);
				break;
			default:
				t.emitString(c);
				t.transition(TokeniserState.ScriptDataDoubleEscaped);
		}
	});

	// ScriptDataDoubleEscapedDashDash
	static ScriptDataDoubleEscapedDashDash = new TokeniserState((t, r, thisArgs) => {
		let c = r.consume();
		switch (c) {
			case '-':
				t.emitString(c);
				break;
			case '<':
				t.emitString(c);
				t.transition(TokeniserState.ScriptDataDoubleEscapedLessthanSign);
				break;
			case '>':
				t.emitString(c);
				t.transition(TokeniserState.ScriptData);
				break;
			case TokeniserState.nullChar:
				t.error(thisArgs);
				t.emitString(TokeniserState.replacementChar);
				t.transition(TokeniserState.ScriptDataDoubleEscaped);
				break;
			case TokeniserState.eof:
				t.eofError(thisArgs);
				t.transition(TokeniserState.Data);
				break;
			default:
				t.emitString(c);
				t.transition(TokeniserState.ScriptDataDoubleEscaped);
		}
	});

	// ScriptDataDoubleEscapedLessthanSign
	static ScriptDataDoubleEscapedLessthanSign = new TokeniserState((t, r, thisArgs) => {
		if (r.matches('/')) {
			t.emitString('/');
			t.createTempBuffer();
			t.advanceTransition(TokeniserState.ScriptDataDoubleEscapeEnd);
		} else {
			t.transition(TokeniserState.ScriptDataDoubleEscaped);
		}
	});

	// ScriptDataDoubleEscapeEnd
	static ScriptDataDoubleEscapeEnd = new TokeniserState((t, r, thisArgs) => {
		TokeniserState.handleDataDoubleEscapeTag(t, r, TokeniserState.ScriptDataEscaped, TokeniserState.ScriptDataDoubleEscaped);
	});

	// BeforeAttributeName
	static BeforeAttributeName = new TokeniserState((t, r, thisArgs) => {
		let c = r.consume();
		switch (c) {
			case '\t':
			case '\n':
			case '\r':
			case '\f':
			case ' ':
				break; // ignore whitespace
			case '/':
				t.transition(TokeniserState.SelfClosingStartTag);
				break;
			case '<': // NOTE: out of spec, but clear (spec has this as a part of the attribute name)
				r.unconsume();
				t.error(thisArgs);
			// intended fall through as if >
			case '>':
				t.emitTagPending();
				t.transition(TokeniserState.Data);
				break;
			case TokeniserState.nullChar:
				r.unconsume();
				t.error(thisArgs);
				t.tagPending.newAttribute();
				t.transition(TokeniserState.AttributeName);
				break;
			case TokeniserState.eof:
				t.eofError(thisArgs);
				t.transition(TokeniserState.Data);
				break;
			case '"':
			case "'":
			case '=':
				t.error(thisArgs);
				t.tagPending.newAttribute();
				t.tagPending.appendAttributeName(c);
				t.transition(TokeniserState.AttributeName);
				break;
			default:
				// A-Z, anything else
				t.tagPending.newAttribute();
				r.unconsume();
				t.transition(TokeniserState.AttributeName);
		}
	});

	// AttributeName
	static AttributeName = new TokeniserState((t, r, thisArgs) => {
		let name = r.consumeToAnySorted(TokeniserState.attributeNameCharsSorted); // spec deviate - consume and emit nulls in one hit vs stepping
		t.tagPending.appendAttributeName(name);

		let c = r.consume();
		switch (c) {
			case '\t':
			case '\n':
			case '\r':
			case '\f':
			case ' ':
				t.transition(TokeniserState.AfterAttributeName);
				break;
			case '/':
				t.transition(TokeniserState.SelfClosingStartTag);
				break;
			case '=':
				t.transition(TokeniserState.BeforeAttributeValue);
				break;
			case '>':
				t.emitTagPending();
				t.transition(TokeniserState.Data);
				break;
			case TokeniserState.eof:
				t.eofError(thisArgs);
				t.transition(TokeniserState.Data);
				break;
			case '"':
			case "'":
			case '<':
				t.error(thisArgs);
				t.tagPending.appendAttributeName(c);
				break;
			default:
				// buffer underrun
				t.tagPending.appendAttributeName(c);
		}
	});

	// AfterAttributeName
	static AfterAttributeName = new TokeniserState((t, r, thisArgs) => {
		let c = r.consume();
		switch (c) {
			case '\t':
			case '\n':
			case '\r':
			case '\f':
			case ' ':
				// ignore
				break;
			case '/':
				t.transition(TokeniserState.SelfClosingStartTag);
				break;
			case '=':
				t.transition(TokeniserState.BeforeAttributeValue);
				break;
			case '>':
				t.emitTagPending();
				t.transition(TokeniserState.Data);
				break;
			case TokeniserState.nullChar:
				t.error(thisArgs);
				t.tagPending.appendAttributeName(TokeniserState.replacementChar);
				t.transition(TokeniserState.AttributeName);
				break;
			case TokeniserState.eof:
				t.eofError(thisArgs);
				t.transition(TokeniserState.Data);
				break;
			case '"':
			case "'":
			case '<':
				t.error(thisArgs);
				t.tagPending.newAttribute();
				t.tagPending.appendAttributeName(c);
				t.transition(TokeniserState.AttributeName);
				break;
			default:
				// A-Z, anything else
				t.tagPending.newAttribute();
				r.unconsume();
				t.transition(TokeniserState.AttributeName);
		}
	});

	// BeforeAttributeValue
	static BeforeAttributeValue = new TokeniserState((t, r, thisArgs) => {
		let c = r.consume();
		switch (c) {
			case '\t':
			case '\n':
			case '\r':
			case '\f':
			case ' ':
				// ignore
				break;
			case '"':
				t.transition(TokeniserState.AttributeValue_doubleQuoted);
				break;
			case '&':
				r.unconsume();
				t.transition(TokeniserState.AttributeValue_unquoted);
				break;
			case "'":
				t.transition(TokeniserState.AttributeValue_singleQuoted);
				break;
			case TokeniserState.nullChar:
				t.error(thisArgs);
				t.tagPending.appendAttributeValue(TokeniserState.replacementChar);
				t.transition(TokeniserState.AttributeValue_unquoted);
				break;
			case TokeniserState.eof:
				t.eofError(thisArgs);
				t.emitTagPending();
				t.transition(TokeniserState.Data);
				break;
			case '>':
				t.error(thisArgs);
				t.emitTagPending();
				t.transition(TokeniserState.Data);
				break;
			case '<':
			case '=':
			case '`':
				t.error(thisArgs);
				t.tagPending.appendAttributeValue(c);
				t.transition(TokeniserState.AttributeValue_unquoted);
				break;
			default:
				r.unconsume();
				t.transition(TokeniserState.AttributeValue_unquoted);
		}
	});

	// AttributeValue_doubleQuoted
	static AttributeValue_doubleQuoted = new TokeniserState((t, r, thisArgs) => {
		let value = r.consumeAttributeQuoted(false);
		if (value.length > 0) t.tagPending.appendAttributeValue(value);
		else t.tagPending.setEmptyAttributeValue();

		let c = r.consume();
		switch (c) {
			case '"':
				t.transition(TokeniserState.AfterAttributeValue_quoted);
				break;
			case '&':
				let ref = t.consumeCharacterReference('"', true);
				if (ref != null) t.tagPending.appendAttributeValue(ref);
				else t.tagPending.appendAttributeValue('&');
				break;
			case TokeniserState.nullChar:
				t.error(thisArgs);
				t.tagPending.appendAttributeValue(TokeniserState.replacementChar);
				break;
			case TokeniserState.eof:
				t.eofError(thisArgs);
				t.transition(TokeniserState.Data);
				break;
			default:
				// hit end of buffer in first read, still in attribute
				t.tagPending.appendAttributeValue(c);
		}
	});

	// AttributeValue_singleQuoted
	static AttributeValue_singleQuoted = new TokeniserState((t, r, thisArgs) => {
		let value = r.consumeAttributeQuoted(true);
		if (value.length > 0) t.tagPending.appendAttributeValue(value);
		else t.tagPending.setEmptyAttributeValue();

		let c = r.consume();
		switch (c) {
			case "'":
				t.transition(TokeniserState.AfterAttributeValue_quoted);
				break;
			case '&':
				let ref = t.consumeCharacterReference("'", true);
				if (ref != null) t.tagPending.appendAttributeValue(ref);
				else t.tagPending.appendAttributeValue('&');
				break;
			case TokeniserState.nullChar:
				t.error(thisArgs);
				t.tagPending.appendAttributeValue(TokeniserState.replacementChar);
				break;
			case TokeniserState.eof:
				t.eofError(thisArgs);
				t.transition(TokeniserState.Data);
				break;
			default:
				// hit end of buffer in first read, still in attribute
				t.tagPending.appendAttributeValue(c);
		}
	});

	// AttributeValue_unquoted
	static AttributeValue_unquoted = new TokeniserState((t, r, thisArgs) => {
		let value = r.consumeToAnySorted(TokeniserState.attributeValueUnquoted);
		if (value.length > 0) t.tagPending.appendAttributeValue(value);

		let c = r.consume();
		switch (c) {
			case '\t':
			case '\n':
			case '\r':
			case '\f':
			case ' ':
				t.transition(TokeniserState.BeforeAttributeName);
				break;
			case '&':
				let ref = t.consumeCharacterReference('>', true);
				if (ref != null) t.tagPending.appendAttributeValue(ref);
				else t.tagPending.appendAttributeValue('&');
				break;
			case '>':
				t.emitTagPending();
				t.transition(TokeniserState.Data);
				break;
			case TokeniserState.nullChar:
				t.error(thisArgs);
				t.tagPending.appendAttributeValue(TokeniserState.replacementChar);
				break;
			case TokeniserState.eof:
				t.eofError(thisArgs);
				t.transition(TokeniserState.Data);
				break;
			case '"':
			case "'":
			case '<':
			case '=':
			case '`':
				t.error(thisArgs);
				t.tagPending.appendAttributeValue(c);
				break;
			default:
				// hit end of buffer in first read, still in attribute
				t.tagPending.appendAttributeValue(c);
		}
	});

	// AfterAttributeValue_quoted
	static AfterAttributeValue_quoted = new TokeniserState((t, r, thisArgs) => {
		let c = r.consume();
		switch (c) {
			case '\t':
			case '\n':
			case '\r':
			case '\f':
			case ' ':
				t.transition(TokeniserState.BeforeAttributeName);
				break;
			case '/':
				t.transition(TokeniserState.SelfClosingStartTag);
				break;
			case '>':
				t.emitTagPending();
				t.transition(TokeniserState.Data);
				break;
			case TokeniserState.eof:
				t.eofError(thisArgs);
				t.transition(TokeniserState.Data);
				break;
			default:
				r.unconsume();
				t.error(thisArgs);
				t.transition(TokeniserState.BeforeAttributeName);
		}
	});

	// SelfClosingStartTag
	static SelfClosingStartTag = new TokeniserState((t, r, thisArgs) => {
		let c = r.consume();
		switch (c) {
			case '>':
				t.tagPending.selfClosing = true;
				t.emitTagPending();
				t.transition(TokeniserState.Data);
				break;
			case TokeniserState.eof:
				t.eofError(thisArgs);
				t.transition(TokeniserState.Data);
				break;
			default:
				r.unconsume();
				t.error(thisArgs);
				t.transition(TokeniserState.BeforeAttributeName);
		}
	});

	// BogusComment
	static BogusComment = new TokeniserState((t, r, thisArgs) => {
		// todo: handle bogus comment starting from eof. when does that trigger?
		// rewind to capture character that lead us here
		r.unconsume();
		t.commentPending.append(r.consumeTo('>'));
		// todo: replace nullChar with replaceChar
		let next = r.consume();
		if (next == '>' || next == TokeniserState.eof) {
			t.emitCommentPending();
			t.transition(TokeniserState.Data);
		}
	});

	// MarkupDeclarationOpen
	static MarkupDeclarationOpen = new TokeniserState((t, r, thisArgs) => {
		if (r.matchConsume('--')) {
			t.createCommentPending();
			t.transition(TokeniserState.CommentStart);
		} else if (r.matchConsumeIgnoreCase('DOCTYPE')) {
			t.transition(TokeniserState.Doctype);
		} else if (r.matchConsume('[CDATA[')) {
			// todo: should actually check current namepspace, and only non-html allows cdata. until namespace
			// is implemented properly, keep handling as cdata
			//} else if (!t.currentNodeInHtmlNS() && r.matchConsume("[CDATA[")) {
			t.createTempBuffer();
			t.transition(TokeniserState.CdataSection);
		} else {
			t.error(thisArgs);
			t.createBogusCommentPending();
			t.advanceTransition(TokeniserState.BogusComment); // advance so this character gets in bogus comment data's rewind
		}
	});

	// CommentStart
	static CommentStart = new TokeniserState((t, r, thisArgs) => {
		let c = r.consume();
		switch (c) {
			case '-':
				t.transition(TokeniserState.CommentStartDash);
				break;
			case TokeniserState.nullChar:
				t.error(thisArgs);
				t.commentPending.append(TokeniserState.replacementChar);
				t.transition(TokeniserState.Comment);
				break;
			case '>':
				t.error(thisArgs);
				t.emitCommentPending();
				t.transition(TokeniserState.Data);
				break;
			case TokeniserState.eof:
				t.eofError(thisArgs);
				t.emitCommentPending();
				t.transition(TokeniserState.Data);
				break;
			default:
				r.unconsume();
				t.transition(TokeniserState.Comment);
		}
	});

	// CommentStartDash
	static CommentStartDash = new TokeniserState((t, r, thisArgs) => {
		let c = r.consume();
		switch (c) {
			case '-':
				t.transition(TokeniserState.CommentStartDash);
				break;
			case TokeniserState.nullChar:
				t.error(thisArgs);
				t.commentPending.append(TokeniserState.replacementChar);
				t.transition(TokeniserState.Comment);
				break;
			case '>':
				t.error(thisArgs);
				t.emitCommentPending();
				t.transition(TokeniserState.Data);
				break;
			case TokeniserState.eof:
				t.eofError(thisArgs);
				t.emitCommentPending();
				t.transition(TokeniserState.Data);
				break;
			default:
				t.commentPending.append(c);
				t.transition(TokeniserState.Comment);
		}
	});

	// Comment
	static Comment = new TokeniserState((t, r, thisArgs) => {
		let c = r.current();
		switch (c) {
			case '-':
				t.advanceTransition(TokeniserState.CommentEndDash);
				break;
			case TokeniserState.nullChar:
				t.error(thisArgs);
				r.advance();
				t.commentPending.append(TokeniserState.replacementChar);
				break;
			case TokeniserState.eof:
				t.eofError(thisArgs);
				t.emitCommentPending();
				t.transition(TokeniserState.Data);
				break;
			default:
				t.commentPending.append(r.consumeToAny(['-', TokeniserState.nullChar]));
		}
	});

	// CommentEndDash
	static CommentEndDash = new TokeniserState((t, r, thisArgs) => {
		let c = r.consume();
		switch (c) {
			case '-':
				t.transition(TokeniserState.CommentEnd);
				break;
			case TokeniserState.nullChar:
				t.error(thisArgs);
				t.commentPending.append('-').append(TokeniserState.replacementChar);
				t.transition(TokeniserState.Comment);
				break;
			case TokeniserState.eof:
				t.eofError(thisArgs);
				t.emitCommentPending();
				t.transition(TokeniserState.Data);
				break;
			default:
				t.commentPending.append('-').append(c);
				t.transition(TokeniserState.Comment);
		}
	});

	// CommentEnd
	static CommentEnd = new TokeniserState((t, r, thisArgs) => {
		let c = r.consume();
		switch (c) {
			case '>':
				t.emitCommentPending();
				t.transition(TokeniserState.Data);
				break;
			case TokeniserState.nullChar:
				t.error(thisArgs);
				t.commentPending.append('--').append(TokeniserState.replacementChar);
				t.transition(TokeniserState.Comment);
				break;
			case '!':
				t.error(thisArgs);
				t.transition(TokeniserState.CommentEndBang);
				break;
			case '-':
				t.error(thisArgs);
				t.commentPending.append('-');
				break;
			case TokeniserState.eof:
				t.eofError(thisArgs);
				t.emitCommentPending();
				t.transition(TokeniserState.Data);
				break;
			default:
				t.error(thisArgs);
				t.commentPending.append('--').append(c);
				t.transition(TokeniserState.Comment);
		}
	});

	// CommentEndBang
	static CommentEndBang = new TokeniserState((t, r, thisArgs) => {
		let c = r.consume();
		switch (c) {
			case '-':
				t.commentPending.append('--!');
				t.transition(TokeniserState.CommentEndDash);
				break;
			case '>':
				t.emitCommentPending();
				t.transition(TokeniserState.Data);
				break;
			case TokeniserState.nullChar:
				t.error(thisArgs);
				t.commentPending.append('--!').append(TokeniserState.replacementChar);
				t.transition(TokeniserState.Comment);
				break;
			case TokeniserState.eof:
				t.eofError(thisArgs);
				t.emitCommentPending();
				t.transition(TokeniserState.Data);
				break;
			default:
				t.commentPending.append('--!').append(c);
				t.transition(TokeniserState.Comment);
		}
	});

	// Doctype
	static Doctype = new TokeniserState((t, r, thisArgs) => {
		let c = r.consume();
		switch (c) {
			case '\t':
			case '\n':
			case '\r':
			case '\f':
			case ' ':
				t.transition(TokeniserState.BeforeDoctypeName);
				break;
			case TokeniserState.eof:
				t.eofError(thisArgs);
			// note: fall through to > case
			case '>': // catch invalid <!DOCTYPE>
				t.error(thisArgs);
				t.createDoctypePending();
				t.doctypePending.forceQuirks = true;
				t.emitDoctypePending();
				t.transition(TokeniserState.Data);
				break;
			default:
				t.error(thisArgs);
				t.transition(TokeniserState.BeforeDoctypeName);
		}
	});

	// BeforeDoctypeName
	static BeforeDoctypeName = new TokeniserState((t, r, thisArgs) => {
		if (r.matchesLetter()) {
			t.createDoctypePending();
			t.transition(TokeniserState.DoctypeName);
			return;
		}
		let c = r.consume();
		switch (c) {
			case '\t':
			case '\n':
			case '\r':
			case '\f':
			case ' ':
				break; // ignore whitespace
			case TokeniserState.nullChar:
				t.error(thisArgs);
				t.createDoctypePending();
				t.doctypePending.name.append(TokeniserState.replacementChar);
				t.transition(TokeniserState.DoctypeName);
				break;
			case TokeniserState.eof:
				t.eofError(thisArgs);
				t.createDoctypePending();
				t.doctypePending.forceQuirks = true;
				t.emitDoctypePending();
				t.transition(TokeniserState.Data);
				break;
			default:
				t.createDoctypePending();
				t.doctypePending.name.append(c);
				t.transition(TokeniserState.DoctypeName);
		}
	});

	// DoctypeName
	static DoctypeName = new TokeniserState((t, r, thisArgs) => {
		if (r.matchesLetter()) {
			let name = r.consumeLetterSequence();
			t.doctypePending.name.append(name);
			return;
		}
		let c = r.consume();
		switch (c) {
			case '>':
				t.emitDoctypePending();
				t.transition(TokeniserState.Data);
				break;
			case '\t':
			case '\n':
			case '\r':
			case '\f':
			case ' ':
				t.transition(TokeniserState.AfterDoctypeName);
				break;
			case TokeniserState.nullChar:
				t.error(thisArgs);
				t.doctypePending.name.append(TokeniserState.replacementChar);
				break;
			case TokeniserState.eof:
				t.eofError(thisArgs);
				t.doctypePending.forceQuirks = true;
				t.emitDoctypePending();
				t.transition(TokeniserState.Data);
				break;
			default:
				t.doctypePending.name.append(c);
		}
	});

	// AfterDoctypeName
	static AfterDoctypeName = new TokeniserState((t, r, thisArgs) => {
		if (r.isEmpty()) {
			t.eofError(thisArgs);
			t.doctypePending.forceQuirks = true;
			t.emitDoctypePending();
			t.transition(TokeniserState.Data);
			return;
		}
		if (r.matchesAny('\t', '\n', '\r', '\f', ' ')) r.advance();
		// ignore whitespace
		else if (r.matches('>')) {
			t.emitDoctypePending();
			t.advanceTransition(TokeniserState.Data);
		} else if (r.matchConsumeIgnoreCase(DocumentType.PUBLIC_KEY)) {
			t.doctypePending.pubSysKey = DocumentType.PUBLIC_KEY;
			t.transition(TokeniserState.AfterDoctypePublicKeyword);
		} else if (r.matchConsumeIgnoreCase(DocumentType.SYSTEM_KEY)) {
			t.doctypePending.pubSysKey = DocumentType.SYSTEM_KEY;
			t.transition(TokeniserState.AfterDoctypeSystemKeyword);
		} else {
			t.error(thisArgs);
			t.doctypePending.forceQuirks = true;
			t.advanceTransition(TokeniserState.BogusDoctype);
		}
	});

	// AfterDoctypePublicKeyword
	static AfterDoctypePublicKeyword = new TokeniserState((t, r, thisArgs) => {
		let c = r.consume();
		switch (c) {
			case '\t':
			case '\n':
			case '\r':
			case '\f':
			case ' ':
				t.transition(TokeniserState.BeforeDoctypePublicIdentifier);
				break;
			case '"':
				t.error(thisArgs);
				// set public id to empty string
				t.transition(TokeniserState.DoctypePublicIdentifier_doubleQuoted);
				break;
			case "'":
				t.error(thisArgs);
				// set public id to empty string
				t.transition(TokeniserState.DoctypePublicIdentifier_singleQuoted);
				break;
			case '>':
				t.error(thisArgs);
				t.doctypePending.forceQuirks = true;
				t.emitDoctypePending();
				t.transition(TokeniserState.Data);
				break;
			case TokeniserState.eof:
				t.eofError(thisArgs);
				t.doctypePending.forceQuirks = true;
				t.emitDoctypePending();
				t.transition(TokeniserState.Data);
				break;
			default:
				t.error(thisArgs);
				t.doctypePending.forceQuirks = true;
				t.transition(TokeniserState.BogusDoctype);
		}
	});

	// BeforeDoctypePublicIdentifier
	static BeforeDoctypePublicIdentifier = new TokeniserState((t, r, thisArgs) => {
		let c = r.consume();
		switch (c) {
			case '\t':
			case '\n':
			case '\r':
			case '\f':
			case ' ':
				break;
			case '"':
				// set public id to empty string
				t.transition(TokeniserState.DoctypePublicIdentifier_doubleQuoted);
				break;
			case "'":
				// set public id to empty string
				t.transition(TokeniserState.DoctypePublicIdentifier_singleQuoted);
				break;
			case '>':
				t.error(thisArgs);
				t.doctypePending.forceQuirks = true;
				t.emitDoctypePending();
				t.transition(TokeniserState.Data);
				break;
			case TokeniserState.eof:
				t.eofError(thisArgs);
				t.doctypePending.forceQuirks = true;
				t.emitDoctypePending();
				t.transition(TokeniserState.Data);
				break;
			default:
				t.error(thisArgs);
				t.doctypePending.forceQuirks = true;
				t.transition(TokeniserState.BogusDoctype);
		}
	});

	// DoctypePublicIdentifier_doubleQuoted
	static DoctypePublicIdentifier_doubleQuoted = new TokeniserState((t, r, thisArgs) => {
		let c = r.consume();
		switch (c) {
			case '"':
				t.transition(TokeniserState.AfterDoctypePublicIdentifier);
				break;
			case TokeniserState.nullChar:
				t.error(thisArgs);
				t.doctypePending.publicIdentifier.append(TokeniserState.replacementChar);
				break;
			case '>':
				t.error(thisArgs);
				t.doctypePending.forceQuirks = true;
				t.emitDoctypePending();
				t.transition(TokeniserState.Data);
				break;
			case TokeniserState.eof:
				t.eofError(thisArgs);
				t.doctypePending.forceQuirks = true;
				t.emitDoctypePending();
				t.transition(TokeniserState.Data);
				break;
			default:
				t.doctypePending.publicIdentifier.append(c);
		}
	});

	// DoctypePublicIdentifier_singleQuoted
	static DoctypePublicIdentifier_singleQuoted = new TokeniserState((t, r, thisArgs) => {
		let c = r.consume();
		switch (c) {
			case "'":
				t.transition(TokeniserState.AfterDoctypePublicIdentifier);
				break;
			case TokeniserState.nullChar:
				t.error(thisArgs);
				t.doctypePending.publicIdentifier.append(TokeniserState.replacementChar);
				break;
			case '>':
				t.error(thisArgs);
				t.doctypePending.forceQuirks = true;
				t.emitDoctypePending();
				t.transition(TokeniserState.Data);
				break;
			case TokeniserState.eof:
				t.eofError(thisArgs);
				t.doctypePending.forceQuirks = true;
				t.emitDoctypePending();
				t.transition(TokeniserState.Data);
				break;
			default:
				t.doctypePending.publicIdentifier.append(c);
		}
	});

	// AfterDoctypePublicIdentifier
	static AfterDoctypePublicIdentifier = new TokeniserState((t, r, thisArgs) => {
		let c = r.consume();
		switch (c) {
			case '\t':
			case '\n':
			case '\r':
			case '\f':
			case ' ':
				t.transition(TokeniserState.BetweenDoctypePublicAndSystemIdentifiers);
				break;
			case '>':
				t.emitDoctypePending();
				t.transition(TokeniserState.Data);
				break;
			case '"':
				t.error(thisArgs);
				// system id empty
				t.transition(TokeniserState.DoctypeSystemIdentifier_doubleQuoted);
				break;
			case "'":
				t.error(thisArgs);
				// system id empty
				t.transition(TokeniserState.DoctypeSystemIdentifier_singleQuoted);
				break;
			case TokeniserState.eof:
				t.eofError(thisArgs);
				t.doctypePending.forceQuirks = true;
				t.emitDoctypePending();
				t.transition(TokeniserState.Data);
				break;
			default:
				t.error(thisArgs);
				t.doctypePending.forceQuirks = true;
				t.transition(TokeniserState.BogusDoctype);
		}
	});

	// BetweenDoctypePublicAndSystemIdentifiers
	static BetweenDoctypePublicAndSystemIdentifiers = new TokeniserState((t, r, thisArgs) => {
		let c = r.consume();
		switch (c) {
			case '\t':
			case '\n':
			case '\r':
			case '\f':
			case ' ':
				break;
			case '>':
				t.emitDoctypePending();
				t.transition(TokeniserState.Data);
				break;
			case '"':
				t.error(thisArgs);
				// system id empty
				t.transition(TokeniserState.DoctypeSystemIdentifier_doubleQuoted);
				break;
			case "'":
				t.error(thisArgs);
				// system id empty
				t.transition(TokeniserState.DoctypeSystemIdentifier_singleQuoted);
				break;
			case TokeniserState.eof:
				t.eofError(thisArgs);
				t.doctypePending.forceQuirks = true;
				t.emitDoctypePending();
				t.transition(TokeniserState.Data);
				break;
			default:
				t.error(thisArgs);
				t.doctypePending.forceQuirks = true;
				t.transition(TokeniserState.BogusDoctype);
		}
	});

	// AfterDoctypeSystemKeyword
	static AfterDoctypeSystemKeyword = new TokeniserState((t, r, thisArgs) => {
		let c = r.consume();
		switch (c) {
			case '\t':
			case '\n':
			case '\r':
			case '\f':
			case ' ':
				t.transition(TokeniserState.BeforeDoctypeSystemIdentifier);
				break;
			case '>':
				t.error(thisArgs);
				t.doctypePending.forceQuirks = true;
				t.emitDoctypePending();
				t.transition(TokeniserState.Data);
				break;
			case '"':
				t.error(thisArgs);
				// system id empty
				t.transition(TokeniserState.DoctypeSystemIdentifier_doubleQuoted);
				break;
			case "'":
				t.error(thisArgs);
				// system id empty
				t.transition(TokeniserState.DoctypeSystemIdentifier_singleQuoted);
				break;
			case TokeniserState.eof:
				t.eofError(thisArgs);
				t.doctypePending.forceQuirks = true;
				t.emitDoctypePending();
				t.transition(TokeniserState.Data);
				break;
			default:
				t.error(thisArgs);
				t.doctypePending.forceQuirks = true;
				t.emitDoctypePending();
		}
	});

	// BeforeDoctypeSystemIdentifier
	static BeforeDoctypeSystemIdentifier = new TokeniserState((t, r, thisArgs) => {
		let c = r.consume();
		switch (c) {
			case '\t':
			case '\n':
			case '\r':
			case '\f':
			case ' ':
				break;
			case '"':
				// set system id to empty string
				t.transition(TokeniserState.DoctypeSystemIdentifier_doubleQuoted);
				break;
			case "'":
				// set public id to empty string
				t.transition(TokeniserState.DoctypeSystemIdentifier_singleQuoted);
				break;
			case '>':
				t.error(thisArgs);
				t.doctypePending.forceQuirks = true;
				t.emitDoctypePending();
				t.transition(TokeniserState.Data);
				break;
			case TokeniserState.eof:
				t.eofError(thisArgs);
				t.doctypePending.forceQuirks = true;
				t.emitDoctypePending();
				t.transition(TokeniserState.Data);
				break;
			default:
				t.error(thisArgs);
				t.doctypePending.forceQuirks = true;
				t.transition(TokeniserState.BogusDoctype);
		}
	});

	// DoctypeSystemIdentifier_doubleQuoted
	static DoctypeSystemIdentifier_doubleQuoted = new TokeniserState((t, r, thisArgs) => {
		let c = r.consume();
		switch (c) {
			case '"':
				t.transition(TokeniserState.AfterDoctypeSystemIdentifier);
				break;
			case TokeniserState.nullChar:
				t.error(thisArgs);
				t.doctypePending.systemIdentifier.append(TokeniserState.replacementChar);
				break;
			case '>':
				t.error(thisArgs);
				t.doctypePending.forceQuirks = true;
				t.emitDoctypePending();
				t.transition(TokeniserState.Data);
				break;
			case TokeniserState.eof:
				t.eofError(thisArgs);
				t.doctypePending.forceQuirks = true;
				t.emitDoctypePending();
				t.transition(TokeniserState.Data);
				break;
			default:
				t.doctypePending.systemIdentifier.append(c);
		}
	});

	// DoctypeSystemIdentifier_singleQuoted
	static DoctypeSystemIdentifier_singleQuoted = new TokeniserState((t, r, thisArgs) => {
		let c = r.consume();
		switch (c) {
			case "'":
				t.transition(TokeniserState.AfterDoctypeSystemIdentifier);
				break;
			case TokeniserState.nullChar:
				t.error(thisArgs);
				t.doctypePending.systemIdentifier.append(TokeniserState.replacementChar);
				break;
			case '>':
				t.error(thisArgs);
				t.doctypePending.forceQuirks = true;
				t.emitDoctypePending();
				t.transition(TokeniserState.Data);
				break;
			case TokeniserState.eof:
				t.eofError(thisArgs);
				t.doctypePending.forceQuirks = true;
				t.emitDoctypePending();
				t.transition(TokeniserState.Data);
				break;
			default:
				t.doctypePending.systemIdentifier.append(c);
		}
	});

	// AfterDoctypeSystemIdentifier
	static AfterDoctypeSystemIdentifier = new TokeniserState((t, r, thisArgs) => {
		let c = r.consume();
		switch (c) {
			case '\t':
			case '\n':
			case '\r':
			case '\f':
			case ' ':
				break;
			case '>':
				t.emitDoctypePending();
				t.transition(TokeniserState.Data);
				break;
			case TokeniserState.eof:
				t.eofError(thisArgs);
				t.doctypePending.forceQuirks = true;
				t.emitDoctypePending();
				t.transition(TokeniserState.Data);
				break;
			default:
				t.error(thisArgs);
				t.transition(TokeniserState.BogusDoctype);
			// NOT force quirks
		}
	});

	// BogusDoctype
	static BogusDoctype = new TokeniserState((t, r, thisArgs) => {
		let c = r.consume();
		switch (c) {
			case '>':
				t.emitDoctypePending();
				t.transition(TokeniserState.Data);
				break;
			case TokeniserState.eof:
				t.emitDoctypePending();
				t.transition(TokeniserState.Data);
				break;
			default:
				// ignore char
				break;
		}
	});

	// CdataSection
	static CdataSection = new TokeniserState((t, r, thisArgs) => {
		let data = r.consumeTo(']]>');
		t.dataBuffer.append(TokeniserState.Data);
		if (r.matchConsume(']]>') || r.isEmpty()) {
			t.emitToken(new CData(t.dataBuffer.toString()));
			t.transition(TokeniserState.Data);
		} // otherwise, buffer underrun, stay in data section
	});
}
