import { Element } from '../nodes/Element';
import { Node } from '../nodes/Node';
import { Parser } from './Parser';
import { ParseSetting } from './Setting';
import { TreeBuilder } from './TreeBuilder';
import { FormElement } from '../nodes/FormElement';
import { Helper } from '../helper/Helper';
import { TokeniserState } from './TokeniserState';
import { Tag } from './Tag';
import { NodeUtils } from '../helper/NodeUtils';
import { Assert } from '../helper/Assert';
import { Document } from '../nodes/Document';
import { ParseError } from './ParseError';
import * as TK from './Token';
import { Comment } from '../nodes/Comment';
import { CDataNode } from '../nodes/CDataNode';
import { DataNode } from '../nodes/DataNode';
import { TextNode } from '../nodes/TextNode';
import {HtmlState, HtmlStateCls} from './HtmlState';

export class HtmlBuilder extends TreeBuilder {
	static readonly TagsSearchInScope: string[] = ['applet', 'caption', 'html', 'marquee', 'object', 'table', 'td', 'th'];
	static readonly TagSearchList: string[] = ['ol', 'ul'];
	static readonly TagSearchButton: string[] = ['button'];
	static readonly TagSearchTableScope: string[] = ['html', 'table'];
	static readonly TagSearchSelectScope: string[] = ['optgroup', 'option'];
	static readonly TagSearchEndTags: string[] = ['dd', 'dt', 'li', 'optgroup', 'option', 'p', 'rp', 'rt'];
	static readonly TagSearchSpecial: string[] = [
		"address", "applet", "area", "article", "aside", "base", "basefont", "bgsound",
		"blockquote", "body", "br", "button", "caption", "center", "col", "colgroup", "command", "dd",
		"details", "dir", "div", "dl", "dt", "embed", "fieldset", "figcaption", "figure", "footer", "form",
		"frame", "frameset", "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hgroup", "hr", "html",
		"iframe", "img", "input", "isindex", "li", "link", "listing", "marquee", "menu", "meta", "nav",
		"noembed", "noframes", "noscript", "object", "ol", "p", "param", "plaintext", "pre", "script",
		"section", "select", "style", "summary", "table", "tbody", "td", "textarea", "tfoot", "th", "thead",
		"title", "tr", "ul", "wbr", "xmp"
	];

	static readonly MaxScopeSearchDepth = 100; // prevents the parser bogging down in exceptionally broken pages

	state: HtmlState; // the current state
	originalState: HtmlState; // original / marked state

	private baseUriSetFromDoc: boolean;
	private headElement: Element; // the current head element
	private formElement: FormElement; // the current form element
	private contextElement: Element; // fragment parse context -- could be null even if fragment parsing
	private formattingElements: Element[]; // active (open) formatting elements
	private pendingTableCharacters: string[]; // chars in table to be shifted out
	private emptyEnd: TK.EndTag; // reused empty end tag

	framesetOk: boolean; // if ok to go into frameset
	private fosterInserts: boolean; // if next inserts should be fostered
	private fragmentParsing: boolean; // if parsing a fragment of html

	defaultSetting(): ParseSetting {
		return ParseSetting.htmlDefault;
	}

	newInstance(): TreeBuilder {
		return new HtmlBuilder();
	}

	protected initialiseParse(input: string, baseUri: string, parser: Parser): void {
		super.initialiseParse(input, baseUri, parser);

		// this is a bit mucky. todo - probably just create new parser objects to ensure all reset.
		this.state = HtmlStateCls.Initial;
		this.originalState = null;
		this.baseUriSetFromDoc = false;
		this.headElement = null;
		this.formElement = null;
		this.contextElement = null;
		this.formattingElements = [];
		this.pendingTableCharacters = [];
		this.emptyEnd = new TK.EndTag();
		this.framesetOk = true;
		this.fosterInserts = false;
		this.fragmentParsing = false;
	}

