import { Parser } from '../parse/Parser';
import { Assert } from '../helper/Assert';
import { Helper } from '../helper/Helper';
import { Tag } from '../parse/Tag';
import { Attributes } from './Attributes';
import { Elements } from './Elements';
import { Node } from './Node';
import { TextNode } from './TextNode';
import { DataNode } from './DataNode';
import { Selector } from '../select/Selector';
import { Collector } from '../select/Collector';
import { QueryParser } from '../select/QueryParser';
import { Normalizer } from '../helper/Normalizer';
import { Evaluator } from '../select/Evaluator';
import { StringBuilder } from '../helper/StringBuilder';
import * as EvalHelp from '../select/Evaluator';
import { NodeUtils } from '../helper/NodeUtils';
import { OutputSetting } from '../parse/Setting';

class WeakReference<T> {
	constructor(private value?: T) {}
	get(): T {
		return this.value;
	}
}

/**
 * A HTML element consists of a tag name, attributes,
 * and child nodes (including text nodes and other elements).
 *
 * From an Element, you can extract data, traverse the node graph,
 * and manipulate the HTML.
 */
export class Element extends Node {
	html(html?: string): any {
		throw new Error('Method not implemented.');
	}
	hasText(): unknown {
		throw new Error('Method not implemented.');
	}
	val(val?: any): any {
		throw new Error('Method not implemented.');
	}
	hasClass(className: string): boolean {
		throw new Error('Method not implemented.');
	}
	toggleClass(className: string): void {
		throw new Error('Method not implemented.');
	}
	removeClass(className: string): void {
		throw new Error('Method not implemented.');
	}
	addClass(className: string): void {
		throw new Error('Method not implemented.');
	}
	isFormList(): boolean {
		throw new Error('Method not implemented.');
	}
	static readonly BaseUriKey = Attributes.internalKey('baseUri');

	private tag: Tag;
	private _childNodes: Node[];
	private attributes: Attributes;
	private shadowChildrenRef: WeakReference<Element[]>;
	public outputSetting: OutputSetting = new OutputSetting();

	/**
	 * Create a new, standalone element.
	 * @param {string} tag tag name
	 */
	constructor(tagName: string);

	/**
	 * Create a new, standalone element.
	 * @param {Tag} tag tag of this element
	 */
	constructor(tag: Tag);

	/**
	 * Create a new, standalone Element. (Standalone in that is has no parent.)
	 *
	 * @param tag tag of this element
	 * @param baseUri the base URI
	 */
	constructor(tag: Tag, baseUri: string);

	/**
	 * Create a new, standalone Element. (Standalone in that is has no parent.)
	 *
	 * @param tag tag of this element
	 * @param baseUri the base URI (optional, may be null to inherit from parent, or "" to clear parent's)
	 * @param attributes initial attributes (optional, may be null)
	 * @see #appendChild(Node)
	 * @see #appendElement(String)
	 */
	constructor(tag: Tag, baseUri: string, attributes: Attributes);

	/**
	 * @private
	 */
	constructor(tag: Tag | string, baseUri?: string, attributes?: Attributes) {
		super();

		let tagObj = typeof tag === 'string' ? Tag.valueOf(tag) : tag;
		this.tag = <any>Assert.notNull(tagObj);

		this.childNodes = [];
		this.attributes = attributes || new Attributes();

		// set base uri if not null
		if (Helper.notNull(baseUri)) {
			this.setBaseUri(baseUri);
		}
	}

	/**
	 * Internal test to check if a nodelist object has been created.
	 * @return {boolean}
	 */
	protected hasChildNodes(): boolean {
		return !Helper.isEmpty(this.childNodes);
	}

	ensureChildNodes(): Node[] {
		return this.childNodes;
	}

	hasAttributes(): boolean {
		return Helper.notNull(this.attributes);
	}

	get parentNode(): Element {
		return <any>super._parent;
	}

	get_attributes(): Attributes {
		return this.attributes;
	}

	baseUri(): string {
		return Element.searchUpForAttribute(this, Element.BaseUriKey);
	}

	protected doSetBaseUri(baseUri: string): void {
		this.get_attributes().put(Element.BaseUriKey, baseUri);
	}

	childNodeSize(): number {
		return this.childNodes.length;
	}

	nodeName(): string {
		return this.tag.tagName;
	}

	/**
	 * Get the name of the tag for this element
	 * @return the tag name
	 */
	tagName(): string;

	/**
	 * Change (rename) the tag of this element.
	 * @param tagName new tag name for this element
	 * @return this element, for chaining
	 */
	tagName(name: string): this;

