import { Assert } from '../helper/Assert';
import { Helper } from '../helper/Helper';
import { NodeUtils } from '../helper/NodeUtils';
import { StringBuilder } from '../helper/StringBuilder';
import { Parser } from '../parse/Parser';
import { OutputSetting } from '../parse/Setting';
import { NodeFilter } from '../select/NodeFilter';
import { NodeTraversor } from '../select/NodeTraversor';
import { NodeVisitor } from '../select/NodeVisitor';
import { Attributes } from './Attributes';
import { Document } from './Document';
import { Element } from './Element';
import { Elements } from './Elements';
import { IObject } from './IObject';

class OuterHtmlVisitor implements NodeVisitor {
	/**
	 * CReate new constructor
	 * @param accum
	 * @param setting
	 */
	constructor(private readonly accum: StringBuilder, private readonly setting: OutputSetting) {
		this.setting.prepareEncoder();
	}

	head(node: Node, depth: number): void {
		node.outerHtmlHead(this.accum, depth, this.setting);
	}

	tail(node: Node, depth: number): void {
		if (node.nodeName() !== '#text') {
			node.outerHtmlTail(this.accum, depth, this.setting);
		}
	}
}

/**
 * The base, abstract Node model.
 * Elements, Documents, Comments etc are all Node instances.
 */
export abstract class Node implements IObject {
	/** Parent of the node */
	protected parent: Node | null = null;

	siblingIndex: number = -1;

	//constructor() {}

	/**
	 * Checks if this node has a parent.
	 * @return {boolean}
	 */
	hasParent(): boolean {
		return this.parent !== null;
	}

	/**
	 * Check if this Node has an actual Attributes object.
	 * @return {boolean}
	 */
	abstract hasAttributes(): boolean;

	/**
	 * Get all of the element's attributes.
	 * @return attributes (which implements iterable, in same order as presented in original HTML).
	 */
	abstract get_attributes(): Attributes;

	abstract ensureChildNodes(): Node[];

	abstract nodeName(): string;

	/**
	 * Get the base URI that applies to this node.
	 * Will return an empty string if not defined.
	 * Used to make relative links absolute.
	 */
	abstract baseUri(): string;

	/**
	 * Set the baseUri for just this node (not its descendants), if this Node tracks base URIs.
	 * @param baseUri new URI
	 */
	protected abstract doSetBaseUri(baseUri: string): void;

	/**
	 * Update the base URI of this node and all of its descendants.
	 * @param baseUri base URI to set
	 */
	setBaseUri(baseUri: string) {
		this.doSetBaseUri(Assert.notNull(baseUri));
	}

	/**
	 * Get this node's root node
	 * @return topmost ancestor.
	 */
	get rootNode(): any {
		let node = this.parent;
		while (node !== null) node = node.parent;
		return node;
	}

	get parentNode(): any {
		return this.parent;
	}

	getSiblingIndex() {
		return this.siblingIndex;
	}

	setSiblingIndex(index: number) {
		this.siblingIndex = index;
	}

	/**
	 * Gets the Document associated with this Node.
	 * @return the Document associated with this Node, or null if there is no such Document.
	 */
	ownerDocument(): Document | null {
		let rootNode = this.rootNode;
		return rootNode instanceof Document ? rootNode : null;
	}

	/**
	 * Get an attribute's value by its key. <b>Case insensitive</b>
	 * @param {string} name The attribute key.
	 * @return {string} The attribute, or empty string if not present (to avoid nulls).
	 */
	attr(name: string): string;

	/**
	 * Set an attribute (key=value). If the attribute already exists, it is replaced.
	 * @param {string} name The attribute key.
	 * @param {string} value The attribute value.
	 */
	attr(name: string, value: string | boolean | number): this;

	/**
	 * Set an attribute (key=value). If the attribute already exists, it is replaced.
	 * @param {Record<string, string | null>} attrs The object attribute
	 */
	attr(attrs: Record<string, string | null>): this;