	parseFragment(inputFragment: string, context: Element, baseUri: string, parser: Parser): Node[] {
		// context may be null
		this.state = HtmlStateCls.Initial;
		this.initialiseParse(inputFragment, baseUri, parser);
		this.contextElement = context;
		this.fragmentParsing = true;

		let root: Element;

		if (Helper.notNull(context)) {
			let contextTag = this.transitionContext(context);
			root = new Element(Tag.valueOf(contextTag, this.setting), baseUri);
			this.doc.appendChild(root);
			this.stack.push(root);
			this.resetInsertionMode();

			// setup form element to nearest form on context (up ancestor chain). ensures form controls are associated
			// with form correctly
			let contextChain = context.parents();
			contextChain.add(context, 0);

			// update form el
			this.formElement = <any>contextChain.find((el) => el instanceof FormElement);
		}

		//------------------------------

		this.runParser();
		if (Helper.isNull(context)) return this.doc.childNodes();
		else {
			// depending on context and the input html, content may have been added outside of the root el
			// e.g. context=p, input=div, the div will have been pushed out.
			let nodes = root.siblingNodes();
			if (nodes.length > 0) root.insertChildren(nodes, -1);
			return root.childNodes();
		}
	}

	private transitionContext(context: Element): string {
		Assert.notNull(context);

		// quirks setup:
		if (Helper.notNull(context.ownerDocument())) {
			this.doc.quirksMode(context.ownerDocument().quirksMode());
		}

		// initialise the tokeniser state:
		let contextTag = context.normalName();

		if (Helper.in(contextTag, 'title', 'textarea')) {
			this.tokeniser.transition(TokeniserState.Rcdata);
		} //
		else if (Helper.in(contextTag, 'iframe', 'noembed', 'noframes', 'style', 'xmp')) {
			this.tokeniser.transition(TokeniserState.Rawtext);
		} //
		else if (contextTag === 'script') {
			this.tokeniser.transition(TokeniserState.ScriptData);
		} //
		else if (contextTag === 'noscript') {
			this.tokeniser.transition(TokeniserState.Data);
		}
		// if scripting enabled, rawtext
		else if (contextTag === 'plaintext') {
			this.tokeniser.transition(TokeniserState.Data);
		} //
		else {
			this.tokeniser.transition(TokeniserState.Data); // default
		}

		return contextTag;
	}

	process(token: TK.Token, state: HtmlState = this.state): boolean {
		this.currentToken = token;
		return state.process(token, this);
	}

	transition(state: HtmlState): void {
		this.state = state;
	}

	markInsertionMode(): void {
		this.originalState = this.state;
	}

	getDocument(): Document {
		return this.doc;
	}

	getBaseUri(): string {
		return this.baseUri;
	}

	maybeSetBaseUri(base: Element): void {
		// only listen to the first <base href> in parse
		if (this.baseUriSetFromDoc) return;

		let href = base.absUrl('href');
		if (href.length > 0) {
			// ignore <base target> etc
			this.baseUri = href;
			this.baseUriSetFromDoc = true;
			this.doc.setBaseUri(href); // set on the doc so doc.createElement(Tag) will get updated base, and to update all descendants
		}
	}

	isFragmentParsing(): boolean {
		return this.fragmentParsing;
	}

	error(state: HtmlState | string): void {
		if (this.parser.errors.canAddError()) {
			let errorMsg = Helper.isString(state) ? state : `'Unexpected token [${this.currentToken.tokenType}] when in state [${state}]`;
			this.parser.errors.push(new ParseError(this.reader.pos(), errorMsg));
		}
	}

	insertStartTag(startTag: string | TK.StartTag): Element {
		//

		// startTag is string
		if (Helper.isString(startTag)) {
			let tag = Tag.valueOf(startTag, this.setting);
			return this.insert(new Element(tag));
		}

		// startTag is TK.StartTag
		else if (startTag instanceof TK.StartTag) {
			//

			// cleanup duplicate attributes:
			if (startTag.hasAttributes() && !startTag.attributes.isEmpty()) {
				let dupes = startTag.attributes.deduplicate(this.setting);
				if (dupes > 0) this.error('Duplicate attribute');
			}

			// handle empty unknown tags
			// when the spec expects an empty tag, will directly hit insertEmpty, so won't generate this fake end tag.
			if (startTag.isSelfClosing()) {
				let el: Element = this.insertEmpty(startTag);
				this.stack.push(el);
				this.tokeniser.transition(TokeniserState.Data); // handles <script />, otherwise needs breakout steps from script data
				this.tokeniser.emit(this.emptyEnd.reset().set_tagName(el.tagName())); // ensure we get out of whatever state we are in. emitted for yielded processing
				return el;
			}
			//
			else {
				let tag = Tag.valueOf(startTag.name(), this.setting);
				let attrs = this.setting.normalizeAttributes(startTag.attributes);
				return this.insert(new Element(tag, null, attrs));
			}
		}
	}

