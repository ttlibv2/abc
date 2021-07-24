import { Assert } from '../helper/Assert';
import { Attributes } from '../nodes/Attributes';

export class OutputSetting {
	prettyPrint: boolean = true;
	indentAmount = 1;
	outline = false;
	syntax: 'html' | 'xml' = 'html';
	escapeMode: any;
	encoder: any;
	coreCharset: any;

	prepareEncoder(): this {
		return this;
	}
}

export class ParseSetting {
	/**
	 * HTML default settings: both tag and attribute names are lower-cased during parsing.
	 */
	static readonly htmlDefault = new ParseSetting(false, false);

	/**
	 * Preserve both tag and attribute case.
	 */
	static readonly preserveCase = new ParseSetting(true, true);

	// preserve tag case
	readonly preserveTagCase;

	// preserve attribute name case
	readonly preserveAttributeCase;

	/**
	 * Define parse settings.
	 * @param tag preserve tag case?
	 * @param attribute preserve attribute name case?
	 */
	constructor(tag: boolean, attribute: boolean) {
		this.preserveTagCase = tag;
		this.preserveAttributeCase = attribute;
	}

	/**
	 * Normalizes a tag name according to the case preservation setting.
	 * @param {string} name attribute key
	 * @return {string}
	 */
	normalizeTag(name: string): string {
		name = Assert.notEmpty(name).trim();
		return !this.preserveTagCase ? name.toLowerCase() : name;
	}

	/**
	 * Normalizes an attribute according to the case preservation setting.
	 * @param {string} name attribute key
	 * @return {string}
	 */
	normalizeAttribute(name: string): string {
		name = Assert.notEmpty(name).trim();
		return !this.preserveAttributeCase ? name.toLowerCase() : name;
	}

	/**
	 * normalizeAttributes
	 */
	normalizeAttributes(attrs: Attributes) {
		attrs = Assert.notNull(attrs);
		return !this.preserveAttributeCase ? attrs.normalize() : attrs;
	}
}
