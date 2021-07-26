import { Assert } from '../helper/Assert';
import { Helper } from '../helper/Helper';
import { NodeUtils } from '../helper/NodeUtils';
import { NodeFilter } from '../select/NodeFilter';
import { NodeTraversor } from '../select/NodeTraversor';
import { NodeVisitor } from '../select/NodeVisitor';
import { QueryParser } from '../select/QueryParser';
import { Selector } from '../select/Selector';
import { Comment } from './Comment';
import { DataNode } from './DataNode';
import { Element } from './Element';
import { FormElement } from './FormElement';
import { Node } from './Node';
import { TextNode } from './TextNode';

export class Elements extends Array<Element> {
	/**
	 * Create new constructor
	 * @param elements {Element[]}
	 */
	constructor(elements: Element[] = []) {
		super(...elements);
	}

	size(): number {
		return this.length;
	}

	isEmpty(): boolean {
		return this.length === 0;
	}

	get(index: number): Element {
		if (index < 0 || index >= this.length) throw new Error(`@index invalid in [0, ${this.length}]`);
		return this[index];
	}

	/**
	 * Creates a deep copy of these elements.
	 * @return a deep copy
	 */
	clone(): Elements {
		let els = new Elements();
		this.forEach((el) => els.push(el.clone()));
		return els;
	}

	add(node: Element) {
		this.push(node);
	}

	/**
	 * Get an attribute value from the first matched element that has the attribute.
	 * @param name The attribute key.
	 * @return The attribute value from the first matched element that has the attribute..
	 * @see #hasAttr(String)
	 */
	attr(name: string): string;

	/**
	 * Set an attribute on all matched elements.
	 * @param name attribute key
	 * @param value attribute value
	 * @return this
	 */
	attr(name: string, value: string): this;

	/**
	 * @private
	 */
	attr(name: string, value?: string): any {
		return value === undefined ? this.get_attr(name) : this.set_attr(name, value);
	}

	/**
	 * Get an attribute value from the first matched element that has the attribute.
	 * @param name The attribute key.
	 * @return The attribute value from the first matched element that has the attribute..
	 * @see #hasAttr(String)
	 */
	get_attr(name: string): string {
		let index = this.findIndex((el) => el.hasAttr(name));
		return index === -1 ? '' : this[index].attr(name);
	}

	/**
	 * Set an attribute on all matched elements.
	 * @param name attribute key
	 * @param value attribute value
	 * @return this
	 */
	set_attr(name: string, value: string): this {
		this.forEach((el) => el.attr(name, value));
		return this;
	}

	/**
	 * Checks if any of the matched elements have this attribute defined.
	 * @param name attribute key
	 * @return true if any of the elements have the attribute; false if none do.
	 */
	hasAttr(name: string): boolean {
		return this.some((el) => el.hasAttr(name));
	}

	/**
	 * Get the attribute value for each of the matched elements. If an element does not have this attribute, no value is
	 * included in the result set for that element.
	 * @param attributeKey the attribute name to return values for. You can add the {@code abs:} prefix to the key to
	 * get absolute URLs from relative URLs, e.g.: {@code doc.select("a").eachAttr("abs:href")} .
	 * @return a list of each element's attribute value for the attribute
	 */
	eachAttr(name: string): string[] {
		return this.filter((el) => el.hasAttr(name)).map((el) => el.attr(name));
	}

	/**
	 * Remove an attribute from every matched element.
	 * @param name The attribute to remove.
	 * @return this (for chaining)
	 */
	removeAttr(name: string): this {
		this.forEach((el) => el.removeAttr(name));
		return this;
	}

	/**
	 * Add the class name to every matched element's {@code class} attribute.
	 * @param className class name to add
	 * @return this
	 */
	addClass(className: string): this {
		this.forEach((el) => el.addClass(className));
		return this;
	}

