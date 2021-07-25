import { Document } from './nodes/Document';
import { Parser } from './parse/Parser';

/**
 * The core public access point to the jsoup functionality.
 */
export class Jsoup {
	/**
	 * Parse HTML into a Document
	 * @param {string} html    HTML to parse
	 */
	static parse(html: string): Document;

	/**
	 * Parse HTML into a Document
	 * @param {string} html    HTML to parse
	 * @param {string=} baseUri The URL where the HTML was retrieved from.
	 */
	static parse(html: string, baseUri: string): Document;

	/**
	 * Parse HTML into a Document
	 * @param {string} html    HTML to parse
	 * @param {string=} baseUri The URL where the HTML was retrieved from.
	 * @param {Parser=} parser
	 */
	static parse(html: string, baseUri: string, parser: Parser): Document;

	/**
	 * @private
	 * Parse HTML into a Document
	 * @param {string} html    HTML to parse
	 * @param {string=} baseUri The URL where the HTML was retrieved from.
	 * @param {Parser=} parser
	 */
	static parse(html: string, baseUri?: string, parser?: Parser): Document {
		baseUri = baseUri || '';
		parser = parser || Parser.htmlParser();
		return parser.parseDoc(html, baseUri);
	}

	/**
	 * Parse a fragment of HTML, with the assumption that it forms the {@code body} of the HTML.
	 * @param {string} bodyHtml body HTML fragment
	 * @param {string=} baseUri  URL to resolve relative URLs against.
	 * @return sane HTML document
	 */
	parseBodyFragment(bodyHtml: string, baseUri?: string): Document {
		return Parser.parseBodyFragment(bodyHtml, baseUri || '');
	}
}
