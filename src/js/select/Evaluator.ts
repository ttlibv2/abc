import { Assert } from '../helper/Assert';
import { Helper } from '../helper/Helper';
import { Normalizer } from '../helper/Normalizer';
import { Element } from '../nodes/Element';

/**
 * Evaluates that an element matches the selector.
 */
export abstract class Evaluator {
	/**
	 * Test if the element meets the evaluator's requirements.
	 *
	 * @param root    Root of the matching subtree
	 * @param element tested element
	 * @return Returns <tt>true</tt> if the requirements are met or
	 * <tt>false</tt> otherwise
	 */
	abstract matches(root: Element, element: Element): boolean;

	abstract toString(): string;
}

/** Evaluator for all element */
export class AnyEval extends Evaluator {
	matches(root: Element, element: Element): boolean {
		return true;
	}

	toString(): string {
		return `*`;
	}
}

/**
 * Evaluator for tag name: div, ul,...
 */
export class TagEval extends Evaluator {
	constructor(private tagName: string) {
		super();
	}

	matches(root: Element, element: Element): boolean {
		return element.normalName() === this.tagName;
	}

	toString(): string {
		return this.tagName;
	}
}

/**
 * Evaluator for tag name that ends with
 */
export class TagEndsWithEval extends Evaluator {
	constructor(private tagName: string) {
		super();
	}

	matches(root: Element, element: Element): boolean {
		return element.normalName().endsWith(this.tagName);
	}

	toString(): string {
		return this.tagName;
	}
}

/**
 * Evaluator for element id
 */
export class IdEval extends Evaluator {
	constructor(private id: string) {
		super();
	}

	matches(root: Element, element: Element): boolean {
		return this.id === element.id();
	}

	toString(): string {
		return `#${this.id}`;
	}
}

/**
 * Evaluator for element class
 */
export class ClassEval extends Evaluator {
	constructor(private className: string) {
		super();
	}

	matches(root: Element, element: Element): boolean {
		return element.hasClass(this.className);
	}

	toString(): string {
		return `.${this.className}`;
	}
}

/**
 * Evaluator for attribute name matching
 */
export class AttributeEval extends Evaluator {
	constructor(private name: string) {
		super();
	}

	matches(root: Element, element: Element): boolean {
		return element.hasAttr(this.name);
	}

	toString(): string {
		return `[${this.name}]`;
	}
}

/**
 * Evaluator for attribute name prefix matching
 */
export class AttributeStartingEval extends Evaluator {
	constructor(private keyPrefix: string) {
		super();
		keyPrefix = Assert.notEmpty(keyPrefix);
		this.keyPrefix = Normalizer.lowerCase(keyPrefix);
	}

	matches(root: Element, element: Element): boolean {
		let values = element.get_attributes().asList();
		return values.some((attr) => {
			let key = Normalizer.lowerCase(attr.get_key());
			return key.startsWith(this.keyPrefix);
		});
	}

	toString(): string {
		return `[^${this.keyPrefix}]`;
	}
}

/**
 * Abstract evaluator for attribute name/value matching
 */
export abstract class AttributeKeyPairEval extends Evaluator {
	/**
	 * Create new constructor
	 * @param {string} key
	 * @param {any} value
	 * @param {boolean=true} trimValue
	 */
	constructor(
		protected key: string,
		protected value: any,
		protected trimValue: boolean = true
	) {
		super();

		Assert.notEmpty(key);

		this.key = Normalizer.normalize(key);

		if (typeof value === 'string') {
			Assert.notEmpty(value);
			let isStringLiteral =
				(value.startsWith(`'`) && value.endsWith(`'`)) ||
				(value.startsWith(`"`) && value.endsWith(`"`));
			if (isStringLiteral) value = value.substring(1, value.length - 1);
			this.value = Normalizer.normalize(value, trimValue && isStringLiteral);
		} else {
			Assert.notNull(value);
			this.value = value;
		}
	}

	get_value(): any {
		return this.value;
	}
}

/**
 * Evaluator for attribute name/value matching
 */
export class AttributeWithValueEval extends AttributeKeyPairEval {
	constructor(key: string, value: string) {
		super(key, value);
	}

	matches(root: Element, element: Element): boolean {
		let hasAttr = element.hasAttr(this.key);
		let lowerVal = this.get_value().toLowerCase();
		let elVal = element.attr(this.key).trim().toLowerCase();
		return hasAttr && lowerVal === elVal;
	}