	insertEmpty(startTag: TK.StartTag): Element {
		let tag = Tag.valueOf(startTag.name(), this.setting);
		let attrs = this.setting.normalizeAttributes(startTag.attributes);
		let element = this.insertNode(new Element(tag, null, attrs));
		if (startTag.isSelfClosing()) {
			if (!tag.isEmpty()) this.tokeniser.error('Tag cannot be self closing; not a void tag');
			else tag.setSelfClosing();
		}
		return element;
	}

	insertForm(startTag: TK.StartTag, onStack: boolean): FormElement {
		let tag = Tag.valueOf(startTag.name(), this.setting);
		let attrs = this.setting.normalizeAttributes(startTag.attributes);
		let element = new FormElement(tag, null, attrs);
		this.setFormElement(element);
		this.insertNode(element);
		if (onStack) this.stack.push(element);
		return element;
	}

	insertNode<T extends Node>(node: T): T {
		if (this.stack.length === 0) this.doc.appendChild(node);
		else if (this.isFosterInserts()) this.insertInFosterParent(node);
		else this.currentElement().appendChild(node);

		// connect form controls to their form element
		if (NodeUtils.isElement(node) && node.isFormList() && Helper.notNull(this.formElement)) {
			this.formElement.addElement(node);
		}

		return node;
	}

	/**
	 * @param {Element} element
	 */
	insert(element: Element): Element;

	/**
	 * @param {TK.StartTag} startTag
	 */
	insert(startTag: TK.StartTag): Element;

	/**
	 * @param {TK.Comment} commentToken
	 */
	insert(commentToken: TK.Comment): Comment;

	/**
	 * @param {TK.Character} characterToken
	 */
	insert(characterToken: TK.Character): Element;

	/** @private */
	insert(object: Element | TK.Token): Node {
		//

		// object is Element
		if (NodeUtils.isElement(object)) {
			let el = this.insertNode(object);
			this.stack.push(el);
			return el;
		}

		// object is TK.Comment
		else if (object instanceof TK.Comment) {
			let comment = new Comment(object.getData());
			return this.insertNode(comment);
		}

		// object is TK.Character
		else if (object instanceof TK.Character) {
			let el: Element = this.currentElement() || this.doc;
			let data = object.getData();
			let node = object.isCData() ? new CDataNode(data) : this.isContentForTagData(el.normalName()) ? new DataNode(data) : new TextNode(data);
			el.appendChild(node);
			return node;
		}

		// object is TK.StartTag
		else if (object instanceof TK.StartTag) {
			return this.insertStartTag(object);
		}

		// error
		else throw new Error(`arguments not support.`);
	}

	pop(): Element {
		return this.stack.pop();
	}

	push(element: Element): void {
		this.stack.push(element);
	}

	get_stack(): Element[] {
		return this.stack;
	}

	onStack(el: Element): boolean {
		return this.isElementInQueue(this.stack, el);
	}

	static readonly maxQueueDepth: number = 256; // an arbitrary tension point between real HTML and crafted pain
	private isElementInQueue(queue: Element[], element: Element): boolean {
		let bottom = queue.length - 1;
		let upper = bottom >= HtmlBuilder.maxQueueDepth ? bottom - HtmlBuilder.maxQueueDepth : 0;
		return queue
			.slice(upper, bottom)
			.reverse()
			.some((el) => el === element);
	}

	getFromStack(elName: string): Element {
		let bottom = this.stack.length - 1;
		let upper = bottom >= HtmlBuilder.maxQueueDepth ? bottom - HtmlBuilder.maxQueueDepth : 0;
		return this.stack
			.slice(upper, bottom)
			.reverse()
			.find((el) => el.nodeName() === elName);
	}

