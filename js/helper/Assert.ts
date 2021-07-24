import { Node } from '../nodes/Node';

export class Assert {
	static noNullElements(children: Node[]) {
		throw new Error('Method not implemented.');
	}

	static isTrue(bool: boolean, msg?: string) {
		throw new Error('Method not implemented.');
	}

	static isFalse(bool: boolean): boolean {
		if (bool === true) throw new Error(`Required value is false`);
		else return bool;
	}

	static notNull<T>(object: T, msg?: string): T {
		if (object === null) {
			msg = msg || `Value must be not null.`;
			throw new Error(msg);
		} else return object;
	}

	static notEmpty(str: string, msg?: string): string {
		if (str === null || str.length === 0) {
			msg = msg || `Value must be not empty.`;
			throw new Error(msg);
		} else return str;
	}
}