	/**
	 * @private
	 */
	attr(name: string | Record<string, string | null>, value?: string): any {
		// Set an attribute (key=value)
		if (value !== undefined && typeof name === 'string') {
			return this.set_attr(name, value);
		}

		// Get an attribute
		else if (typeof name === 'string') {
			return this.get_attr(name);
		}

		// Set an attribute (Record<string, string | null>)
		else if (typeof name === 'object') {
			let object: Record<string, string | null> = name;
			Object.keys(object).forEach((k) => this.set_attr(k, object[k]));
			return this;
		}
	}

	set_attr(name: string, value: string | number | boolean | null) {
		name = Parser.getParserForNode(this).setting().normalizeTag(name);
		if (typeof value === 'boolean') this.get_attributes().put(name, value);
		else this.get_attributes().putIgnoreCase(name, `${value || ''}`);
		return this;
	}

	get_attr(name: string): string {
		name = Assert.notEmpty(name);
		if (!this.hasAttributes()) return '';
		else {
			let val = this.get_attributes().getIgnoreCase(name);
			return val.length > 0 ? val : name.startsWith('abs:') ? this.absUrl(name.substring(4)) : '';
		}
	}

	/**
	 * Test if this element has an attribute. <b>Case insensitive</b>
	 * @param name The attribute key to check.
	 * @return true if the attribute exists, false if not.
	 */
	hasAttr(name: string): boolean {
		name = Assert.notEmpty(name);
		if (!this.hasAttributes()) return false;
		else {
			let isAbs = name.startsWith('abs:'),
				key = name.substring(4);
			let hasKey = this.get_attributes().hasKeyIgnoreCase(name);
			return isAbs && hasKey && this.absUrl(key).length > 0 ? true : hasKey;
		}
	}

	/**
	 * Remove an attribute from this node.
	 * @param name The attribute to remove.
	 * @return this (for chaining)
	 */
	removeAttr(name: string): this {
		name = Assert.notEmpty(name);
		if (this.hasAttributes()) this.get_attributes().removeIgnoreCase(name);
		return this;
	}

	/**
	 * Clear (remove) all of the attributes in this node.
	 * @return this, for chaining
	 */
	clearAttributes(): this {
		this.get_attributes().clear();
		return this;
	}

	/**
	 * Get an absolute URL from a URL attribute that may be relative (such as an <code>&lt;a href&gt;</code> or
	 * <code>&lt;img src&gt;</code>).
	 * <p>
	 * E.g.: <code>String absUrl = linkEl.absUrl("href");</code>
	 * */
	absUrl(name: string): string {
		name = Assert.notEmpty(name);
		let isFalse = this.hasAttributes() && this.get_attributes().hasKeyIgnoreCase(name);
		return !isFalse ? '' : Helper.resolveUrl(this.baseUri(), this.get_attributes().getIgnoreCase(name));
	}

	/**
	 * Get a child node by its 0-based index.
	 * @param index index of child node
	 * @return the child node at this index.
	 */
	childNode(index: number): Node {
		return this.ensureChildNodes()[index];
	}

	/**
     Get this node's children. Presented as an unmodifiable list: new children can not be added, but the child nodes
     themselves can be manipulated.
     @return list of children. If no children, returns an empty list.
     */
	children(): Node[] {
		return this.childNodeSize() === 0 ? [] : [...this.ensureChildNodes()];
	}

	/**
	 * Returns a deep copy of this node's children. Changes made to these nodes will not be reflected in the original
	 * nodes
	 * @return a deep copy of this node's children
	 */
	childNodesCopy(): Node[] {
		return this.ensureChildNodes().map((node) => node.clone());
	}

	/**
	 * Get the number of child nodes that this node holds.
	 * @return the number of child nodes that this node holds.
	 */
	abstract childNodeSize(): number;

	/**
	 * Delete all this node's children.
	 * @return this node, for chaining
	 */
	abstract empty(): this;

