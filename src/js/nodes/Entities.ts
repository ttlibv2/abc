import { Assert } from '../helper/Assert';
import { Char } from '../helper/Char';
import { Helper } from '../helper/Helper';
import { StringBuilder } from '../helper/StringBuilder';
import { CharacterReader } from '../parse/CharacterReader';
import { Parser } from '../parse/Parser';
import { CharsetEncoder, OutputSetting } from '../parse/Setting';
import * as enty_json from './entities.json';

export class EntitiesData {
	static readonly xmlPoints: string = enty_json.xmlPoint;
	static readonly basePoints: string = enty_json.basePoint;
	static readonly fullPoints: string = enty_json.fullPoint;
}

export enum CoreCharset {
	ascii,

	// covers UTF-8, UTF-16, et al
	utf,
	fallback,
}

export class EscapeMode {
	static readonly multipoints: Map<string, string> = new Map();

	/**
	 * Restricted entities suitable for XHTML output: lt, gt, amp, and quot only.
	 * @return {EscapeMode}
	 */
	static xhtml = new EscapeMode(EntitiesData.xmlPoints, 4);

	/**
	 * Default HTML output entities.
	 * @return {EscapeMode}
	 */
	static base = new EscapeMode(EntitiesData.basePoints, 106);

	/**
	 * Complete HTML entities.
	 * @return {EscapeMode}
	 */
	static extended = new EscapeMode(EntitiesData.fullPoints, 2125);

	// table of named references to their codepoints.
	// sorted so we can binary search. built by BuildEntities.
	private nameKeys: string[];
	private codeVals: number[];

	// table of codepoints to named entities.
	private codeKeys: number[]; // we don't support multicodepoints to single named value currently
	private nameVals: string[];

	//
	static readonly codeDelims: Char[] = [Char.valueOf(','), Char.valueOf(';')];
	static readonly codepointRadix = 36;

	/* eslint-disable */
	private constructor(file: string, size: number) {
		EscapeMode.load(this, file, size);
	}

	/**
	 * Return codepoint without name
	 * @param name {string}
	 */
	codepointForName(name: string) {
		let index = this.nameKeys.indexOf(name);
		return this.codeVals[index] || Entities.empty;
	}

	/**
	 * Return name of codepoint
	 * @param codepoint {number}
	 */
	nameForCodepoint(codepoint: number): string {
		let index = this.codeKeys.indexOf(codepoint);
		if (index === -1) return Entities.emptyName;
		else {
			// the results are ordered so lower case versions of same codepoint come after uppercase,
			// and we prefer to emit lower
			// (and binary search for same item with multi results is undefined
			let isTrue = index < this.nameVals.length - 1 && this.codeKeys[index + 1];
			return isTrue ? this.nameVals[index + 1] : this.nameVals[index];
		}
	}

	size(): number {
		return this.nameKeys.length;
	}

	static load(escapeMode: EscapeMode, pointsData: string, size: number): void {
		escapeMode.nameKeys = new Array(size);
		escapeMode.nameVals = new Array(size);
		escapeMode.codeKeys = new Array(size);
		escapeMode.codeVals = new Array(size);

		let reader = new CharacterReader(pointsData);
		let radix: number = EscapeMode.codepointRadix;
		let pos = 0;

		while (!reader.isEmpty()) {
			let name = reader.consumeTo('=');
			reader.advance();

			//
			let cp1 = parseInt(reader.consumeToAny(EscapeMode.codeDelims), radix);
			let codeDelim = reader.current();

			//
			reader.advance();
			let cp2 = -1;
			if (codeDelim.equals(';')) {
				cp2 = parseInt(reader.consumeTo(';'), radix);
				reader.advance();
			}

			//
			let index = parseInt(reader.consumeTo('&'), radix);
			escapeMode.nameKeys[pos] = name;
			escapeMode.codeVals[pos] = cp1;
			escapeMode.codeKeys[index] = cp1;
			escapeMode.nameVals[index] = name;

			//
			if (cp2 !== -1) {
				let string = [cp1, cp2].map((cp) => String.fromCodePoint(cp)).join('');
				EscapeMode.multipoints.set(name, string);
			}
			pos++;
		}

		Assert.isTrue(pos === size, 'Unexpected count of entities loaded');
	}
}

export class Entities {
	static readonly empty: number = -1;
	static readonly emptyName: string = '';
	static readonly defaultOutput = new OutputSetting();

	static getCoreCharsetByName(name: string): CoreCharset {
		if (name === 'US-ASCII') return CoreCharset.ascii;
		if (name.startsWith('UTF-')) return CoreCharset.utf;
		else return CoreCharset.fallback;
	}

	/**
	 * Check if the input is a known named entity
	 * @param name the possible entity name (e.g. "lt" or "amp")
	 * @return true if a known named entity
	 */
	static isNamedEntity(name: string): boolean {
		return EscapeMode.extended.codepointForName(name) !== Entities.empty;
	}

	/**
	 * Check if the input is a known named entity in the base entity set.
	 * @param name the possible entity name (e.g. "lt" or "amp")
	 * @return true if a known named entity in the base set
	 */
	static isBaseNamedEntity(name: string): boolean {
		return EscapeMode.base.codepointForName(name) !== Entities.empty;
	}