	get stackSize(): number {
		return this.stack.length;
	}

	removeFromStack(el: Element): boolean {
		let index = this.stack
			.slice()
			.reverse()
			.findIndex((el) => el.equals(el));
		if (index !== -1) this.stack.splice(this.stackSize - 1 - index, 1);
		return index !== -1;
	}

	popStackToClose(...elNames: string[]): Element {
		for (let pos = this.stack.length - 1; pos >= 0; pos--) {
			let el = this.stack.splice(pos, 1)[0];
			if (elNames.includes(el.normalName())) return el;
		}
		return null;
	}

	popStackToBefore(elName: string): void {
		for (let pos = this.stack.length - 1; pos >= 0; pos--) {
			let next = this.stack[pos];
			if (next.normalName() === elName) break;
			else this.stack.splice(pos, 1);
		}
	}

	clearStackToTableContext(): void {
		this.clearStackToContext('table');
	}

	clearStackToTableBodyContext(): void {
		this.clearStackToContext('tbody', 'tfoot', 'thead', 'template');
	}

	clearStackToTableRowContext() {
		this.clearStackToContext('tr', 'template');
	}

	clearStackToContext(...nodeNames: string[]) {
		for (let pos = this.stack.length - 1; pos >= 0; pos--) {
			let next = this.stack[pos];
			let name = next.normalName();
			if (Helper.in(name, ...nodeNames) || name === 'html') break;
			else this.stack.splice(pos, 1);
		}
	}

	aboveOnStack(el: Element): Element {
		Assert.isTrue(this.onStack(el));
		for (let pos = this.stackSize - 1; pos >= 0; pos--) {
			let next = this.stack[pos];
			if (next.equals(el)) return this.stack[pos - 1];
		}
		return null;
	}

	insertOnStackAfter(after: Element, input: Element): void {
		let i = this.stack.lastIndexOf(after);
		Assert.isTrue(i !== -1);
		this.stack.splice(i + 1, 0, input);
	}

	replaceOnStack(output: Element, input: Element) {
		this.replaceInQueue(this.stack, output, input);
	}

	private replaceInQueue(queue: Element[], output: Element, input: Element) {
		let i = queue.lastIndexOf(output);
		Assert.isTrue(i !== -1);
		queue[i] = input;
	}

	resetInsertionMode(): void {
		// https://html.spec.whatwg.org/multipage/parsing.html#the-insertion-mode
		let last = false;
		for (let pos = this.stackSize - 1; pos >= 0; pos--) {
			let node = this.stack[pos];
			if (pos === 0) {
				last = true;
				if (this.fragmentParsing) {
					node = this.contextElement;
				}
			}

			let name = node?.normalName() || '';
			if ('select' === name) this.transition(HtmlStateCls.InSelect);
			else if ('td' === name || ('th' === name && !last)) this.transition(HtmlStateCls.InCell);
			else if ("tr" === name) this.transition(HtmlStateCls.InRow);
			else if ("tbody" === name || "thead" === name || "tfoot" === name) this.transition(HtmlStateCls.InTableBody);
			else if ("caption" === name) this.transition(HtmlStateCls.InCaption);
			else if ("colgroup" === name) this.transition(HtmlStateCls.InColumnGroup);
			else if ("table" === name) this.transition(HtmlStateCls.InTable);
			else if ("head" === name && !last) this.transition(HtmlStateCls.InHead);
			else if ("body" === name) this.transition(HtmlStateCls.InBody);
			else if ("frameset" === name) this.transition(HtmlStateCls.InFrameset);
			else if ("html" === name) this.transition(Helper.isNull(this.headElement) ? HtmlStateCls.BeforeHead : HtmlStateCls.AfterHead);
			else if (last) this.transition(HtmlStateCls.InBody);
		}
	}

	// todo: tidy up in specific scope methods
	private specificScopeTarget: string[] = [];