	/**
	 * Remove (delete) this node from the DOM tree.
	 * If this node has children, they are also removed.
	 */
	remove() {
		Assert.notNull(this.parent);
		this.parent?.removeChild(this);
	}

	/**
	 * Insert the specified HTML into the DOM before this node (as a preceding sibling).
	 * @param html HTML to add before this node
	 * @return this node, for chaining
	 * @see #after(String)
	 */
	before(html: string): this;

	/**
	 * Insert the specified node into the DOM before this node (as a preceding sibling).
	 * @param node to add before this node
	 * @return this node, for chaining
	 * @see #after(Node)
	 */
	before(node: Node): this;

	/**
	 * @private
	 */
	before(object: string | Node): this {
		Assert.notNull(object);
		if (typeof object === 'string') {
			return this.addSiblingHtml(this.siblingIndex, object);
		} else {
			Assert.notNull(this.parent);
			this.parent?.addChildren([object], this.siblingIndex);
			return this;
		}
	}

	/**
	 * Insert the specified HTML into the DOM after this node (as a following sibling).
	 * @param html HTML to add after this node
	 * @return this node, for chaining
	 * @see #before(String)
	 */
	after(html: string): this;

	/**
	 * Insert the specified node into the DOM after this node (as a following sibling).
	 * @param node to add after this node
	 * @return this node, for chaining
	 * @see #before(Node)
	 */
	after(node: Node): this;

	/**
	 * @private
	 */
	after(node: string | Node): this {
		Assert.notNull(node);
		let index = this.siblingIndex + 1;
		if (typeof node === 'string') {
			return this.addSiblingHtml(index, node);
		} else {
			Assert.notNull(this.parent);
			this.parent?.addChildren([node], index);
			return this;
		}
	}

	private addSiblingHtml(index: number, html: string) {
		Assert.notNull(html);
		Assert.notNull(this.parent);
		let context: any = this.parent instanceof Element ? this.parent : null;
		let nodes = Parser.getParserForNode(this).parseFragment(html, context, this.baseUri());
		this.parent?.addChildren(nodes, index);
		return this;
	}

	protected parser(): Parser {
		return NodeUtils.parser(this);
	}

	/**
	 * Wrap the supplied HTML around this node.
	 * @param {string} html HTML to wrap around this node
	 */
	wrap(html: string): this {
		Assert.notEmpty(html);
		let context: any = this.parent !== null && this.parent instanceof Element ? this.parent : this instanceof Element ? this : null;

		let wrapChild = this.parser().parseFragment(html, context, this.baseUri());
		let firstWrap = wrapChild[0];
		if (firstWrap instanceof Element) {
			let deepest = this.getDeepChild(firstWrap);
			if (this.parent !== null) this.parent.replaceChild(this, firstWrap);

			// side effect of tricking wrapChildren to lose first
			deepest.addChildren([this]);

			// remainder (unbalanced wrap, like <div></div><p></p> -- The <p> is remainder
			if (wrapChild.length > 0) {
				for (let i = 0; i < wrapChild.length; i++) {
					let remainder = wrapChild[i];
					if (firstWrap === remainder) continue;
					if (remainder.parent !== null) remainder.parent?.removeChild(remainder);
					firstWrap.after(remainder);
				}
			}
		}

		return this;
	}

	/**
	 * Removes this node from the DOM, and moves its children up into the node's parent. This has the effect of dropping
	 * the node but keeping its children.
	 * @return the first child of this node
	 */
	unwrap(): Node | null {
		Assert.notNull(this.parent);
		let childNodes = this.ensureChildNodes();
		let firstChild = childNodes.length > 0 ? childNodes[0] : null;
		this.parent?.addChildren(childNodes, this.siblingIndex);
		this.remove();
		return firstChild;
	}

	private getDeepChild(el: Element): Element {
		let children: Elements = el.children();
		return children.length > 0 ? this.getDeepChild(children[0]) : el;
	}

