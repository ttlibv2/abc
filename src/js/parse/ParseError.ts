export class ParseError {
	//

	/**
	 * constructor
	 * @param pos
	 * @param msg
	 */
	constructor(public readonly pos: number, public readonly msg: string) {}

	toString(): string {
		return this.pos + ': ' + this.msg;
	}
}

export class ParseErrorList extends Array<ParseError> {
	static readonly INITIAL_CAPACITY = 16;

	/**
	 * constructor
	 * @param initialCapacity
	 * @param maxSize
	 */
	constructor(
		private readonly initialCapacity: number, //
		private readonly maxSize: number,
	) {
		super(initialCapacity);
	}

	canAddError() {
		return this.length < this.maxSize;
	}

	getMaxSize() {
		return this.maxSize;
	}

	static noTracking(): ParseErrorList {
		return new ParseErrorList(0, 0);
	}

	static tracking(maxSize: number): ParseErrorList {
		return new ParseErrorList(ParseErrorList.INITIAL_CAPACITY, maxSize);
	}
}
