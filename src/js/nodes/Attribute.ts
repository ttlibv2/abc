import { Assert } from '../helper/Assert';
import { Helper } from '../helper/Helper';
import { OutputSetting } from '../parse/Setting';
import { Attributes } from './Attributes';
import { IObject } from './IObject';

/**
 * A single key + value attribute.
 */
export class Attribute implements IObject {
	/**
	 * Create a new Attribute
	 * @param {string} key attribute key; case is preserved.
	 * @param {string=} val attribute value (may be null)
	 * @param {Attributes=} parent the containing Attributes
	 */
	constructor(private key: string, private val?: string, private parent: Attributes | null = null) {
		this.key = key.trim();
		this.val = val || '';
	}

	/**
	 * Get the attribute key.
	 * @return {string}
	 */
	get_key(): string {
		return this.key;
	}

	/**
	 * Set the attribute key; case is preserved.
	 * @param {string} key the new key; must not be null
	 */
	set_key(key: string): this {
		Assert.notEmpty(key);
		this.key = key;
		return this;
	}

	/**
	 * Get the attribute value.
	 * @return {string}
	 */
	get_val(): string {
		return this.val || '';
	}

	/**
	 * Set the attribute value.
	 * @param {string} val the new attribute value; must not be null
	 */
	set_val(val: string): this {
		this.val = val || '';
		return this;
	}

	set_parent(parent: Attributes): this {
		this.parent = parent;
		return this;
	}

	/**
	 * Get the HTML representation of this attribute
	 * @return html
	 */
	html(): string {
		return `${this.key}='${this.val}'`;
	}

	/**
	 * Get the string representation of this attribute
	 * @return {string}
	 */
	toString(): string {
		return this.html();
	}

	clone(): Attribute {
		return new Attribute(this.key, this.val, null);
	}

	equals(o: any): boolean {
		if(this === o) return true;
		if(Helper.isNull(o)) return false;
		if(this.constructor !== o.constructor) return false;
		else if(this.key !== o.key) return false;
		else return this.val === o.key;
	}

	static shouldCollapseAttribute(key: string, val: string, setting: OutputSetting): boolean {
		let iHtml = setting.syntax === 'html';
		let isValKey = Helper.isEmpty(val) || Helper.equalsIgnoreCase(val, key);
		let isBool = Attribute.isBooleanAttribute(key);
		return iHtml && (Helper.isNull(val) || (isValKey && isBool));
	}

	static isBooleanAttribute(key: string): boolean {
		return Attribute.booleanAttributes.includes(key);
	}

	private static readonly booleanAttributes: string[] = [
		'allowfullscreen',
		'async',
		'autofocus',
		'checked',
		'compact',
		'declare',
		'default',
		'defer',
		'disabled',
		'formnovalidate',
		'hidden',
		'inert',
		'ismap',
		'itemscope',
		'multiple',
		'muted',
		'nohref',
		'noresize',
		'noshade',
		'novalidate',
		'nowrap',
		'open',
		'readonly',
		'required',
		'reversed',
		'seamless',
		'selected',
		'sortable',
		'truespeed',
		'typemustmatch',
	];
}