	/** @private */
	tagName(name?: string): any {
		if (name === undefined) return this.tag.tagName;
		else {
			Assert.notEmpty(name, 'Tag name must not be empty.');
			let setting = Parser.getParserForNode(this).setting();
			this.tag = Tag.valueOf(name, setting);
			return this;
		}
	}

	/**
	 * Get the Tag for this element.
	 * @return the tag object
	 */
	get_tag(): Tag {
		return this.tag;
	}

	/**
	 * Get the normalized name of this Element's tag.
	 * @return normal name
	 */
	normalName(): string {
		return this.tag.normalName;
	}

	/**
	 * searchUpForAttribute
	 * @param start
	 * @param key
	 */
	private static searchUpForAttribute(start: Element, key: string): string {
		let el = start;
		while (el !== null) {
			let attrs = el.get_attributes();
			let hasKey = attrs !== null && attrs.hasKey(key);
			if (hasKey) return attrs.get(key).get_val();
			else el = el.parentNode;
		}
		return '';
	}

	/**
	 * Test if this element is a block-level element.
	 * @return true if block, false if not (and thus inline)
	 */
	isBlock(): boolean {
		return this.tag.isBlock;
	}

	/**
	 * Get the {@code id} attribute of this element.
	 * @return The id attribute, if present, or an empty string if not.
	 */
	id(): string;

	/**
	 * Set the {@code id} attribute of this element.
	 * @param id the ID value to use
	 * @return this Element, for chaining
	 * */
	id(id: string): this;

	/** @private */
	id(id?: string): any {
		if (id === undefined) return this.attributes.getIgnoreCase('id');
		else {
			Assert.notNull(id);
			this.attr('id', id);
			return this;
		}
	}

	/**
	 * Get this element's HTML5 custom data attributes.
	 * @return a map of {@code key=value} custom data attributes.
	 */
	dataset(): Record<string, string> {
		return this.get_attributes().dataset();
	}

	/**
	 * Get this element's parent and ancestors, up to the document root.
	 * @return this element's stack of parents, closest first.
	 */
	parents(): Elements {
		let parents = new Elements();
		Element.accumulateParents(this, parents);
		return parents;
	}

	static accumulateParents(el: Element, parents: Elements) {
		let parent = el.parentNode;
		if (Helper.notNull(parent) && parent.tagName() !== '#root') {
			parents.push(parent);
			this.accumulateParents(parent, parents);
		}
	}

	/**
	 * Get a child element of this element, by its 0-based index number.
	 * <p>
	 * Note that an element can have both mixed Nodes and Elements as children. This method inspects
	 * a filtered list of children that are elements, and the index is based on that filtered list.
	 * </p>
	 *
	 * @param index the index number of the element to retrieve
	 * @return the child element, if it exists, otherwise throws an {@code IndexOutOfBoundsException}
	 * @see #childNode(int)
	 */
	child(index: number): Element {
		return this.childElementsList()[index];
	}

	/**
	 * Get the number of child nodes of this element that are elements.
	 * <p>
	 * This method works on the same filtered list like {@link #child(int)}. Use {@link #childNodes()} and {@link
	 * #childNodeSize()} to get the unfiltered Nodes (e.g. includes TextNodes etc.)
	 * </p>
	 *
	 * @return the number of child nodes that are elements
	 * @see #children()
	 * @see #child(int)
	 */
	childrenSize(): number {
		return this.childElementsList().length;
	}

	/**
	 * Get this element's child elements.
	 * <p>
	 * This is effectively a filter on {@link #childNodes()} to get Element nodes.
	 * </p>
	 * @return child elements. If this element has no children, returns an empty list.
	 * @see #childNodes()
	 */
	children(): Elements {
		return new Elements(this.childElementsList());
	}

	/**
	 * Maintains a shadow copy of this element's child elements. If the nodelist is changed, this cache is invalidated.
	 * TODO - think about pulling this out as a helper as there are other shadow lists (like in Attributes) kept around.
	 * @return a list of child elements
	 */
	private childElementsList(): Element[] {
		if (this.childNodeSize() === 0) return [];
		else {
			let children: Element[] = this.shadowChildrenRef?.get() || null;
			let isRefNoNull = Helper.notNull(this.shadowChildrenRef);
			if (isRefNoNull && children !== null) return children;
			else {
				children = <any>this.childNodes.filter((el) => NodeUtils.isElement(el));
				this.shadowChildrenRef = new WeakReference(children);
				return children;
			}
		}
	}

	/**
	 * Clears the cached shadow child elements.
	 */
	nodelistChanged(): void {
		super.nodelistChanged();
		this.shadowChildrenRef = null;
	}