	/**
	 * Remove the class name from every matched element's {@code class} attribute, if present.
	 * @param className class name to remove
	 * @return this
	 */
	removeClass(className: string): this {
		this.forEach((el) => el.removeClass(className));
		return this;
	}

	/**
	 *  the class name on every matched element's {@code class} attribute.
	 * @param className class name to add if missing, or remove if present, from every element.
	 * @return this
	 */
	toggleClass(className: string): this {
		this.forEach((el) => el.toggleClass(className));
		return this;
	}

	/**
	 * Determine if any of the matched elements have this class name set in their {@code class} attribute.
	 * @param className class name to check for
	 * @return true if any do, false if none do
	 */
	hasClass(className: string): boolean {
		return this.some((el) => el.hasClass(className));
	}

	/**
	 * Get the form element's value of the first matched element.
	 * @return The form element's value, or empty if not set.
	 * @see Element#val()
	 */
	val(): string;

	/**
	 * Set the form element's value in each of the matched elements.
	 * @param value The value to set into each matched element
	 * @return this (for chaining)
	 */
	val(value: string): this;

	/**
	 * @private
	 */
	val(value?: string): any {
		if (value === undefined) return this.length === 0 ? '' : this.first()?.val();
		else {
			this.forEach((el) => el.val(value));
			return this;
		}
	}

	/**
	 * Get the combined text of all the matched elements.
	 * <p>
	 * Note that it is possible to get repeats if the matched elements contain both parent elements and their own
	 * children, as the Element.text() method returns the combined text of a parent and all its children.
	 * @return string of all text: unescaped and no HTML.
	 * @see Element#text()
	 * @see #eachText()
	 */
	text(): string {
		return this.map((el) => el.text()).join(' ');
	}

	/**
     Test if any matched Element has any text content, that is not just whitespace.
     @return true if any element has non-blank text content.
     @see Element#hasText()
     */
	hasText(): boolean {
		return this.some((el) => el.hasText());
	}

	/**
	 * Get the text content of each of the matched elements.
	 * @return A list of each matched element's text content.
	 */
	eachText(): string[] {
		return this.filter((el) => el.hasText()).map((el) => el.text());
	}

	/**
	 * Get the combined inner HTML of all matched elements.
	 * @return string of all element's inner HTML.
	 */
	html(): string;

	/**
	 * Set the inner HTML of each matched element.
	 * @param html HTML to parse and set into each matched element.
	 * @return this, for chaining
	 */
	html(html: string): this;

	/**
	 * @private
	 */
	html(html?: string): any {
		if (html === undefined) return this.map((el) => el.html()).join('\n');
		else {
			this.forEach((el) => el.html(html));
			return this;
		}
	}

	/**
	 * Get the combined outer HTML of all matched elements.
	 * @return string of all element's outer HTML.
	 * @see #text()
	 * @see #html()
	 */
	outerHtml(): string {
		return this.map((el) => el.outerHtml()).join('\n');
	}

	/**
	 * Get the combined outer HTML of all matched elements. Alias of {@link #outerHtml()}.
	 * @return string of all element's outer HTML.
	 * @see #text()
	 * @see #html()
	 */
	toString(): string {
		return this.outerHtml();
	}

	/**
	 * Update (rename) the tag name of each matched element. For example, to change each {@code <i>} to a {@code <em>}, do
	 * {@code doc.select("i").tagName("em");}
	 *
	 * @param tagName the new tag name
	 * @return this, for chaining
	 * @see Element#tagName(String)
	 */
	tagName(tagName: string): this {
		this.forEach((el) => el.tagName(tagName));
		return this;
	}

	/**
	 * Add the supplied HTML to the start of each matched element's inner HTML.
	 * @param html HTML to add inside each element, before the existing HTML
	 * @return this, for chaining
	 * @see Element#prepend(String)
	 */
	prepend(html: string): this {
		this.forEach((el) => el.prepend(html));
		return this;
	}

