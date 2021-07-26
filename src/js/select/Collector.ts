import { Helper } from '../helper/Helper';
import { NodeUtils } from '../helper/NodeUtils';
import { Element } from '../nodes/Element';
import { Elements } from '../nodes/Elements';
import { Node } from '../nodes/Node';
import { Evaluator } from './Evaluator';
import { NodeFilter, NodeFilterResult } from './NodeFilter';
import { NodeTraversor } from './NodeTraversor';
import { NodeVisitor } from './NodeVisitor';

/**
 * Collects a list of elements that match the supplied criteria.
 * */
export class Collector {
	private constructor() {}

	/**
	 * Build a list of elements, by visiting root and every descendant of root,
	 * and testing it against the evaluator.
	 * @param evalu Evaluator to test elements against
	 * @param root root of tree to descend
	 * @return list of matches; empty if none
	 */
	static collect(evalu: Evaluator, root: Element): Elements {
		let elements = new Elements();
		let visitor = new Accumulator(root, elements, evalu);
		NodeTraversor.traverse(visitor, root);
		return elements;
	}

	/**
	 * Finds the first Element that matches the Evaluator that descends from the root,
	 * and stops the query once that first match is found.
	 * @param evalu Evaluator to test elements against
	 * @param root root of tree to descend
	 * @return the first match; {@code null} if none
	 */
	static findFirst(evalu: Evaluator, root: Element) {
		let finder = new FirstFinder(root, evalu);
		NodeTraversor.filter(finder, root);
		return finder.match;
	}
}

export class Accumulator implements NodeVisitor {
	constructor(private root: Element, private elements: Elements, private evaluator: Evaluator) {}

	head(node: Node, depth: number): void {
		let isMatch = () => this.evaluator.matches(this.root, <any>node);
		if (NodeUtils.isElement(node) && isMatch()) {
			this.elements.add(node);
		}
	}

	tail(node: Node, depth: number): void {}
}

export class FirstFinder implements NodeFilter {
	match: Element | null = null;

	constructor(private root: Element, private evaluator: Evaluator) {}

	head(node: Node, depth: number): NodeFilterResult {
		let isMatch = () => this.evaluator.matches(this.root, <any>node);
		if (NodeUtils.isElement(node) && isMatch()) {
			this.match = node;
			return NodeFilterResult.STOP;
		} else return NodeFilterResult.CONTINUE;
	}

	tail(node: Node, depth: number): NodeFilterResult {
		return NodeFilterResult.CONTINUE;
	}
}