	/**
	 * Get this element's child text nodes. The list is unmodifiable but the text nodes may be manipulated.
	 * <p>
	 * This is effectively a filter on {@link #childNodes()} to get Text nodes.
	 * @return child text nodes. If this element has no text nodes, returns an
	 * empty list.
	 * </p>
	 * For example, with the input HTML: {@code <p>One <span>Two</span> Three <br> Four</p>} with the {@code p} element selected:
	 * <ul>
	 *     <li>{@code p.text()} = {@code "One Two Three Four"}</li>
	 *     <li>{@code p.ownText()} = {@code "One Three Four"}</li>
	 *     <li>{@code p.children()} = {@code Elements[<span>, <br>]}</li>
	 *     <li>{@code p.childNodes()} = {@code List<Node>["One ", <span>, " Three ", <br>, " Four"]}</li>
	 *     <li>{@code p.textNodes()} = {@code List<TextNode>["One ", " Three ", " Four"]}</li>
	 * </ul>
	 */
	textNodes(): TextNode[] {
		return [...(<any>this.childNodes.filter((node) => NodeUtils.isTextNode(node)))];
	}

	/**
	 * Get this element's child data nodes. The list is unmodifiable but the data nodes may be manipulated.
	 * <p>
	 * This is effectively a filter on {@link #childNodes()} to get Data nodes.
	 * </p>
	 * @return child data nodes. If this element has no data nodes, returns an
	 * empty list.
	 * @see #data()
	 */
	dataNodes(): DataNode[] {
		return [...(<any>this.childNodes.filter((node) => NodeUtils.isDataNode(node)))];
	}

	/**
	 * Find elements that match the {@link Selector} CSS query, with this element as the starting context. Matched elements
	 * may include this element, or any of its children.
	 * <p>This method is generally more powerful to use than the DOM-type {@code getElementBy*} methods, because
	 * multiple filters can be combined, e.g.:</p>
	 * <ul>
	 * <li>{@code el.select("a[href]")} - finds links ({@code a} tags with {@code href} attributes)
	 * <li>{@code el.select("a[href*=example.com]")} - finds links pointing to example.com (loosely)
	 * </ul>
	 * <p>See the query syntax documentation in {@link org.jsoup.select.Selector}.</p>
	 * <p>Also known as {@code querySelectorAll()} in the Web DOM.</p>
	 *
	 * @param cssQuery a {@link Selector} CSS-like query
	 * @return an {@link Elements} list containing elements that match the query (empty if none match)
	 * @see Selector selector query syntax
	 * @see QueryParser#parse(String)
	 * @throws Selector.SelectorParseException (unchecked) on an invalid CSS query.
	 */
	select(cssQuery: string): Elements;

	/**
	 * Find elements that match the supplied Evaluator.
	 * @param evaluator an element evaluator
	 * @return an {@link Elements}
	 */
	select(evaluator: Evaluator): Elements;

	/** @private */
	select(object: string | Evaluator): Elements {
		return Selector.select(<any>object, this);
	}

	/**
	 * Find the first Element that matches the {@link Selector} CSS query
	 * @param cssQuery cssQuery a {@link Selector} CSS-like query
	 * @return the first matching element, or <b>{@code null}</b> if there is no match.
	 */
	selectFirst(cssQuery: string): Element;

	/**
	 * Finds the first Element that matches the supplied Evaluator
	 * @param evaluator an element evaluator
	 * @return the first matching element
	 */
	selectFirst(evaluator: Evaluator): Element;

	/** @private */
	selectFirst(object: string | Evaluator): Element {
		let isCssQuery = typeof object === 'string';
		if (isCssQuery) return Selector.selectFirst(object, this);
		else Collector.findFirst(<any>object, this);
	}

	/**
	 * Checks if this element matches the given {@link Selector} CSS query.
	 * @param cssQuery a {@link Selector} CSS query
	 * @return if this element matches the query
	 */
	is(cssQuery: string): boolean;

	/**
	 * Check if this element matches the given evaluator.
	 * @param evaluator an element evaluator
	 * @return if this element matches
	 */
	is(evaluator: Evaluator): boolean;

	/** @private */
	is(object: string | Evaluator): boolean {
		let evaluator: Evaluator = typeof object === 'string' ? QueryParser.parse(<any>object) : object;
		return evaluator.matches(this.root(), this);
	}
	root(): Element {
		throw new Error('Method not implemented.');
	}

	/**
	 * Find the closest element up the tree of parents that matches the specified CSS query. Will return itself, an
	 * ancestor, or {@code null} if there is no such matching element.
	 * @param cssQuery a {@link Selector} CSS query
	 * @return the closest ancestor element (possibly itself) that matches the provided evaluator. {@code null} if not
	 * found.
	 */
	closest(cssQuery: string): Element;