	/**
	 * Add the supplied HTML to the end of each matched element's inner HTML.
	 * @param html HTML to add inside each element, after the existing HTML
	 * @return this, for chaining
	 * @see Element#append(String)
	 */
	append(html: string): this {
		this.forEach((el) => el.append(html));
		return this;
	}

	/**
	 * Insert the supplied HTML before each matched element's outer HTML.
	 * @param html HTML to insert before each element
	 * @return this, for chaining
	 * @see Element#before(String)
	 */
	before(html: string): this {
		this.forEach((el) => el.before(html));
		return this;
	}

	/**
	 * Insert the supplied HTML after each matched element's outer HTML.
	 * @param html HTML to insert after each element
	 * @return this, for chaining
	 * @see Element#after(String)
	 */
	after(html: string): this {
		this.forEach((el) => el.after(html));
		return this;
	}

	/**
	 * Wrap the supplied HTML around each matched elements.
	 * @param html HTML to wrap around each element
	 * @return this (for chaining)
	 * @see Element#wrap
	 */
	wrap(html: string): this {
		Assert.notEmpty(html);
		this.forEach((el) => el.wrap(html));
		return this;
	}

	/**
	 * Removes the matched elements from the DOM, and moves their children up into their parents. This has the effect of
	 * dropping the elements but keeping their children.
	 * @return this (for chaining)
	 * @see Node#unwrap
	 * */
	unwrap(): this {
		this.forEach((el) => el.unwrap());
		return this;
	}

	/**
	 * Empty (remove all child nodes from) each matched element. This is similar to setting the inner HTML of each
	 * element to nothing.
	 * @return this, for chaining
	 * @see Element#empty()
	 * @see #remove()
	 * */
	empty(): this {
		this.forEach((el) => el.empty());
		return this;
	}

	/**
	 * Remove each matched element from the DOM. This is similar to setting the outer HTML of each element to nothing.
	 * @return this, for chaining
	 * @see Element#empty()
	 * @see #empty()
	 */
	remove(): this {
		this.forEach((el) => el.remove());
		return this;
	}

	/**
	 * Find matching elements within this element list.
	 * @param query A {@link Selector} query
	 * @return the filtered list of elements, or an empty list if none match.
	 */
	select(query: string): Elements {
		return Selector.select(query, this);
	}

	/**
	 * Remove elements from this list that match the {@link Selector} query.
	 * <p>
	 * E.g. HTML: {@code <div class=logo>One</div> <div>Two</div>}<br>
	 * <code>Elements divs = doc.select("div").not(".logo");</code><br>
	 * Result: {@code divs: [<div>Two</div>]}
	 * <p>
	 * @param query the selector query whose results should be removed from these elements
	 * @return a new elements list that contains only the filtered results
	 */
	not(query: string): Elements {
		let out = Selector.select(query, this);
		return Selector.filterOut(this, out);
	}

	/**
	 * Get the <i>nth</i> matched element as an Elements object.
	 * <p>
	 * See also {@link #get(int)} to retrieve an Element.
	 * @param index the (zero-based) index of the element in the list to retain
	 * @return Elements containing only the specified element, or, if that element did not exist, an empty list.
	 */
	eq(index: number): Elements {
		let invalidIndex = index < 0 || index >= this.length;
		let els = invalidIndex ? [] : [this.get(index)];
		return new Elements(els);
	}

	/**
	 * Test if any of the matched elements match the supplied query.
	 * @param query A selector
	 * @return true if at least one element in the list matches the query.
	 */
	is(query: string): boolean {
		let evalu = QueryParser.parse(query);
		return this.some((el) => el.is(evalu));
	}

	/**
	 * Get the immediate next element sibling of each element in this list.
	 * @param {string=} query CSS query to match siblings against
	 * @return next element siblings.
	 */
	next(query?: string): Elements {
		return this.siblings(query, true, false);
	}