	toString(): string {
		return `[${this.key}=${this.value}]`;
	}
}

/**
 * Evaluator for attribute name != value matching
 */
export class AttributeWithValueNotEval extends AttributeKeyPairEval {
	constructor(key: string, value: string) {
		super(key, value);
	}

	matches(root: Element, element: Element): boolean {
		let lowerVal = this.get_value().toLowerCase();
		let attrVal = element.attr(this.key).trim().toLowerCase();
		return lowerVal === attrVal;
	}

	toString(): string {
		return `[${this.key}!=${this.value}]`;
	}
}

/**
 * Evaluator for attribute name/value matching (value prefix)
 */
export class AttributeWithValueStartingEval extends AttributeKeyPairEval {
	constructor(key: string, value: string) {
		super(key, value, false);
	}

	matches(root: Element, element: Element): boolean {
		let hasAttr = element.hasAttr(this.key);
		let lowerVal = Normalizer.lowerCase(element.attr(this.key)); // value is lower case already
		return hasAttr && lowerVal.startsWith(this.value);
	}

	toString(): string {
		return `[${this.key}^=${this.value}]`;
	}
}

/**
 * Evaluator for attribute name/value matching (value ending)
 */
export class AttributeWithValueEndingEval extends AttributeKeyPairEval {
	constructor(key: string, value: string) {
		super(key, value, false);
	}

	matches(root: Element, element: Element): boolean {
		let hasAttr = element.hasAttr(this.key);
		let lowerVal = Normalizer.lowerCase(element.attr(this.key)); // value is lower case already
		return hasAttr && lowerVal.endsWith(this.value);
	}

	toString(): string {
		return `[${this.key}$=${this.value}]`;
	}
}

/**
 * Evaluator for attribute name/value matching (value containing)
 */
export class AttributeWithValueContainingEval extends AttributeKeyPairEval {
	constructor(key: string, value: string) {
		super(key, value);
	}

	matches(root: Element, element: Element): boolean {
		let hasAttr = element.hasAttr(this.key);
		let lowerVal = Normalizer.lowerCase(element.attr(this.key)); // value is lower case
		return hasAttr && lowerVal.includes(this.value);
	}

	toString(): string {
		return `[${this.key}*=${this.value}]`;
	}
}

/**
 * Evaluator for attribute name/value matching (value regex matching)
 */
export class AttributeWithValueMatchingEval extends AttributeKeyPairEval {
	constructor(key: string, pattern: RegExp | string) {
		super(Normalizer.normalize(key), pattern);
	}

	get_value(): RegExp {
		return this.value;
	}

	matches(root: Element, element: Element): boolean {
		let hasAttr = element.hasAttr(this.key);
		let isMatch = this.get_value().test(element.attr(this.key));
		return hasAttr && isMatch;
	}

	toString(): string {
		return `[${this.key}~=${this.value.toString()}]`;
	}
}

//=============================================================
//  [Combinators]
//
//  E F	        an F element descended from an E element	        div a, .logo h1
//  E > F	    an F direct child of E	                            ol > li
//  E + F	    an F element immediately preceded by sibling E	    li + li, div.head + div
//  E ~ F	    an F element preceded by sibling E	                h1 ~ p
//  E, F, G	    all matching elements E, F, or G	                a[href], div, h3
//=============================================================

/**
 * Base combining (and, or) evaluator.
 */
export abstract class CombiningEvaluator extends Evaluator {
	protected readonly evaluators: Evaluator[] = [];

	constructor(evaluators: Evaluator[]) {
		super();
		this.evaluators.push(...(evaluators || []));
	}

	get size(): number {
		return this.evaluators.length;
	}

	rightMostEvaluator(): Evaluator {
		return this.evaluators[this.size - 1] || null;
	}

	replaceRightMostEvaluator(evalu: Evaluator): void {
		this.evaluators[this.size - 1] = evalu;
	}
}

export class AndEval extends CombiningEvaluator {
	matches(root: Element, node: Element): boolean {
		return !this.evaluators.some((ev) => !ev.matches(root, node));
	}

	toString(): string {
		return this.evaluators.join('');
	}
}

export class OrEVal extends CombiningEvaluator {
	/**
	 * Create a new Or evaluator. The initial evaluators are ANDed together and used as the first clause of the OR.
	 * @param evaluators initial OR clause (these are wrapped into an AND evaluator).
	 */
	constructor(evaluators: Evaluator[]) {
		super([]);
		if (this.size > 1) this.evaluators.push(new AndEval(evaluators));
		else this.evaluators.push(...(evaluators || []));
	}