	/**
	 * Find the closest element up the tree of parents that matches the specified evaluator. Will return itself, an
	 * ancestor, or {@code null} if there is no such matching element.
	 * @param evaluator a query evaluator
	 * @return the closest ancestor element (possibly itself) that matches the provided evaluator. {@code null} if not
	 * found.
	 */
	closest(evaluator: Evaluator): Element;

	/** @private */
	closest(object: string | Evaluator): Element {
		let evaluator = Assert.notNull(typeof object === 'string' ? QueryParser.parse(object) : object);

		let el: Element = this;
		let root = this.root();
		do {
			let isMatch = evaluator.matches(root, el);
			if (isMatch) return el;
			else el = el.parentNode;
		} while (el != null);

		//
		return null;
	}

	/**
	 * Insert a node to the end of this Element's children. The incoming node will be re-parented.
	 *
	 * @param child node to add.
	 * @return this Element, for chaining
	 * @see #prependChild(Node)
	 * @see #insertChildren(int, Collection)
	 */
	appendChild(child: Node): this {
		Assert.notNull(child);
		this.reparentChild(child);
		this.ensureChildNodes();
		this.childNodes.push(child);
		child.setSiblingIndex(this.childNodes.length - 1);
		return this;
	}

	/**
	 * Insert the given nodes to the end of this Element's children.
	 * @param children nodes to add
	 * @return this Element, for chaining
	 * @see #insertChildren(int, Collection)
	 */
	appendChildren(children: Node[]): this {
		this.insertChildren(children, -1);
		return this;
	}

	/**
	 * Add this element to the supplied parent element, as its next child.
	 *
	 * @param parent element to which this element will be appended
	 * @return this element, so that you can continue modifying the element
	 */
	appendTo(parent: Element): this {
		Assert.notNull(parent);
		parent.appendChild(this);
		return this;
	}

	/**
	 * Add a node to the start of this element's children.
	 *
	 * @param child node to add.
	 * @return this element, so that you can add more child nodes or elements.
	 */
	prependChild(child: Node): this {
		Assert.notNull(child);
		this.addChildren([child], 0);
		return this;
	}

	/**
	 * Insert the given nodes to the start of this Element's children
	 * @param children nodes to add
	 * @return this Element, for chaining
	 * @see #insertChildren(int, Collection)
	 * */
	prependChildren(children: Node[]): this {
		this.insertChildren(children, 0);
		return this;
	}

	/**
	 * Inserts the given child nodes into this element at the specified index. Current nodes will be shifted to the
	 * right. The inserted nodes will be moved from their current parent. To prevent moving, copy the nodes first.
	 * @param children child nodes to insert
	 * @param index 0-based index to insert children at. Specify {@code 0} to insert at the start, {@code -1} at the end
	 * @return this element, for chaining.
	 */
	insertChildren(children: Node[], index: number) {
		Assert.notNull(children, 'Children collection to be inserted must not be null.');
		let currentSize = this.childNodeSize();

		if (index < 0) index += currentSize + 1; // roll around
		Assert.isTrue(index >= 0 && index <= currentSize, 'Insert position out of bounds.');

		this.addChildren(children, index);
		return this;
	}

	/**
	 * Create a new element by tag name, and add it as the last child.
	 *
	 * @param tagName the name of the tag (e.g. {@code div}).
	 * @return the new element, to allow you to add content to it, e.g.:
	 *  {@code parent.appendElement("h1").attr("id", "header").text("Welcome");}
	 */
	appendElement(tagName: string): Element {
		let setting = Parser.getParserForNode(this).setting();
		let tag = Tag.valueOf(tagName, setting);
		let child = new Element(tag, this.baseUri());
		this.appendChild(child);
		return child;
	}

	/**
	 * Create a new element by tag name, and add it as the first child.
	 *
	 * @param tagName the name of the tag (e.g. {@code div}).
	 * @return the new element, to allow you to add content to it, e.g.:
	 *  {@code parent.prependElement("h1").attr("id", "header").text("Welcome");}
	 */
	prependElement(tagName: string): Element {
		let setting = Parser.getParserForNode(this).setting();
		let tag = Tag.valueOf(tagName, setting);
		let child = new Element(tag, this.baseUri());
		this.prependChild(child);
		return child;
	}

	/**
	 * Create and append a new TextNode to this element.
	 *
	 * @param text the unencoded text to add
	 * @return this element
	 */
	appendText(text: string): this {
		Assert.notNull(text);
		let node = new TextNode(text);
		this.appendChild(node);
		return this;
	}

