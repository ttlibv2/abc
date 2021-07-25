export class StringBuilder {
	private text = '';

	private static objectToString(object: any): string {
		return String(object);
	}

	get length(): number {
		return this.text.length;
	}

	get(index: number, length: number = 1): string {
		return this.text.slice(index + 1, index + length);
	}

	/**
	 * Appends the string
	 * @param {any} object
	 */
	append(object: any): this {
		this.text += StringBuilder.objectToString(object);
		return this;
	}

	appendCodePoint(...codePoints: number[]): this {
		this.text += codePoints.map((cp) => String.fromCharCode(cp)).join('');
		return this;
	}

	insert(begin: number, object: any): this {
		let str = StringBuilder.objectToString(object);
		if (begin === 0) this.text = str + this.text;
		else if (begin === this.length - 1) this.text += str;
		else this.text = this.text.substring(0, begin) + str + this.text.substring(begin);
		return this;
	}

	/**
	 * Removes the characters in a substring of this sequence.
	 * @param begin
	 * @param end
	 */
	delete(begin: number, end: number = this.length): this {
		let last = end + 1 < this.length ? this.text.substring(end) : '';
		let first = begin > 0 ? this.text.substring(0, begin) : '';
		this.text = first + last;
		return this;
	}

	/**
	 * deleteCharAt
	 */
	deleteCharAt(pos: number): this {
		delete this.text.split('')[pos];
		return this;
	}

	charAt(index: number): string {
		return this.text.charAt(index);
	}

	/**
	 * Returns the Unicode value of the character at the specified location.
	 * @param index The zero-based index of the desired character. If there is no character at the specified index, NaN is returned.
	 */
	charCodeAt(index: number): number {
		return this.text.charCodeAt(index);
	}

	/**
	 * Returns a nonnegative integer Number less than 1114112 (0x110000)
	 * that is the code point value of the UTF-16
	 * @param {number} pos
	 * @return {number}
	 */
	codePointAt(pos: number): number {
		return this.text.codePointAt(pos);
	}

	/**
	 * indexOf
	 * @param searchString
	 * @param pos
	 */
	indexOf(searchString: string, pos: number = 0): number {
		return this.text.indexOf(searchString, pos);
	}

	/**
	 * lastIndexOf
	 * @param searchString
	 * @param pos
	 */
	lastIndexOf(searchString: string, pos: number = 0): number {
		return this.text.lastIndexOf(searchString, pos);
	}

	match(regexp: string | RegExp): RegExpMatchArray {
		return this.text.match(regexp);
	}

	/**
	 * Replaces text in a string, using a regular expression or search string.
	 * @param searchValue A string to search for.
	 * @param replaceValue A string containing the text to replace for every successful match of searchValue in this string.
	 */
	replace(searchValue: string | RegExp, replaceValue: string): string;

	/**
	 * Replaces text in a string, using a regular expression or search string.
	 * @param searchValue A string to search for.
	 * @param replacer A function that returns the replacement text.
	 */
	replace(searchValue: string | RegExp, replacer: (substring: string, ...args: any[]) => string): string;

	/** @private */
	replace(searchValue: string | RegExp, replace: any): string {
		return this.text.replace(searchValue, replace);
	}

	/**
	 * Finds the first substring match in a regular expression search.
	 * @param regexp The regular expression pattern and applicable flags.
	 */
	search(regexp: string | RegExp): number {
		return this.text.search(regexp);
	}

	/**
	 * Returns a section of a string.
	 * @param start
	 * @param end
	 */
	slice(start?: number, end?: number): string {
		return this.text.slice(start, end);
	}

	/**
	 * Split a string into substrings
	 * @param separator A string that identifies character or characters to use in separating the string.
	 * @param limit A value used to limit the number of elements returned in the array.
	 */
	split(separator: string | RegExp, limit?: number): string[] {
		return this.text.split(separator, limit);
	}

	toString(): string {
		return this.text;
	}
}
