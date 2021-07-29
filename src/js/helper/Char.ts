export class Char {

	//

	static readonly Default = new Char();

	/**
	 * Convert number or string to char
	 * @param value {number | string}
	 */
	static valueOf(value: number | string): Char {
		return new Char(value);
	}

	/**
	 * Convert string to char array
	 * @param string {string}
	 */
	static string2Char(string: string): Char[] {
		return string.split('').map((ch) => Char.valueOf(ch));
	}

	/**
	 * Convert array charAt to char
	 * @param charAt {string[]}
	 */
	static array2Char(charAt: string[]): Char[] {
		let bool = charAt.some((ch) => ch.length > 1);
		if (bool) throw Error(`array charAt invalid`);
		else return charAt.map((ch) => Char.valueOf(ch));
	}

	static isChar(object: any): object is Char {
		return object instanceof Char;
	}

	//------------------------------------------
	private code: number;

	/**
	 * Char constructor
	 * @param value {number | string}
	 */
	private constructor(value?: number | string) {
		this.code = typeof value === 'number' ? value : (value || '\u0000').charCodeAt(0);
	}

	get codepoint(): number {
		return this.code;
	}

	get num(): number {
		return this.code;
	}

	get string(): string {
		return String.fromCharCode(this.code);
	}

	get hex(): string {
		return `0x${this.code.toString(16)}`;
	}

	/**
	 * Return true if equal
	 * @param {number} charCode
	 */
	equals(charCode: number): boolean;

	/**
	 * Return true if equal
	 * @param {string} string
	 */
	equals(string: string): boolean;

	/**
	 * Return true if equal
	 * @param {Char} char
	 */
	equals(char: Char): boolean;

	/** @private */
	equals(target: any): boolean {
		if (target instanceof Char) {
			return this.code === target.code;
		} else if (typeof target === 'string') {
			return this.string === target;
		} else return this.num === target;
	}

	in(array: string[]): boolean {
		throw new Error('Method not implemented.');
	}
}
