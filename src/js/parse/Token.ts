import { Assert } from '../helper/Assert';
import { Helper } from '../helper/Helper';
import { StringBuilder } from '../helper/StringBuilder';
import { Attributes } from '../nodes/Attributes';
import { Normalizer } from '../helper/Normalizer';
import { TokeniserState } from './TokeniserState';
import { Tokeniser } from './Tokeniser';

export enum TokenType {
	Doctype,
	StartTag,
	EndTag,
	Comment,
	Character, // note no CData - treated in builder as an extension of Character
	EOF,
}

export abstract class Token {
	abstract get type(): TokenType;

	/**
	 * Reset the data represent by this token, for reuse. Prevents the need to create transfer objects for every
	 * piece of data, which immediately get GCed.
	 */
	abstract reset(): this;

	static reset(sb: StringBuilder) {
		if (Helper.notNull(sb)) sb.delete(0, sb.length);
	}

	isDoctype(): this is Doctype {
		return this.type === TokenType.Doctype;
	}

	asDoctype(): Doctype {
		return <any>this;
	}

	isStartTag(): this is StartTag {
		return this.type === TokenType.StartTag;
	}

	asStartTag(): StartTag {
		return <any>this;
	}

	isEndTag(): this is EndTag {
		return this.type === TokenType.EndTag;
	}

	asEndTag(): EndTag {
		return <any>this;
	}

	isComment(): this is Comment {
		return this.type === TokenType.Comment;
	}

	asComment(): Comment {
		return <any>this;
	}

	isCharacter(): this is Character {
		return this.type === TokenType.Character;
	}

	/* eslint-disable */
	isCData(): this is CData {
		return this instanceof CData;
	}

	asCharacter(): Character {
		return <any>this;
	}

	isEOF(): this is EOF {
		return this.type === TokenType.EOF;
	}
}

export class Doctype extends Token {
	pubSysKey = null;
	forceQuirks = false;
	name = new StringBuilder();
	publicIdentifier = new StringBuilder();
	systemIdentifier = new StringBuilder();

	get type(): TokenType {
		return TokenType.Doctype;
	}

	reset(): this {
		Doctype.reset(this.publicIdentifier);
		Doctype.reset(this.systemIdentifier);
		Token.reset(this.name);
		this.forceQuirks = false;
		this.pubSysKey = null;
		return this;
	}

	isDoctype(): boolean {
		return this.type === TokenType.Doctype;
	}

	asDoctype(): Doctype {
		return <any>this;
	}

	isStartTag(): boolean {
		return this.type === TokenType.StartTag;
	}

	asStartTag(): StartTag {
		return <any>this;
	}

	isEndTag(): boolean {
		return this.type === TokenType.EndTag;
	}

	asEndTag(): EndTag {
		return <any>this;
	}

	isComment(): boolean {
		return this.type === TokenType.Comment;
	}

	asComment(): Comment {
		return <any>this;
	}

	isCharacter(): boolean {
		return this.type === TokenType.Character;
	}

	/* eslint-disable */
	isCData(): boolean {
		return <any>this instanceof CData;
	}

	asCharacter(): Character {
		return <any>this;
	}

	isEOF(): boolean {
		return this.type === TokenType.EOF;
	}
}

export abstract class Tag extends Token {
	/**
	 * Limits runaway crafted HTML from spewing attributes and getting a little sluggish in ensureCapacity.
	 * Real-world HTML will P99 around 8 attributes, so plenty of headroom.
	 * Implemented here and not in the Attributes object so that API users can add more if ever required.
	 */
	private static readonly MaxAttributes = 512;

	protected tagName: string;
	protected normalName: string; // lc version of tag name, for case insensitive tree build
	private pendingAttributeName: string; // attribute names are generally caught in one hop, not accumulated
	private pendingAttributeValue = new StringBuilder(); // but values are accumulated, from e.g. & in hrefs
	private pendingAttributeValueS: string; // try to get attr vals in one shot, vs Builder
	private hasEmptyAttributeValue: boolean = false; // distinguish boolean attribute from empty string value
	private hasPendingAttributeValue: boolean = false;
	selfClosing = false;
	attributes: Attributes; // start tags get attributes on construction. End tags get attributes on first new attribute (but only for parser convenience, not used).

	reset(): this {
		this.tagName = null;
		this.normalName = null;
		this.pendingAttributeName = null;
		this.pendingAttributeValueS = null;
		this.hasEmptyAttributeValue = false;
		this.hasPendingAttributeValue = false;
		this.selfClosing = false;
		this.attributes = null;
		Tag.reset(this.pendingAttributeValue);
		return this;
	}

	newAttribute(): void {
		if (Helper.isNull(this.attributes)) {
			this.attributes = new Attributes();
		}

		if (this.pendingAttributeName != null && this.attributes.length < Tag.MaxAttributes) {
			// the tokeniser has skipped whitespace control chars,
			// but trimming could collapse to empty for other control codes, so verify here
			this.pendingAttributeName = this.pendingAttributeName.trim();

			//
			if (this.pendingAttributeName.length > 0) {
				let value = this.hasPendingAttributeValue
					? this.pendingAttributeValue.length > 0
						? this.pendingAttributeValue.toString()
						: this.pendingAttributeValueS
					: this.hasEmptyAttributeValue
					? ''
					: null;

				// note that we add, not put. So that the first is kept, and rest are deduped,
				// once in a context where case sensitivity is known (the appropriate tree builder).
				this.attributes.add(this.pendingAttributeName, value);
			}
		}
		this.pendingAttributeName = null;
		this.hasEmptyAttributeValue = false;
		this.hasPendingAttributeValue = false;
		Tag.reset(this.pendingAttributeValue);
		this.pendingAttributeValueS = null;
	}