	/**
	 * Create and prepend a new TextNode to this element.
	 *
	 * @param text the unencoded text to add
	 * @return this element
	 */
	prependText(text: string): this {
		Assert.notNull(text);
		let node = new TextNode(text);
		this.prependChild(node);
		return this;
	}

	/**
	 * Add inner HTML to this element. The supplied HTML will be parsed, and each node appended to the end of the children.
	 * @param html HTML to add inside this element, after the existing HTML
	 * @return this element
	 * @see #html(String)
	 */
	append(html: string): this {
		Assert.notNull(html);
		let parser = Parser.getParserForNode(this);
		let nodes = parser.parseFragment(html, this, this.baseUri());
		this.addChildren(nodes);
		return this;
	}

	/**
	 * Add inner HTML into this element. The supplied HTML will be parsed, and each node prepended to the start of the element's children.
	 * @param html HTML to add inside this element, before the existing HTML
	 * @return this element
	 * @see #html(String)
	 */
	prepend(html: string): this {
		Assert.notNull(html);
		let parser = Parser.getParserForNode(this);
		let nodes = parser.parseFragment(html, this, this.baseUri());
		this.addChildren(nodes, 0);
		return this;
	}

	/**
	 * Remove all of the element's child nodes. Any attributes are left as-is.
	 * @return this element
	 */
	empty(): this {
		this.childNodes.splice(0, this.childNodes.length);
		return this;
	}

	/**
	 * Get a CSS selector that will uniquely select this element.
	 * <p>
	 * If the element has an ID, returns #id;
	 * otherwise returns the parent (if any) CSS selector, followed by {@literal '>'},
	 * followed by a unique selector for the element (tag.class.class:nth-child(n)).
	 * </p>
	 *
	 * @return the CSS Path that can be used to retrieve the element in a selector.
	 */
	cssSelector(): string {
		// prefer to return the ID - but check that it's actually unique first!
		if (this.id().length > 0) {
			let idSel = `#${this.id()}`;
			let doc = this.ownerDocument();
			if (Helper.notNull(doc)) {
				let els = doc.select(idSel);
				if (els.length === 1 && els.get(0) === this) return idSel;
			} else return idSel;
		}

		// Translate HTML namespace ns:tag to CSS namespace syntax ns|tag
		//let tagName = this.tagName().replace(':', '|');
		let classes = this.classNames().join('.');
		let selector = this.tagName().replace(':', '|');

		//
		if (classes.length > 0) {
			selector += `.${classes}`;
		}

		// parent null or is document
		let parent = this.parentNode;
		if (Helper.isNull(parent) || NodeUtils.isDocument(parent)) {
			return selector;
		}

		//
		selector = ` > ${selector}`;
		if (parent.select(selector).length > 1) {
			selector += `:nth-child(${this.elementSiblingIndex() + 1})`;
		}

		return parent.cssSelector() + selector;
	}

	/**
	 * Get sibling elements. If the element has no sibling elements, returns an empty list. An element is not a sibling
	 * of itself, so will not be included in the returned list.
	 * @return sibling elements
	 */
	siblingElements(): Elements {
		if (Helper.isNull(this.parentNode)) return new Elements();
		else {
			let elements = this.parentNode.childElementsList().filter((el) => el !== this);
			return new Elements(elements);
		}
	}

	/**
	 * Gets the next sibling element of this element. E.g., if a {@code div} contains two {@code p}s,
	 * the {@code nextElementSibling} of the first {@code p} is the second {@code p}.
	 * <p>
	 * This is similar to {@link #nextSibling()}, but specifically finds only Elements
	 * </p>
	 * @return the next element, or null if there is no next element
	 * @see #previousElementSibling()
	 */
	nextElementSibling(): Element {
		if (Helper.isNull(this.parentNode)) return null;
		else {
			let siblings = this.parentNode.childElementsList();
			let index = this.indexInList(this, siblings);
			return siblings.length > index + 1 ? siblings[index + 1] : null;
		}
	}

	/**
	 * Get each of the sibling elements that come after this element.
	 * @return each of the element siblings after this element, or an empty list if there are no next sibling elements
	 */
	nextElementSiblings(): Elements {
		return this.nextElementSiblingsImpl(true);
	}

	/**
	 * Gets the previous element sibling of this element.
	 * @return the previous element, or null if there is no previous element
	 * @see #nextElementSibling()
	 */
	previousElementSibling(): Element {
		if (Helper.isNull(this.parentNode)) return null;
		else {
			let siblings = this.parentNode.childElementsList();
			let index = this.indexInList(this, siblings);
			return index > 0 ? siblings[index - 1] : null;
		}
	}

	/**
	 * Get each of the element siblings before this element.
	 *
	 * @return the previous element siblings, or an empty list if there are none.
	 */
	previousElementSiblings(): Elements {
		return this.nextElementSiblingsImpl(false);
	}

