import { Assert } from '../helper/Assert';
import { Helper } from '../helper/Helper';
import { StringBuilder } from '../helper/StringBuilder';
import { OutputSetting } from '../parse/Setting';
import { Attribute } from './Attribute';
import { Document } from './Document';
import { Entities } from './Entities';

export type AttributeFilter = (attr: Attribute, index: number, array: Attribute[]) => boolean;

/**
 * The attributes of an Element.
 * Attribute name and value comparisons are generally <b>case sensitive</b>.
 * By default for HTML, attribute names are normalized to lower-case on parsing.
 * That means you should use lower-case strings when referring to attributes by name.
 */
export class Attributes {
	dataset(): Record<string, string> {
		throw new Error('Method not implemented.');
	}
	static readonly dataPrefix: string = 'data-';
	static readonly InternalPrefix: string = '/';
	private readonly attributes: Attribute[] = [];

	/**
	 * Get the number of attributes in this set
	 * @return {number}
	 */
	get length(): number {
		return this.attributes.length;
	}

	/**
	 * Test if this Attributes list is empty
	 * @return {boolean}
	 */
	isEmpty(): boolean {
		return this.length === 0;
	}

	/**
	 * Get an attribute
	 * @param name the (case-sensitive) attribute key
	 * @return the attribute
	 */
	get(name: string): Attribute | null {
		let index = this.indexOfKey(name);
		return this.attributes[index] || null;
	}

	/**
	 * Get an attribute by case-insensitive key
	 * @param key the attribute name
	 * @return the first matching attribute
	 */
	getIgnoreCase(name: string): Attribute | null {
		let index = this.indexOfKeyIgnoreCase(name);
		return this.attributes[index] || null;
	}

	/**
	 * Returns index
	 * @param name {string}
	 */
	indexOfKey(name: string): number {
		return this.findIndex((attr) => attr.get_key() === name);
	}

	/**
	 * Returns index
	 * @param name {string}
	 */
	indexOfKeyIgnoreCase(name: string): number {
		name = name.toLowerCase();
		return this.findIndex((attr) => attr.get_key().toLowerCase() === name);
	}

	findByKey(name: string): Attribute {
		return this.find((attr) => attr.get_key() === name);
	}

	/**
	 * Returns the index of the first attribute
	 * @param {AttributeFilter} predicate
	 * @return {number}
	 */
	findIndex(predicate: AttributeFilter): number {
		return this.attributes.findIndex(predicate);
	}

	/**
	 * Returns the value of the first attribute
	 * @param {AttributeFilter} predicate
	 * @return {Attribute}
	 */
	find(predicate: AttributeFilter): Attribute {
		return this.attributes.find(predicate);
	}

	/**
	 * Returns the elements of an array
	 */
	filter(predicate: AttributeFilter): Attribute[] {
		return this.attributes.filter(predicate);
	}

	/**
	 * Adds a new attribute. Will produce duplicates if the key already exists.
	 * @see Attributes#put(String, String)
	 */
	add(name: string, value: string | boolean): this {
		this.attributes.push(this.createAttr(name, `${value}`));
		return this;
	}

	/**
	 * Add all the attributes from the incoming set to this set.
	 * @param incoming attributes to add to these attributes.
	 */
	addAll(attributes: Attributes): this {
		Assert.notNull(attributes);
		attributes.forEach((attr) => this.put(attr));
		return this;
	}

	/**
	 * Set a new attribute, or replace an existing one by key.
	 * @param name case sensitive attribute key (not null)
	 * @param value attribute value (may be null, to set a boolean attribute)
	 * @return these attributes, for chaining
	 */
	put(name: string, value: string): this;

	/**
	 * Set a new boolean attribute, remove attribute if value is false.
	 * @param name case <b>insensitive</b> attribute key
	 * @param value attribute value
	 * @return these attributes, for chaining
	 */
	put(name: string, value: boolean): this;

	/**
	 * Set a new attribute, or replace an existing one by key.
	 * @param attribute attribute with case sensitive key
	 * @return these attributes, for chaining
	 * */
	put(attribute: Attribute): this;