	// Element overrides this to clear its shadow children elements
	protected nodelistChanged() {
		// Element overrides this to clear its shadow children elements
	}

	/**
	 * Replace this node in the DOM with the supplied node.
	 * @param in the node that will will replace the existing node.
	 */
	replaceWith(node: Node) {
		Assert.notNull(node);
		Assert.notNull(this.parent);
		this.parent?.replaceChild(this, node);
	}

	/**
	 * Update parent for node
	 * @param {Node} parent
	 */
	protected setParentNode(parent: Node) {
		Assert.notNull(parent);
		if (this.parent !== null) this.parent.removeChild(this);
		this.parent = parent;
	}

	/**
	 * Replace for node
	 * @param {Node} nodeOut
	 * @param {Node} nodeIn
	 */
	replaceChild(nodeOut: Node, nodeIn: Node) {
		Assert.isTrue(nodeOut.parent === this);
		Assert.notNull(nodeIn);

		if (nodeIn.parent !== null) {
			nodeIn.parent.removeChild(nodeIn);
		}

		let index = nodeOut.siblingIndex;
		this.ensureChildNodes()[index] = nodeIn;
		nodeIn.parent = this;
		nodeIn.siblingIndex = index;
		nodeOut.parent = null;
	}

	/**
	 * Remove child node
	 * @param {Node} nodeOut
	 */
	protected removeChild(nodeOut: Node) {
		Assert.isTrue(nodeOut.parent === this);
		let index = nodeOut.siblingIndex;
		this.ensureChildNodes().splice(index, 1);
		this.reindexChildren(index);
		nodeOut.parent = null;
	}

	addChildren(children: Node[], index?: number) {
		children = Assert.notNull(children);

		// break if children empty
		if (children.length === 0) return;
		// index === undefined
		else if (index === undefined) {
			//most used. short circuit addChildren(int),
			// which hits reindex children and array copy
			let nodes = this.ensureChildNodes();
			for (let child of children) {
				this.reparentChild(child);
				nodes.push(child);
				child.siblingIndex = nodes.length - 1;
			}
		}

		// index !== undefined
		else {
			let nodes = this.ensureChildNodes();

			// fast path - if used as a wrap (index=0, children = child[0].parent.children - do inplace
			let firstParent = children[0].parent;
			if (firstParent !== null && firstParent.childNodeSize() === children.length) {
				let sameList = true;
				let firstParentNodes = firstParent.ensureChildNodes();

				let i = children.length;
				while (i-- > 0) {
					if (children[i] !== firstParentNodes[i]) {
						sameList = false;
						break;
					}
				}

				// moving, so OK to empty firstParent and short-circuit
				if (sameList) {
					firstParent.empty();
					nodes.splice(index, 0, ...children);
					i = children.length;
					while (i-- > 0) children[i].parent = this;
					this.reindexChildren(index);
					return;
				}
			}

			Assert.noNullElements(children);
			for (let child of children) this.reparentChild(child);
			nodes.splice(index, 0, ...children);
			this.reindexChildren(index);
		}
	}

	protected reparentChild(child: Node) {
		child.setParentNode(this);
	}

	protected reindexChildren(start: number) {
		let nodes: Node[] = this.ensureChildNodes();
		for (let i = 0; i < nodes.length; i++) {
			nodes[i].siblingIndex = i;
		}
	}

	/**
	 * Retrieves this node's sibling nodes.
	 * @return node siblings. If the node has no parent, returns an empty list.
	 */
	siblingNodes(): Node[] {
		if (this.parent === null) return [];
		let nodes = this.parent?.ensureChildNodes();
		return nodes.filter((node) => node !== this);
	}

	/**
	 * Get this node's next sibling.
	 * @return next sibling, or @{code null} if this is the last sibling
	 */
	nextSibling(): Node | null {
		if (this.parent !== null) {
			let siblings = this.parent.ensureChildNodes();
			let index = this.siblingIndex + 1;
			if (siblings.length > index) return siblings[index];
		}
		return null;
	}