	add(evalu: Evaluator) {
		this.evaluators.push(evalu);
	}

	matches(root: Element, node: Element): boolean {
		return this.evaluators.some((ev) => ev.matches(root, node));
	}

	toString(): string {
		return this.evaluators.join(', ');
	}
}

//=============================================================
// :lt(n)	elements whose sibling index is less than n	td:lt(3) finds the first 3 cells of each row
// :gt(n)	elements whose sibling index is greater than n	td:gt(1) finds cells after skipping the first two
// :eq(n)	elements whose sibling index is equal to n	td:eq(0) finds the first cell of each row
//=============================================================

/** Abstract evaluator for sibling index matching */
export abstract class IndexEvaluator extends Evaluator {
	constructor(protected index: number) {
		super();
	}
}

/**
 * :lt(n) -> Evaluator for matching by sibling index number (e < idx)
 * */
export class IndexLessThanEval extends IndexEvaluator {
	matches(root: Element, element: Element): boolean {
		return root != element && element.elementSiblingIndex() < this.index;
	}

	toString(): string {
		return `:lt(${this.index})`;
	}
}

/**
 * :gt(n) -> Evaluator for matching by sibling index number (e > idx)
 * */
export class IndexGreaterThanVal extends IndexEvaluator {
	matches(root: Element, element: Element): boolean {
		return element.elementSiblingIndex() > this.index;
	}

	toString(): string {
		return `:gt(${this.index})`;
	}
}

/**
 * :eq(n) -> Evaluator for matching by sibling index number (e = idx)
 * */
export class IndexEqualEval extends IndexEvaluator {
	matches(root: Element, element: Element): boolean {
		return element.elementSiblingIndex() === this.index;
	}

	toString(): string {
		return `:eq(${this.index})`;
	}
}

/**
 * :last-child -> Evaluator for matching the last sibling (css :last-child)
 */
export class IsLastChildEval extends Evaluator {
	matches(root: Element, element: Element): boolean {
		let p = element.get_parent();
		return (
			p !== null &&
			!Helper.isDocument(p) &&
			p.elementSiblingIndex() === p.children().length - 1
		);
	}

	toString(): string {
		return `:last-child`;
	}
}

export class IsFirstOfTypeEval extends IsNthOfType {
	getPseudoClass(): string {
		throw new Error('Method not implemented.');
	}
	calculatePosition(root: Element, element: Element): number {
		throw new Error('Method not implemented.');
	}
	toString(): string {
		throw new Error('Method not implemented.');
	}
	matches(root: Element, element: Element): boolean {
		throw new Error('Method not implemented.');
	}
}
export class IsLastOfTypeEval extends IsNthLastOfType {
	getPseudoClass(): string {
		throw new Error('Method not implemented.');
	}
	calculatePosition(root: Element, element: Element): number {
		throw new Error('Method not implemented.');
	}
	toString(): string {
		throw new Error('Method not implemented.');
	}
	matches(root: Element, element: Element): boolean {
		throw new Error('Method not implemented.');
	}
}
export class IsNthChildEval extends CssNthEvaluator {
	getPseudoClass(): string {
		throw new Error('Method not implemented.');
	}
	calculatePosition(root: Element, element: Element): number {
		throw new Error('Method not implemented.');
	}
	toString(): string {
		throw new Error('Method not implemented.');
	}
	matches(root: Element, element: Element): boolean {
		throw new Error('Method not implemented.');
	}
}
export class IsNthLastChildEval extends CssNthEvaluator {
	getPseudoClass(): string {
		throw new Error('Method not implemented.');
	}
	calculatePosition(root: Element, element: Element): number {
		throw new Error('Method not implemented.');
	}
	toString(): string {
		throw new Error('Method not implemented.');
	}
	matches(root: Element, element: Element): boolean {
		throw new Error('Method not implemented.');
	}
}

export abstract class CssNthEvaluator extends Evaluator {
	/**
	 * Create new constructor
	 * @param a {number}
	 * @param b {number}
	 */
	constructor(protected a: number, protected b: number) {
		super();
	}

	abstract getPseudoClass(): string;
	abstract calculatePosition(root: Element, element: Element): number;

	matches(root: Element, element: Element): boolean {
		let p = element.get_parent();
		if (Helper.isNull(p) || Helper.isDocument(p)) return false;
		else {
			let pos = this.calculatePosition(root, element);
			if (this.a === 0) return pos === this.b;
			else return (pos - this.b) * this.a >= 0 && (pos - this.b) % this.a == 0;
		}
	}