	/** @private */
	put(first: string | Attribute, value?: string | boolean): this {
		Assert.notNull(first);

		// first is Attribute
		if (first instanceof Attribute) {
			first.set_parent(this);
			this.attributes.push(first);
			return this;
		}

		// value is string
		else if (typeof value === 'string') {
			let attr = this.findByKey(first);
			if (attr !== null) attr.set_key(value);
			else this.add(first, value);
			return this;
		}

		// value is boolean
		else if (typeof value === 'boolean') {
			if (!value) this.remove(first);
			else this.putIgnoreCase(first, null);
			return this;
		}

		// error
		else throw new Error(`@args not support.`);
	}

	/**
	 * Set a new attribute
	 * @param name case <b>insensitive</b> attribute key
	 * @param value {string | boolean}
	 */
	putIgnoreCase(name: string, value: string) {
		let attr = this.getIgnoreCase(name);
		if (attr === null) this.add(name, value);
		else {
			attr.set_val(value);
			if (attr.get_key() !== name) attr.set_key(name);
			return this;
		}
	}

	/**
	 * Remove an attribute by key. <b>Case sensitive.</b>
	 * @param name attribute key to remove
	 */
	remove(name: string): this {
		let index = this.indexOfKey(name);
		if (index !== -1) this.attributes.splice(index, 1);
		return this;
	}

	/**
	 * Remove an attribute by key. <b>Case insensitive.</b>
	 * @param key attribute key to remove
	 */
	removeIgnoreCase(name: string): this {
		let index = this.indexOfKeyIgnoreCase(name);
		if (index !== -1) this.attributes.splice(index, 1);
		return this;
	}

	/**
	 * Tests if these attributes contain an attribute with this key.
	 * @param name case-sensitive key to check for
	 * @return true if key exists, false otherwise
	 */
	hasKey(name: string): boolean {
		return this.indexOfKey(name) !== -1;
	}

	/**
	 * Tests if these attributes contain an attribute with this key.
	 * @param name key to check for
	 * @return true if key exists, false otherwise
	 */
	hasKeyIgnoreCase(name: string): boolean {
		return this.indexOfKeyIgnoreCase(name) !== -1;
	}

	/**
	 * Check if these attributes contain an attribute with a value for this key.
	 * @param name key to check for
	 * @return true if key exists, and it has a value
	 */
	hasDeclaredValueForKey(name: string): boolean {
		let attr = this.get(name);
		return attr?.get_val() !== null;
	}

	/**
	 * Check if these attributes contain an attribute with a value for this key.
	 * @param key case-insensitive key to check for
	 * @return true if key exists, and it has a value
	 */
	hasDeclaredValueForKeyIgnoreCase(name: string): boolean {
		let attr = this.getIgnoreCase(name);
		return attr?.get_val() !== null;
	}

	/**
	 * Performs the specified action for each element in an array.
	 * @param callbackfn — A function that accepts up to three arguments.
	 */
	forEach(callbackfn: (value: Attribute, index: number, array: Attribute[]) => void) {
		this.attributes.forEach(callbackfn);
	}

	private createAttr(name: string, value: string): Attribute {
		return new Attribute(name, value).set_parent(this);
	}

	/**
	 * Get the HTML representation of these attributes.
	 * @return HTML
	 */
	html(): string {
		let sb = new StringBuilder();
		let setting = new Document('').outputSetting;
		return this.htmlImpl(sb, setting).toString();
	}

	private htmlImpl(accum: StringBuilder, setting: OutputSetting): StringBuilder {
		let sz = this.length;
		for (let i = 0; i < sz; i++) {
			let attr = this.attributes[i];
			if (Attributes.isInternalKey(attr.get_key())) continue;

			// inlined from Attribute.html()
			let key = attr.get_key();
			let val = attr.get_val();
			accum.append(' ').append(key);

			// collapse checked=null, checked="", checked=checked; write out others
			if (!Attribute.shouldCollapseAttribute(key, val, setting)) {
				accum.append('="');
				Entities.escapeImpl(accum, Helper.isNull(val) ? '' : val, setting, true, false, false);
				accum.append('"');
			}
		}

		return accum;
	}

	toString(): string {
		return this.html();
	}

	private static dataKey(key: string): string {
		return Attributes.dataPrefix + key;
	}

	static internalKey(key: string): string {
		return Attributes.InternalPrefix + key;
	}

	static isInternalKey(key: string): boolean {
		return key != null && key.length > 1 && key.charAt(0) === Attributes.InternalPrefix;
	}
}