	/**
	 * Get each of the following element siblings of each element in this list.
	 * @param {string=} query CSS query to match siblings against
	 * @return all following element siblings.
	 */
	nextAll(query?: string): Elements {
		return this.siblings(query, true, true);
	}

	/**
	 * Get the immediate previous element sibling of each element in this list.
	 * @param {string=} query CSS query to match siblings against
	 * @return previous element siblings.
	 */
	prev(query?: string): Elements {
		return this.siblings(query, false, false);
	}

	/**
	 * Get each of the previous element siblings of each element in this list.
	 * @param {string=} query CSS query to match siblings against
	 * @return all previous element siblings.
	 */
	prevAll(query?: string): Elements {
		return this.siblings(query, false, true);
	}

	/**
	 * @private
	 * @param query
	 * @param next
	 * @param all
	 */
	private siblings(query?: string, next?: boolean, all?: boolean): Elements {
		let elements = new Elements();
		let evalu: any = !Helper.isNull(query) ? QueryParser.parse(<any>query) : null;
		for (let e of this) {
			do {
				let sib = next ? e.nextElementSibling() : e.previousElementSibling();
				if (Helper.isNull(sib)) break;
				if (Helper.isNull(evalu) || sib.is(evalu)) elements.push(sib);
				e = sib;
			} while (all);
		}
		return elements;
	}

	/**
	 * Get all of the parents and ancestor elements of the matched elements.
	 * @return all of the parents and ancestor elements of the matched elements
	 */
	parents(): Elements {
		let els = this.map((el) => el.parents()).flat();
		return new Elements(els);
	}

	/**
     Get the first matched element.
     @return The first matched element, or <code>null</code> if contents is empty.
     */
	first(): Element | null {
		return this.isEmpty() ? null : this.get(0);
	}

	/**
     Get the last matched element.
     @return The last matched element, or <code>null</code> if contents is empty.
     */
	last(): Element | null {
		return this.isEmpty() ? null : this.get(this.length - 1);
	}

	/**
	 * Perform a depth-first traversal on each of the selected elements.
	 * @param visitor the visitor callbacks to perform on each node
	 * @return this, for chaining
	 */
	traverse(visitor: NodeVisitor): Elements {
		NodeTraversor.traverse(visitor, this);
		return this;
	}

	/**
	 * Perform a depth-first filtering on each of the selected elements.
	 * @param nodeFilter the filter callbacks to perform on each node
	 * @return this, for chaining
	 */
	nodeFilter(filter: NodeFilter): Elements {
		NodeTraversor.filter(filter, this);
		return this;
	}

	/**
	 * Get the {@link FormElement} forms from the selected elements, if any.
	 * @return a list of {@link FormElement}s pulled from the matched elements. The list will be empty if the elements contain
	 * no forms.
	 */
	forms(): FormElement[] {
		return this.filter((el) => NodeUtils.isFormElement(el));
	}

	/**
	 * Get {@link Comment} nodes that are direct child nodes of the selected elements.
	 * @return Comment nodes, or an empty list if none.
	 */
	comments(): Comment[] {
		return this.childNodesOfType(Comment);
	}

	/**
	 * Get {@link TextNode} nodes that are direct child nodes of the selected elements.
	 * @return TextNode nodes, or an empty list if none.
	 */
	textNodes(): TextNode[] {
		return this.childNodesOfType(TextNode);
	}

	/**
	 * Get {@link DataNode} nodes that are direct child nodes of the selected elements. DataNode nodes contain the
	 * content of tags such as {@code script}, {@code style} etc and are distinct from {@link TextNode}s.
	 * @return Comment nodes, or an empty list if none.
	 */
	dataNodes(): DataNode[] {
		return this.childNodesOfType(DataNode);
	}

	private childNodesOfType<T extends Node>(classType: any): T[] {
		let fnc = (childNode: any[]): any[] => childNode.filter((node) => node instanceof classType);
		return this.map((node) => fnc(node.children())).flat();
	}
}
