import { Assert } from '../helper/Assert';
import { Helper } from '../helper/Helper';
import { Element } from '../nodes/Element';
import { Elements } from '../nodes/Elements';
import { Collector } from './Collector';
import { Evaluator } from './Evaluator';
import { QueryParser } from './QueryParser';

export abstract class Selector {
	private constructor() {}

	/**
	 * Find elements matching selector.
	 *
	 * @param query CSS selector
	 * @param root  root element to descend into
	 * @return matching elements, empty if none
	 * @throws Selector.SelectorParseException (unchecked) on an invalid CSS query.
	 */
	static select(query: string, root: Element): Elements;

	/**
	 * Find elements matching selector.
	 *
	 * @param evaluator CSS selector
	 * @param root root element to descend into
	 * @return matching elements, empty if none
	 */
	static select(evaluator: Evaluator, root: Element): Elements;

	/**
	 * Find elements matching selector.
	 *
	 * @param query CSS selector
	 * @param roots root elements to descend into
	 * @return matching elements, empty if none
	 */
	static select(query: string, roots: Element[]): Elements;

	/**
	 * @private
	 */
	static select(first: string | Evaluator, last: Element | Element[]): Elements {
		// first is Evaluator
		if (first instanceof Evaluator && last instanceof Element) {
			Assert.notNull(first);
			Assert.notNull(last);
			return Collector.collect(first, last);
		}

		// fisrt is query && last is element
		else if (typeof first === 'string' && last instanceof Element) {
			Assert.notEmpty(first);
			let evaluator = QueryParser.parse(first);
			return Selector.select(evaluator, last);
		}

		// fisrt is query && last is array element
		else if (typeof first === 'string' && Array.isArray(last) && last[0] instanceof Element) {
			Assert.notEmpty(first);
			Assert.notNull(last);
			let evaluator = QueryParser.parse(first);
			let elements = new Elements();
			let seenElements: Map<Element, boolean> = new Map();

			for (let root of last) {
				let found = Selector.select(evaluator, root);
				// for(let el of found)
			}
		}
	}

	static selectFirst(object: string | Evaluator, arg1: Element): Element {
		throw new Error('Method not implemented.');
	}
	static filterOut(arg0: Element | Elements, out: Elements): Elements {
		throw new Error('Method not implemented.');
	}
}
