import { Assert } from './Assert';
import { StringBuilder } from './StringBuilder';
import { EqualsBuilder } from './EqualsBuilder';
import { Char } from './Char';

export class Helper {
	// so very deeply nested nodes don't get insane padding amounts
	private static readonly maxPaddingWidth: number = 30;

	/**
	 * Returns space padding (up to a max of 30).
	 * @param width amount of padding desired
	 * @return string of spaces * width
	 */
	static padding(width: number): string {
		Assert.isTrue(width > 0, 'width must be > 0');
		width = Math.min(width, Helper.maxPaddingWidth);
		return ' '.repeat(width);
	}

	//===========================================================

	static isPrimitive(object: any): boolean {
		return (typeof object !== 'object' && typeof object !== 'function') || object === null;
	}

	static isEmpty(object: any): boolean {
		if (Helper.isNull(object)) return true;
		if (Array.isArray(object)) return object.length === 0;
		if (Helper.isString(object)) return object.length === 0;
		if (Helper.isObject(object)) return Object.keys(object).length === 0;
		else return String(object).length === 0;
	}

	static isString(object: any): boolean {
		return typeof object === 'string';
	}

	static isObject(object: any): boolean {
		return Object.prototype.toString.call(object) === '[object Object]';
	}

	static isTextEmpty(str: string): boolean {
		return Helper.isNull(str) || str.length === 0;
	}

	static isNull(object: any): boolean {
		return object === null || object === undefined;
	}

	static notNull(object: any): boolean {
		return !Helper.isNull(object);
	}

	static equalsIgnoreCase(lhs: string, rhs: string): boolean {
		if (lhs === rhs) return true;
		else return (lhs || '').toLowerCase() === (rhs || '').toLowerCase();
	}

	static numberToHex(num: number): string {
		return num.toString(16);
	}

	//==========================================================

	static createEqualsBuilder(): EqualsBuilder {
		return new EqualsBuilder();
	}

	/**
	 * Tests if a string is blank: null, empty, or only whitespace (" ", \r\n, \t, etc)
	 * @param string string to test
	 * @return if string is blank
	 */
	static isBlank(string: string): boolean {
		if (Helper.isEmpty(string)) return true;
		else return !string.split('').some((str) => !Helper.isWhitespace(str.codePointAt(0)));
	}

	/**
	 * Normalise the whitespace within this string; multiple spaces collapse to a single, and all whitespace characters
	 * (e.g. newline, tab) convert to a simple space
	 * @param string content to normalise
	 * @return normalised string
	 */
	static normaliseWhitespace(string: string): string {
		let accum = new StringBuilder();
		Helper.appendNormalisedWhitespace(accum, string, false);
		return accum.toString();
	}

	/**
	 * After normalizing the whitespace within a string, appends it to a string builder.
	 * @param accum builder to append to
	 * @param string string to normalize whitespace within
	 * @param stripLeading set to true if you wish to remove any leading whitespace
	 */
	static appendNormalisedWhitespace(accum: StringBuilder, string: string, stripLeading: boolean) {
		let lastWasWhite = false;
		let reachedNonWhite = false;
		let codePoint: number;

		for (let i = 0; i < string.length; i += Helper.charCount(codePoint)) {
			codePoint = string.codePointAt(i);

			//
			if (Helper.isActuallyWhitespace(codePoint)) {
				if ((stripLeading && !reachedNonWhite) || lastWasWhite) continue;
				else {
					accum.append(' ');
					lastWasWhite = true;
				}
			}

			//
			else if (!Helper.isInvisibleChar(codePoint)) {
				accum.appendCodePoint(codePoint);
				lastWasWhite = false;
				reachedNonWhite = true;
			}
		}
	}

	/**
	 * Tests if a code point is "whitespace" as defined in the HTML spec. Used for output HTML.
	 * @param char code point to test
	 * @return true if code point is whitespace, false otherwise
	 * @see #isActuallyWhitespace(int)
	 */
	static isWhitespace(codePoint: number) {
		let char = String.fromCodePoint(codePoint);
		return char === ' ' || char === '\t' || char === '\n' || char === '\f' || char === '\r';
	}

	/**
	 * Tests if a code point is "whitespace" as defined by what it looks like. Used for Element.text etc.
	 * @param codePoint code point to test
	 * @return true if code point is whitespace, false otherwise
	 */
	static isActuallyWhitespace(codePoint: number) {
		let char = String.fromCodePoint(codePoint);
		return char === ' ' || char === '\t' || char === '\n' || char === '\f' || char === '\r' || codePoint === 160;
	}

	static isInvisibleChar(codePoint: number): boolean {
		return codePoint === 8203 || codePoint === 173; // zero width sp, soft hyphen
		// previously also included zw non join, zw join - but removing those breaks semantic meaning of text
	}

	static isLetterOrDigit(str: string): boolean {
		return /^[0-9a-zA-Z]+$/.test(str);
	}

	static isLetter(str: string | Char): boolean {
		return /^[a-zA-Z]+$/.test(str.toString());
	}

	static isDigit(str: string | Char): boolean {
		return /^[0-9]+$/.test(str.toString());
	}

	// The minimum value of a Unicode supplementary code point, constant U+10000.
	static MIN_SUPPLEMENTARY_CODE_POINT = 0x10000;

	/**
	 * Character.charCount(c)
	 */
	static charCount(codePoint: number): 1 | 2 {
		return codePoint >= Helper.MIN_SUPPLEMENTARY_CODE_POINT ? 2 : 1;
	}

	/**
	 * resolveUrl
	 * @param baseUri
	 * @param href
	 */
	static resolveUrl(baseUri: string, href: string) {
		return baseUri + '/' + href;
	}

	/**
	 * Tests that a String contains only ASCII characters.
	 * @param string scanned string
	 * @return true if all characters are in range 0 - 127
	 */
	static isAscii(string: string): boolean {
		return !string.split('').some((str) => str.charCodeAt(0) > 127);
	}
}