	hasAttributes(): boolean {
		return Helper.notNull(this.attributes);
	}

	hasAttribute(key: string): boolean {
		return this.hasAttributes() && this.attributes.hasKey(key);
	}

	// finalises for emit
	finaliseTag(): void {
		if (this.pendingAttributeName != null) {
			this.newAttribute();
		}
	}

	/**
	 * preserves case, for input into Tag.valueOf (which may drop case)
	 * @return {string}
	 */
	get_tagName(): string {
		Assert.isFalse(Helper.isEmpty(this.tagName));
		return this.tagName;
	}

	toStringName(): string {
		return Helper.notNull(this.tagName) ? this.tagName : '[unset]';
	}

	set_tagName(name: string): Tag {
		this.tagName = name;
		this.normalName = Normalizer.lowerCase(name);
		return this;
	}

	isSelfClosing(): boolean {
		return this.selfClosing;
	}

	// these appenders are rarely hit in not null state-- caused by null chars.
	appendTagName(append: string) {
		// might have null chars - need to replace with null replacement character
		append = append.replace(TokeniserState.nullChar, Tokeniser.replacementChar);
		this.tagName = Helper.isNull(this.tagName) ? append : this.tagName.concat(append);
		this.normalName = Normalizer.lowerCase(this.tagName);
	}

	appendAttributeName(append: string) {
		// might have null chars because we eat in one pass - need to replace with null replacement character
		append = append.replace(TokeniserState.nullChar, Tokeniser.replacementChar);
		this.pendingAttributeName = Helper.isNull(this.pendingAttributeName) ? append : this.pendingAttributeName.concat(append);
	}

	appendAttributeValue(append: string): void;
	appendAttributeValue(append: string[]): void;
	appendAttributeValue(appendCodepoints: number[]): void;
	appendAttributeValue(append: string | string[] | number[]): void {
		this.ensureAttributeValue();

		// append is string
		if (typeof append === 'string') {
			if (this.pendingAttributeValue.length === 0) this.pendingAttributeValueS = append;
			else this.pendingAttributeValue.append(append);
		}

		// append is string[]
		else if (typeof append[0] === 'string') {
			this.pendingAttributeValue.append(append);
		}

		// append is number[]
		else if (typeof append[0] === 'number') {
			let appendCodepoints: number[] = <any>append;
			for (let codepoint of appendCodepoints) {
				this.pendingAttributeValue.appendCodePoint(codepoint);
			}
		}
	}

	setEmptyAttributeValue() {
		this.hasEmptyAttributeValue = true;
	}

	private ensureAttributeValue(): void {
		this.hasPendingAttributeValue = true;
		if (this.pendingAttributeValueS != null) {
			this.pendingAttributeValue.append(this.pendingAttributeValueS);
			this.pendingAttributeValueS = null;
		}
	}

	abstract toString(): string;
}

export class StartTag extends Tag {
	get type(): TokenType {
		return TokenType.StartTag;
	}

	reset(): this {
		super.reset();
		this.attributes = null;
		return this;
	}

	nameAttr(name: string, attributes: Attributes): this {
		this.tagName = name;
		this.attributes = attributes;
		this.normalName = Normalizer.lowerCase(name);
		return this;
	}

	toString(): string {
		let hasAttr = this.hasAttributes() && this.attributes.length > 0;
		let attr_list = this.attributes.toString();
		return `<${this.toStringName()}${hasAttr ? ' ' + attr_list : ''}>`;
	}
}

export class EndTag extends Tag {
	get type(): TokenType {
		return TokenType.EndTag;
	}

	toString(): string {
		return `</${this.tagName}>`;
	}
}

export class Comment extends Token {
	data = new StringBuilder();
	dataS: string; // try to get in one shot
	bogus = false;

	get type(): TokenType {
		throw new Error('Method not implemented.');
	}

	reset(): this {
		Comment.reset(this.data);
		this.dataS = null;
		this.bogus = false;
		return this;
	}

	getData() {
		return Helper.notNull(this.dataS) ? this.dataS : this.data.toString();
	}

	append(append: string): this {
		this.ensureData();
		if (this.data.length === 0) this.dataS = append;
		else this.data.append(append);
		return this;
	}

	private ensureData() {
		// if on second hit, we'll need to move to the builder
		if (Helper.notNull(this.dataS)) {
			this.data.append(this.dataS);
			this.dataS = null;
		}
	}

	toString(): string {
		return `<!-- ${this.getData} -->`;
	}
}

export class Character extends Token {
	private _data: string;

	constructor(data: string = null) {
		super();
		this.data(data);
	}

	get type(): TokenType {
		return TokenType.Character;
	}

	reset(): this {
		this._data = null;
		return this;
	}

	data(data: string): this {
		this._data = data;
		return this;
	}

	getData(): string {
		return this._data;
	}

	toString(): string {
		return this.getData();
	}
}

export class CData extends Character {
	toString(): string {
		return `<![CDATA[${this.getData()}]]>`;
	}
}

export class EOF extends Token {
	get type(): TokenType {
		return TokenType.EOF;
	}

	reset(): this {
		return this;
	}

	toString() {
		return '';
	}
}