	toString(): string {
		let ps = this.getPseudoClass(),
			a = this.a,
			b = this.b;
		return a === 0
			? `:${ps}(${b})`
			: b === 0
			? `:${ps}(${a}n)`
			: `:${ps}(${a}n+${b})`;
	}
}

// nth-of-type
export class IsNthOfTypeEval extends CssNthEvaluator {
	getPseudoClass(): string {
		return `nth-of-type`;
	}

	calculatePosition(root: Element, element: Element): number {
		if (Helper.isNull(element.get_parent())) return 0;
		else {
			let pos = 0,
				family = element.get_parent().children();
			for (let i = 0; i < family.length; i++) {
				let el = family.get(i);
				if (el.tag() === element.tag()) pos++;
				if (el === element) break;
			}
			return pos;
		}
	}
}
export class IsNthLastOfTypeEval extends CssNthEvaluator {
	getPseudoClass(): string {
		throw new Error('Method not implemented.');
	}
	calculatePosition(root: Element, element: Element): number {
		throw new Error('Method not implemented.');
	}
	toString(): string {
		throw new Error('Method not implemented.');
	}
	matches(root: Element, element: Element): boolean {
		throw new Error('Method not implemented.');
	}
}
export class IsFirstChildEval extends Evaluator {
	toString(): string {
		throw new Error('Method not implemented.');
	}
	matches(root: Element, element: Element): boolean {
		throw new Error('Method not implemented.');
	}
}
export class IsRootEval extends Evaluator {
	toString(): string {
		throw new Error('Method not implemented.');
	}
	matches(root: Element, element: Element): boolean {
		throw new Error('Method not implemented.');
	}
}
export class IsOnlyChildEval extends Evaluator {
	toString(): string {
		throw new Error('Method not implemented.');
	}
	matches(root: Element, element: Element): boolean {
		throw new Error('Method not implemented.');
	}
}
export class IsOnlyOfTypeEval extends Evaluator {
	toString(): string {
		throw new Error('Method not implemented.');
	}
	matches(root: Element, element: Element): boolean {
		throw new Error('Method not implemented.');
	}
}
export class IsEmptyEval extends Evaluator {
	toString(): string {
		throw new Error('Method not implemented.');
	}
	matches(root: Element, element: Element): boolean {
		throw new Error('Method not implemented.');
	}
}
export class ContainsTextEval extends Evaluator {
	constructor(pattern: string) {
		super();
	}
	toString(): string {
		throw new Error('Method not implemented.');
	}
	matches(root: Element, element: Element): boolean {
		throw new Error('Method not implemented.');
	}
}
export class ContainsDataEval extends Evaluator {
	toString(): string {
		throw new Error('Method not implemented.');
	}
	matches(root: Element, element: Element): boolean {
		throw new Error('Method not implemented.');
	}
}
export class ContainsOwnTextEval extends Evaluator {
	constructor(pattern: string) {
		super();
	}
	toString(): string {
		throw new Error('Method not implemented.');
	}
	matches(root: Element, element: Element): boolean {
		throw new Error('Method not implemented.');
	}
}
export class MatchesEval extends Evaluator {
	constructor(pattern: string | RegExp) {
		super();
	}
	toString(): string {
		throw new Error('Method not implemented.');
	}
	matches(root: Element, element: Element): boolean {
		throw new Error('Method not implemented.');
	}
}
export class MatchesOwnEval extends Evaluator {
	constructor(pattern: string | RegExp) {
		super();
	}
	toString(): string {
		throw new Error('Method not implemented.');
	}
	matches(root: Element, element: Element): boolean {
		throw new Error('Method not implemented.');
	}
}
export class MatchTextEval extends Evaluator {
	toString(): string {
		throw new Error('Method not implemented.');
	}
	matches(root: Element, element: Element): boolean {
		throw new Error('Method not implemented.');
	}
}

export abstract class EvalHelper {
	/** Any element */
	static Any(): AnyEval {
		return new AnyEval();
	}

	/**
	 * Elements with the given tag name
	 * @param {string} tagName - div, ul, li,..
	 * */
	static Tag(tagName: string): TagEval {
		return new TagEval(tagName);
	}

	/**
	 * Elements with attribute ID of "id"
	 * @param {string} id - div#wrap, #logo
	 * */
	static Id(id: string): IdEval {
		return new IdEval(id);
	}
}