	private inSpecificScope(target: string | string[], baseTypes: string[], extraTypes: string[]) {

		// target sis tring
		if (typeof target === 'string') {
			this.specificScopeTarget[0] = target;
			return this.inSpecificScope(this.specificScopeTarget, baseTypes, extraTypes);
		}

		// target is array
		// https://html.spec.whatwg.org/multipage/parsing.html#has-an-element-in-the-specific-scope
		else if (Array.isArray(target)) {
			let bottom = this.stackSize - 1;
			let top = bottom > HtmlBuilder.MaxScopeSearchDepth ? bottom - HtmlBuilder.MaxScopeSearchDepth : 0;

			for (let pos = bottom; pos >= top; pos--) {
				let elName = this.stack[pos].normalName();
				if (Helper.inSorted(elName, target)) return true;
				else if (Helper.inSorted(elName, baseTypes)) return false;
				else if (extraTypes != null && Helper.inSorted(elName, extraTypes)) return false;
			}

			//Validate.fail("Should not be reachable"); // would end up false because hitting 'html' at root (basetypes)
			return false;

		}
	}

	inScope(target: string | string[], extras?: string[]): boolean {
		if (Array.isArray(target)) return this.inSpecificScope(target, HtmlBuilder.TagsSearchInScope, null);
		else if (typeof target === 'string') {
			return this.inSpecificScope(target, HtmlBuilder.TagsSearchInScope, extras || null);
			// todo: in mathml namespace: mi, mo, mn, ms, mtext annotation-xml
			// todo: in svg namespace: forignOjbect, desc, title
		}
	}

	inListItemScope(targetName: string): boolean {
		return this.inScope(targetName, HtmlBuilder.TagSearchList);
	}

	inButtonScope(targetName: string): boolean {
		return this.inScope(targetName, HtmlBuilder.TagSearchButton);
	}

	inTableScope(targetName: string): boolean {
		return this.inSpecificScope(targetName, HtmlBuilder.TagSearchTableScope, null);
	}

	inSelectScope(targetName: string): boolean {
		for (let pos = this.stackSize - 1; pos >= 0; pos--) {
			let el = this.stack[pos];
			let elName = el.normalName();
			if (elName === targetName) return true;
			if (!Helper.inSorted(elName, HtmlBuilder.TagSearchSelectScope)) return false;
		}
		Assert.fail("Should not be reachable");
		//return false;
	}

	setHeadElement(headElement: Element): void {
		this.headElement = headElement;
	}

	getHeadElement(): Element {
		return this.headElement;
	}

	isFosterInserts(): boolean {
		return this.fosterInserts;
	}

	setFosterInserts(fosterInserts: boolean): void {
		this.fosterInserts = fosterInserts;
	}

	getFormElement(): FormElement {
		return this.formElement;
	}

	setFormElement(formElement: FormElement): void {
		this.formElement = formElement;
	}

	newPendingTableCharacters(): void {
		this.pendingTableCharacters = [];
	}

	getPendingTableCharacters(): string[] {
		return this.pendingTableCharacters;
	}

	/**
	 11.2.5.2 Closing elements that have implied end tags<p/>
	 When the steps below require the UA to generate implied end tags, then, while the current node is a dd element, a
	 dt element, an li element, an option element, an optgroup element, a p element, an rp element, or an rt element,
	 the UA must pop the current node off the stack of open elements.
	 @param excludeTag If a step requires the UA to generate implied end tags but lists an element to exclude from the
	 process, then the UA must perform the above steps as if that element was not in the above list.
	 */
	generateImpliedEndTags(excludeTag: string = null): void {
		let nameEq = (el: Element) => el.normalName() !== excludeTag;
		let inSorted = (el: Element) => Helper.inSorted(el.normalName(), HtmlBuilder.TagSearchEndTags);
		if (Helper.notNull(excludeTag)) while (nameEq(this.currentElement()) && inSorted(this.currentElement())) {
			this.pop()
		}
	}

	isSpecial(el: Element): boolean {
		// todo: mathml's mi, mo, mn
		// todo: svg's foreigObject, desc, title
		let name = el.normalName();
		return Helper.inSorted(name, HtmlBuilder.TagSearchSpecial);
	}

	lastFormattingElement(): Element {
		let len = this.formattingElements.length;
		return this.formattingElements[len - 1] || null;
	}

	positionOfElement(el: Element): number {
		return this.formattingElements.findIndex(node => node.equals(el));
	}

	removeLastFormattingElement(): Element {
		return this.formattingElements.pop() || null;
	}