	/**
	 * Get this node's previous sibling.
	 * @return the previous sibling, or @{code null} if this is the first sibling
	 */
	prevSibling(): Node | null {
		if (this.parent !== null && this.siblingIndex > 0) {
			return this.parent.ensureChildNodes()[this.siblingIndex - 1];
		} else return null;
	}

	/**
	 * Perform a depth-first traversal through this node and its descendants.
	 * @param visitor the visitor callbacks to perform on each node
	 * @return this node, for chaining
	 */
	traverse(visitor: NodeVisitor): this {
		Assert.notNull(visitor);
		NodeTraversor.traverse(visitor, this);
		return this;
	}

	/**
	 * Perform a depth-first filtering through this node and its descendants.
	 * @param filter the filter callbacks to perform on each node
	 * @return this node, for chaining
	 */
	filter(filter: NodeFilter): this {
		Assert.notNull(filter);
		NodeTraversor.filter(filter, this);
		return this;
	}

	/**
     Get the outer HTML of this node. For example, on a {@code p} element, may return {@code <p>Para</p>}.
     @return outer HTML
     @see Element#html()
     @see Element#text()
     */
	outerHtml(): string {
		let accum = new StringBuilder();
		this.outerHtmlImpl(accum);
		return accum.toString();
	}

	protected outerHtmlImpl(accum: StringBuilder): void {
		let setting = NodeUtils.outputSettings(this);
		NodeTraversor.traverse(new OuterHtmlVisitor(accum, setting), this);
	}

	/**
	 * Create a stand-alone, deep copy of this node, and all of its children. The cloned node will have no siblings or
	 * parent node. As a stand-alone object, any changes made to the clone or any of its children will not impact the
	 * original node.
	 * <p>
	 * The cloned node may be adopted into another Document or node structure using {@link Element#appendChild(Node)}.
	 * @return a stand-alone cloned node, including clones of any children
	 * @see #shallowClone()
	 */
	clone(): this {
		let thisClone = this.shallowClone();

		// Queue up nodes that need their children cloned (BFS).
		let nodesToProcess: Node[] = [thisClone];
		while (nodesToProcess.length > 0) {
			let currParent = nodesToProcess.pop();
			let length = currParent?.childNodeSize() || 0;
			for (let i = 0; i < length; i++) {
				let childNodes = currParent?.ensureChildNodes() || [];
				let childClone = childNodes[i].doClone(currParent);
				childNodes[i] = childClone;
				nodesToProcess.push(childClone);
			}
		}

		return thisClone;
	}

	/**
	 * Create a stand-alone, shallow copy of this node. None of its children (if any) will be cloned, and it will have
	 * no parent or sibling nodes.
	 * @return a single independent copy of this node
	 * @see #clone()
	 */
	shallowClone(): this {
		return this.doClone();
	}

	/*
	 * Return a clone of the node using the given parent (which can be null).
	 * Not a deep copy of children.
	 */
	protected doClone(parent?: Node) {
		let clone = Object.create(this);
		clone.parentNode = parent; // can be null, to create an orphan split
		clone.siblingIndex = parent == null ? 0 : this.siblingIndex;
		return clone;
	}

	protected indent(accum: StringBuilder, depth: number, setting: OutputSetting) {
		accum.append('\n').append(Helper.padding(depth * setting.indentAmount));
	}

	equals(object: any): boolean {
		return Helper.equals(this, object);
	}

	/**
	 * outerHtmlHead
	 * @param accum
	 * @param depth
	 * @param setting
	 */
	abstract outerHtmlHead(accum: StringBuilder, depth: number, setting: OutputSetting): void;

	/**
	 * outerHtmlTail
	 * @param accum
	 * @param depth
	 * @param setting
	 */
	abstract outerHtmlTail(accum: StringBuilder, depth: number, setting: OutputSetting): void;
}