	private nextElementSiblingsImpl(next: boolean) {
		let els = new Elements();
		if (Helper.isNull(this.parentNode)) return els;
		else {
			els.push(this);
			return next ? els.nextAll() : els.prevAll();
		}
	}

	/**
	 * Gets the first Element sibling of this element. That may be this element.
	 * @return the first sibling that is an element (aka the parent's first element child)
	 */
	firstElementSibling(): Element {
		let parent = this.parentNode;
		if (Helper.isNull(parent)) return this;
		else {
			let siblings = parent.childElementsList();
			return siblings.length > 1 ? siblings[0] : this;
		}
	}

	/**
	 * Get the list index of this element in its element sibling list. I.e. if this is the first element
	 * sibling, returns 0.
	 * @return position in element sibling list
	 */
	elementSiblingIndex(): number {
		let parent = this.parentNode;
		if (Helper.isNull(parent)) return 0;
		return this.indexInList(this, parent.childElementsList());
	}

	/**
	 * Gets the last element sibling of this element. That may be this element.
	 * @return the last sibling that is an element (aka the parent's last element child)
	 */
	lastElementSibling(): Element {
		let parent = this.parentNode;
		if (Helper.isNull(parent)) return this;
		else {
			let siblings = parent.childElementsList();
			return siblings.length > 1 ? siblings[siblings.length - 1] : this;
		}
	}

	private indexInList<E extends Element>(search: Element, elements: E[]): number {
		let index = elements.findIndex((el) => el === search);
		return Math.max(index, 0);
	}

	// DOM type methods

	//
	/**
	 * Finds elements, including and recursively under this element, with the specified tag name.
	 * @param tagName The tag name to search for (case insensitively).
	 * @return a matching unmodifiable list of elements. Will be empty if this element and none of its children match.
	 */
	getElementsByTag(tagName: string): Elements {
		Assert.notEmpty(tagName);
		tagName = Normalizer.normalize(tagName);
		return Collector.collect(new EvalHelp.TagEval(tagName), this);
	}

	/**
	 * Find an element by ID, including or under this element.
	 * <p>
	 * Note that this finds the first matching ID, starting with this element. If you search down from a different
	 * starting point, it is possible to find a different element by ID. For unique element by ID within a Document,
	 * use {@link Document#getElementById(String)}
	 * @param id The ID to search for.
	 * @return The first matching element by ID, starting with this element, or null if none found.
	 */
	getElementById(id: string): Element {
		Assert.notEmpty(id);
		let elements = Collector.collect(new EvalHelp.IdEval(id), this);
		return elements.length > 0 ? elements[0] : null;
	}

	/**
	 * Find elements that have this class, including or under this element. Case insensitive.
	 * <p>
	 * Elements can have multiple classes (e.g. {@code <div class="header round first">}. This method
	 * checks each class, so you can find the above with {@code el.getElementsByClass("header");}.
	 *
	 * @param className the name of the class to search for.
	 * @return elements with the supplied class name, empty if none
	 * @see #hasClass(String)
	 * @see #classNames()
	 */
	getElementsByClass(className: string): Elements {
		Assert.notEmpty(className);
		return Collector.collect(new EvalHelp.ClassEval(className), this);
	}

	/**
	 * Find elements that have a named attribute set. Case insensitive.
	 *
	 * @param key name of the attribute, e.g. {@code href}
	 * @return elements that have this attribute, empty if none
	 */
	getElementsByAttribute(key: string): Elements {
		key = Assert.notEmpty(key).trim();
		return Collector.collect(new EvalHelp.AttributeEval(key), this);
	}

	/**
	 * Find elements that have an attribute name starting with the supplied prefix. Use {@code data-} to find elements
	 * that have HTML5 datasets.
	 * @param keyPrefix name prefix of the attribute e.g. {@code data-}
	 * @return elements that have attribute names that start with with the prefix, empty if none.
	 */
	getElementsByAttributeStarting(keyPrefix: string): Elements {
		keyPrefix = Assert.notEmpty(keyPrefix).trim();
		return Collector.collect(new EvalHelp.AttributeStartingEval(keyPrefix), this);
	}

	/**
	 * Find elements that have an attribute with the specific value. Case insensitive.
	 *
	 * @param key name of the attribute
	 * @param value value of the attribute
	 * @return elements that have this attribute with this value, empty if none
	 */
	getElementsByAttributeValue(key: string, value: string): Elements {
		return Collector.collect(new EvalHelp.AttributeWithValueEval(key, value), this);
	}

