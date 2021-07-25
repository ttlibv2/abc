export class Char extends String {
	static readonly NULL = Char.valueOf('\u0000');

	static valueOf(string: string) {
		return new Char(string.charAt(0));
	}

	static isChar(object: any): object is Char {
		return object instanceof Char;
	}

	get charCode(): number {
		return this.charCodeAt(0);
	}

	includes(searchString: string | Char, position?: number): boolean {
		return super.includes(searchString.toString(), position);
	}

	equals(char: Char | string): boolean {
		return this.charAt(0) === char.charAt(0);
	}

	in(array: string[]): boolean {
		return array.includes(this.toString());
	}

	toString(): string {
		return this[0];
	}
}
