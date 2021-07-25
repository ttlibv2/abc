import { Assert } from '../helper/Assert';
import { Attributes } from './Attributes';
import { Node } from './Node';

export abstract class LeafNode extends Node {
	///** @private */
	constructor(private value?: any) {
		super();
	}

	/** @override */
	hasAttributes(): boolean {
		return this.value instanceof Attributes;
	}

	/** @override */
	get_attributes(): Attributes {
		this.ensureAttributes();
		return this.value;
	}

	private ensureAttributes() {
		if (this.hasAttributes()) return;
		else {
			let coreVal = this.value;
			let attrs = new Attributes();
			if (coreVal !== null) {
				attrs.put(this.nodeName(), coreVal);
			}

			this.value = attrs;
		}
	}

	protected get coreVal(): string {
		return this.attr(this.nodeName());
	}

	protected set coreVal(val: string) {
		this.attr(this.nodeName(), val);
	}

	/** @override */
	get_attr(name: string): string {
		return this.hasAttributes()
			? super.get_attr(name)
			: Assert.notEmpty(name) === this.nodeName()
			? this.value
			: '';
	}

	/** @override */
	set_attr(name: string, value: string): this {
		if (!this.hasAttributes() && name === this.nodeName()) {
			this.value = value;
		} else {
			this.ensureAttributes();
			super.set_attr(name, value);
		}
		return this;
	}

	/** @override */
	hasAttr(name: string): boolean {
		this.ensureAttributes();
		return super.hasAttr(name);
	}

	/** @override */
	removeAttr(name: string): this {
		this.ensureAttributes();
		return super.removeAttr(name);
	}

	/** @override */
	absUrl(name: string): string {
		this.ensureAttributes();
		return super.absUrl(name);
	}

	/** @override */
	baseUri(): string {
		return this.parent?.baseUri() || '';
	}

	/** @override */
	protected doSetBaseUri(baseUri: string) {}

	/** @override */
	childNodeSize(): number {
		return 0;
	}

	/** @override */
	empty(): this {
		return this;
	}

	/** @override */
	ensureChildNodes(): Node[] {
		return [];
	}

	/** @override */
	protected doClone(parent: Node): LeafNode {
		let clone: LeafNode = super.doClone(parent);
		if (this.hasAttributes()) clone.value = this.value.clone();
		return clone;
	}
}