	// active formatting elements
	pushActiveFormattingElements(input: Element): void {
		this.checkActiveFormattingElements(input);
		this.formattingElements.push(input);
	}

	pushWithBookmark(input: Element, bookmark: number): void {
		bookmark = Math.min(bookmark, this.formattingElements.length);
		this.checkActiveFormattingElements(input);
		this.formattingElements.splice(bookmark, 0, input);
	}

	checkActiveFormattingElements(input: Element): void {
		let numSeen = 0;
		for (let pos = this.formattingElements.length - 1; pos >= 0; pos--) {
			let el = this.formattingElements[pos];
			if (Helper.isNull(el)) break;
			if (this.isSameFormattingElement(input, el)) numSeen++;
			if (numSeen === 3) {
				this.formattingElements.splice(pos, 1);
				break;
			}
		}
	}

	isSameFormattingElement(a: Element, b: Element): boolean {
		return a.normalName() === b.normalName() &&
			a.get_attributes().equals(b.get_attributes());
	}

	reconstructFormattingElements(): void {
		let last = this.lastFormattingElement();
		if (last == null || this.onStack(last)) return;

		let entry = last;
		let size = this.formattingElements.length;
		let pos = size - 1;
		let skip: boolean = false;

		while (true) {
			if (pos === 0) { // step 4. if none before, skip to 8
				skip = true;
				break;
			}
			entry = this.formattingElements[--pos]; // step 5. one earlier than entry
			if (Helper.isNull(entry) || this.onStack(entry)) // step 6 - neither marker nor on stack
				break; // jump to 8, else continue back to 4
		}

		while (true) {

			// step 7: on later than entry
			if (!skip) entry = this.formattingElements[++pos];

			// should not occur, as we break at last element
			Assert.notNull(entry);

			// 8. create new element from element, 9 insert into current node, onto stack
			skip = false; // can only skip increment from 4.
			let newEl = this.insertStartTag(entry.normalName()); // todo: avoid fostering here?

			// newEl.namespace(entry.namespace()); // todo: namespaces
			newEl.get_attributes().addAll(entry.get_attributes());

			// 10. replace entry with new entry
			this.formattingElements[pos] = newEl;

			// 11: if not last entry in list, jump to 7
			if (pos === size - 1) break;
		}
	}

	clearFormattingElementsToLastMarker() {
		while (this.formattingElements.length !== 0) {
			let el = this.removeLastFormattingElement();
			if (Helper.isNull(el)) break;
		}
	}

	removeFromActiveFormattingElements(el: Element): void {
		for (let pos = this.formattingElements.length - 1; pos >= 0; pos--) {
			let next = this.formattingElements[pos];
			if (next === el) {
				this.formattingElements.splice(pos, 1);
				break;
			}
		}
	}

	isInActiveFormattingElements(el: Element): boolean {
		return this.isElementInQueue(this.formattingElements, el);
	}

	getActiveFormattingElement(nodeName: string): Element {
		for (let pos = this.formattingElements.length - 1; pos >= 0; pos--) {
			let next = this.formattingElements[pos];
			if (Helper.isNull(next)) break;
			else if (next.normalName() === nodeName) return next;
		}
		return null;
	}

	replaceActiveFormattingElement(output: Element, input: Element): void {
		return this.replaceInQueue(this.formattingElements, output, input);
	}

	insertMarkerToFormattingElements(): void {
		this.formattingElements.push(null);
	}

	insertInFosterParent(input: Node): void {
		let fosterParent: Element = this.stack[0];
		let lastTable = this.getFromStack("table");
		let isLastTableParent = false;
		if (Helper.notNull(lastTable)) {
			let bool = Helper.notNull(lastTable.parentNode);
			fosterParent = bool ? lastTable.parentNode : this.aboveOnStack(lastTable);
			isLastTableParent = bool ? true : isLastTableParent;
		}

		if (isLastTableParent) {
			Assert.notNull(lastTable); // last table cannot be null by this point.
			lastTable.before(input);
		}
		else fosterParent.appendChild(input);
	}

	 isContentForTagData(normalName: string): boolean {
		return normalName === 'script' || normalName === 'style';
	}

}