	/**
	 * Get the character(s) represented by the named entity
	 * @param name entity (e.g. "lt" or "amp")
	 * @return the string value of the character(s) represented by this entity, or "" if not defined
	 */
	static getByName(name: string): string {
		let val = EscapeMode.multipoints.get(name);
		if (Helper.notNull(val)) return val;
		else {
			let codepoint = EscapeMode.extended.codepointForName(name);
			return codepoint !== Entities.empty ? String(codepoint) : Entities.emptyName;
		}
	}

	static codepointsForName(name: string, codepoints: number[]): number {
		let val = EscapeMode.multipoints.get(name);
		if (Helper.notNull(val)) {
			codepoints[0] = val.codePointAt(0);
			codepoints[1] = val.codePointAt(1);
			return 2;
		} else {
			let codepoint = EscapeMode.extended.codepointForName(name);
			if (codepoint !== Entities.empty) {
				codepoint[0] = codepoint;
				return 1;
			} else return 0;
		}
	}

	/**
	 * HTML escape an input string. Exam: `<` => `&lt`
	 * @param {string} string the un-escaped string to escape
	 * @param {OutputSetting} setting the output settings to use
	 * @return the escaped string
	 */
	static escape(string: string, setting: OutputSetting = Entities.defaultOutput): string {
		if (Helper.isNull(string)) return '';
		else {
			let accum = new StringBuilder();
			Entities.escapeImpl(accum, string, setting, false, false, false);
			return accum.toString();
		}
	}

	// this method is ugly, and does a lot.
	// but other breakups cause rescanning and stringbuilder generations
	static escapeImpl(
		accum: StringBuilder,
		string: string,
		setting: OutputSetting,
		inAttribute: boolean,
		normaliseWhite: boolean,
		stripLeadingWhite: boolean,
	) {
		let lastWasWhite = false;
		let reachedNonWhite = false;
		let escapeMode = setting.escapeMode;
		let encoder = setting.encoder;
		let coreCharset = setting.coreCharset; // init in out.prepareEncoder()
		let length = string.length;
		let codePoint: number;

		// loop
		for (let offset = 0; offset < length; offset += Helper.charCount(codePoint)) {
			codePoint = string.codePointAt(offset);

			// normaliseWhite
			if (normaliseWhite) {
				if (Helper.isWhitespace(codePoint)) {
					if ((stripLeadingWhite && !reachedNonWhite) || lastWasWhite) continue;
					accum.append(' ');
					lastWasWhite = true;
					continue;
				} else {
					lastWasWhite = false;
					reachedNonWhite = true;
				}
			}

			// surrogate pairs, split implementation for efficiency on single char
			// common case (saves creating strings, char[]):
			if (codePoint < Helper.MIN_SUPPLEMENTARY_CODE_POINT) {
				let char = String.fromCodePoint(codePoint);

				// html specific and required escapes:
				switch (char) {
					case '&':
						accum.append('&amp;');
						break;
					case String.fromCodePoint(0xa0):
						if (escapeMode !== EscapeMode.xhtml) accum.append('&nbsp;');
						else accum.append('&#xa0;');
						break;
					case '<':
						// escape when in character data or when in a xml attribute val or XML syntax;
						// not needed in html attr val
						let isLt = !inAttribute || escapeMode === EscapeMode.xhtml || setting.syntax === 'xml';
						accum.append(isLt ? '&lt;' : char);
						break;
					case '>':
						accum.append(!inAttribute ? '&gt;' : char);
						break;
					case '"':
						accum.append(inAttribute ? '&quot;' : char);
						break;
					default:
						let canEncode = Entities.canEncode(coreCharset, char, encoder);
						if (canEncode) accum.append(char);
						else Entities.appendEncoded(accum, escapeMode, codePoint);
				}
			}

			// > 0x10000
			else {
				let c = String.fromCodePoint(codePoint);
				if (encoder.canEncode(c)) accum.append(c);
				else Entities.appendEncoded(accum, escapeMode, codePoint);
			}
		}
	}

	private static appendEncoded(accum: StringBuilder, escapeMode: EscapeMode, codePoint: number) {
		let name = escapeMode.nameForCodepoint(codePoint);
		if (Entities.emptyName !== name) accum.append('&').append(name).append(';');
		else accum.append('&#x').append(codePoint.toString(16)).append(';');
	}

	/**
	 * Un-escape an HTML escaped string. That is, {@code &lt;} is returned as {@code <}.
	 *
	 * @param string the HTML string to un-escape
	 * @param strict if "strict" (that is, requires trailing ';' char, otherwise that's optional)
	 * @return the unescaped string
	 */
	static unescape(string: string, strict: boolean = false) {
		return Parser.unescapeEntities(string, strict);
	}

	/**
	 * Provides a fast-path for Encoder.canEncode
	 * @param charset {CoreCharset}
	 * @param char {string}
	 * @param fallback {CharsetEncoder}
	 */
	static canEncode(charset: CoreCharset, char: string, fallback: CharsetEncoder): boolean {
		switch (charset) {
			case CoreCharset.ascii:
				return char.codePointAt(0) < 0x80;
			case CoreCharset.utf:
				return true;
			default:
				return fallback.canEncode(char);
		}
	}
}