	/**
	 * Find elements that either do not have this attribute, or have it with a different value. Case insensitive.
	 *
	 * @param key name of the attribute
	 * @param value value of the attribute
	 * @return elements that do not have a matching attribute
	 */
	getElementsByAttributeValueNot(key: string, value: string): Elements {
		return Collector.collect(new EvalHelp.AttributeWithValueNotEval(key, value), this);
	}

	/**
	 * Find elements that have attributes that start with the value prefix. Case insensitive.
	 *
	 * @param key name of the attribute
	 * @param valuePrefix start of attribute value
	 * @return elements that have attributes that start with the value prefix
	 */
	getElementsByAttributeValueStarting(key: string, value: string): Elements {
		return Collector.collect(new EvalHelp.AttributeWithValueStartingEval(key, value), this);
	}

	/**
	 * Find elements that have attributes that end with the value suffix. Case insensitive.
	 *
	 * @param key name of the attribute
	 * @param valueSuffix end of the attribute value
	 * @return elements that have attributes that end with the value suffix
	 */
	getElementsByAttributeValueEnding(key: string, valueSuffix: string): Elements {
		return Collector.collect(new EvalHelp.AttributeWithValueEndingEval(key, valueSuffix), this);
	}

	/**
	 * Find elements that have attributes whose value contains the match string. Case insensitive.
	 *
	 * @param key name of the attribute
	 * @param match substring of value to search for
	 * @return elements that have attributes containing this text
	 */
	getElementsByAttributeValueContaining(key: string, match: string): Elements {
		return Collector.collect(new EvalHelp.AttributeWithValueContainingEval(key, match), this);
	}

	/**
	 * Find elements that have attributes whose values match the supplied regular expression.
	 * @param key name of the attribute
	 * @param pattern compiled regular expression to match against attribute values
	 * @return elements that have attributes matching this regular expression
	 */
	getElementsByAttributeValueMatching(key: string, pattern: string | RegExp): Elements {
		return Collector.collect(new EvalHelp.AttributeWithValueMatchingEval(key, pattern), this);
	}

	/**
	 * Find elements whose sibling index is less than the supplied index.
	 * @param index 0-based index
	 * @return elements less than index
	 */
	getElementsByIndexLessThan(index: number): Elements {
		return Collector.collect(new EvalHelp.IndexLessThanEval(index), this);
	}

	/**
	 * Find elements whose sibling index is greater than the supplied index.
	 * @param index 0-based index
	 * @return elements greater than index
	 */
	getElementsByIndexGreaterThan(index: number): Elements {
		return Collector.collect(new EvalHelp.IndexGreaterThanVal(index), this);
	}

	/**
	 * Find elements whose sibling index is equal to the supplied index.
	 * @param index 0-based index
	 * @return elements equal to index
	 */
	getElementsByIndexEquals(index: number): Elements {
		return Collector.collect(new EvalHelp.IndexEqualEval(index), this);
	}

	/**
	 * Find elements that contain the specified string. The search is case insensitive. The text may appear directly
	 * in the element, or in any of its descendants.
	 * @param searchText to look for in the element's text
	 * @return elements that contain the string, case insensitive.
	 * @see Element#text()
	 */
	getElementsContainingText(searchText: string) {
		return Collector.collect(new EvalHelp.ContainsTextEval(searchText), this);
	}

	/**
	 * Find elements that directly contain the specified string. The search is case insensitive. The text must appear directly
	 * in the element, not in any of its descendants.
	 * @param searchText to look for in the element's own text
	 * @return elements that contain the string, case insensitive.
	 * @see Element#ownText()
	 */
	getElementsContainingOwnText(searchText: string): Elements {
		return Collector.collect(new EvalHelp.ContainsOwnTextEval(searchText), this);
	}

	/**
	 * Find elements whose text matches the supplied regular expression.
	 * @param pattern regular expression to match text against
	 * @return elements matching the supplied regular expression.
	 * @see Element#text()
	 */
	getElementsMatchingText(pattern: string | RegExp): Elements {
		return Collector.collect(new EvalHelp.MatchesEval(pattern), this);
	}

	/**
	 * Find elements whose own text matches the supplied regular expression.
	 * @param pattern regular expression to match text against
	 * @return elements matching the supplied regular expression.
	 * @see Element#ownText()
	 */
	getElementsMatchingOwnText(pattern: string | RegExp): Elements {
		return Collector.collect(new EvalHelp.MatchesOwnEval(pattern), this);
	}

	/**
	 * Find all elements under this element (including self, and children of children).
	 *
	 * @return all elements
	 */
	getAllElements() {
		return Collector.collect(new EvalHelp.AnyEval(), this);
	}

	/**
	 * Gets the literal value of this element's "class" attribute
	 * @return The literal class attribute, or <b>empty string</b> if no class attribute set.
	 */
	className(): string {
		return this.attr('class').trim();
	}

	/**
	 * Get all of the element's class names.
	 * @return set of classnames, empty if no class attribute
	 */
	classNames(): string[];

	/**
	 * Set the element's {@code class} attribute to the supplied class names.
	 * @param classNames set of classes
	 * @return this element, for chaining
	 */
	classNames(classNames: string[]): this;

	/** @private */
	classNames(classNames?: string[]): any {
		// get classes
		if (classNames === undefined) {
			let classes = this.className().split(/\s+/);
			return [...new Set(classes).values()];
		}

		// set classes
		else {
			Assert.notNull(classNames);
			if (classNames.length === 0) this.get_attributes().remove('class');
			else this.get_attributes().put('class', [...new Set(classNames).values()].join(' '));
			return this;
		}
	}

	/**
	 * Gets the <b>normalized, combined text</b> of this element and all its children. Whitespace is normalized and trimmed.
	 * <p>For example, given HTML {@code <p>Hello  <b>there</b> now! </p>}, {@code p.text()} returns {@code "Hello there now!"}
	 * <p>If you do not want normalized text, use {@link #wholeText()}. If you want just the text of this node (and not children), use {@link #ownText()}
	 * <p>Note that this method returns the textual content that would be presented to a reader. The contents of data nodes (such as {@code <script>} tags are not considered text. Use {@link #data()} or {@link #html()} to retrieve that content.
	 * @return unencoded, normalized text, or empty string if none.
	 * @see #wholeText()
	 * @see #ownText()
	 * @see #textNodes()
	 * */
	text(): string {
		//let visitor = new ElementTextVisitor();
		//NodeTraversor.traverse(visitor, this);
		//return visitor.text();
		throw new Error('method not support');
	}

	/**
	 * Get the (unencoded) text of all children of this element, including any newlines and spaces present in the
	 * original.
	 *
	 * @return unencoded, un-normalized text
	 * @see #text()
	 */
	wholeText(): string {
		throw new Error('method not support');
	}

	/**
	 * Gets the (normalized) text owned by this element only; does not get the combined text of all children.
	 * <p>
	 * For example, given HTML {@code <p>Hello <b>there</b> now!</p>}, {@code p.ownText()} returns {@code "Hello now!"},
	 * whereas {@code p.text()} returns {@code "Hello there now!"}.
	 * Note that the text within the {@code b} element is not returned, as it is not a direct child of the {@code p} element.
	 *
	 * @return unencoded text, or empty string if none.
	 * @see #text()
	 * @see #textNodes()
	 */
	ownText(): string {
		throw new Error('method not support');
	}

	/**
	 * Set the text of this element. Any existing contents (text or elements) will be cleared.
	 * <p>As a special case, for {@code <script>} and {@code <style>} tags, the input text will be treated as data,
	 * not visible text.</p>
	 * @param text unencoded text
	 * @return this element
	 */
	protected set_text(text: string): this {
		Assert.notNull(text);
		this.empty();

		let owner = this.ownerDocument();
		let isContentForTagData: boolean = owner?.parser().isContentForTagData(this.normalName()) || false;
		if (Helper.notNull(owner) && isContentForTagData) this.appendChild(new DataNode(text));
		else this.appendChild(new TextNode(text));
		return this;
	}

	private static appendNormalisedText(accum: StringBuilder, node: TextNode) {
		let text = node.getWholeText();
		let isSpace = Element.preserveWhitespace(node.parentNode);
		if (isSpace || NodeUtils.isCDataNode(node)) accum.append(text);
		else Helper.appendNormalisedWhitespace(accum, text, TextNode.lastCharIsWhitespace(accum));
	}

	private static appendWhitespaceIfBr(element: Element, accum: StringBuilder) {
		let name = element.get_tag().getName();
		if (name === 'br' && !TextNode.lastCharIsWhitespace(accum)) accum.append(' ');
	}

	static preserveWhitespace(node: Node): boolean {
		if (!NodeUtils.isElement(node)) return false;
		else {
			let i = 0;
			let el: Element = node;
			do {
				let isSpace = el.get_tag().preserveWhitespace;
				if (isSpace) return true;
				el = el.parentNode;
				i++;
			} while (i < 6 && node !== null);
		}
	}

	outerHtmlHead(accum: StringBuilder, depth: number, setting: OutputSetting): void {
		throw new Error('Method not implemented.');
	}
	outerHtmlTail(accum: StringBuilder, depth: number, setting: OutputSetting): void {
		throw new Error('Method not implemented.');
	}
}
