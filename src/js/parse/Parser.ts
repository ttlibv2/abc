import { Assert } from '../helper/Assert';
import { Document } from '../nodes/Document';
import { Element } from '../nodes/Element';
import { Node } from '../nodes/Node';
import { ParseSetting } from './Setting';
import { ParseErrorList } from './ParseError';
import { Tokeniser } from './Tokeniser';
import { CharacterReader } from './CharacterReader';
import { TreeBuilder } from './TreeBuilder';
import { HtmlBuilder } from './HtmlBuilder';

export class Parser {
	// parse setting
	private parseSetting: ParseSetting;

	// tree builder html
	private treeBuilder: TreeBuilder;

	// error list
	errors: ParseErrorList;

	/**
	 * Create new constructor
	 * @param {TreeBuilder} treeBuilder to use to parse input into Documents.
	 * */
	constructor(treeBuilder: TreeBuilder) {
		Assert.notNull(treeBuilder);
		this.treeBuilder = treeBuilder;
		this.parseSetting = treeBuilder.defaultSetting();
		this.errors = ParseErrorList.noTracking();
	}

	/**
	 * Get parse setting
	 */
	setting(): ParseSetting;

	/**
	 * Set parse setting
	 */
	setting(sett: ParseSetting): this;

	/** @private */
	setting(sett?: ParseSetting): this | ParseSetting {
		if (sett === undefined) return this.parseSetting;
		else {
			this.parseSetting = sett;
			return this;
		}
	}

	/**
	 * Set the parse adapter
	 * @param {TreeBuilder} adapter
	 */
	set_builder(adapter: TreeBuilder) {
		this.treeBuilder = adapter;
		return this;
	}

	/**
	 * Creates a new Parser as a deep copy of this;
	 * including initializing a new TreeBuilder.
	 * Allows independent (multi-threaded) use.
	 * @return a copied parser
	 */
	newInstance(): Parser {
		let builder = this.treeBuilder.newInstance();
		return new Parser(builder);
	}

	/**
	 * Parse html to ducument
	 * @param {string} html
	 * @param {string=} baseUri
	 */
	parseDoc(html: string, baseUri?: string): Document {
		return this.treeBuilder.parse(html, baseUri, this);
	}

	/**
	 * Parse fragment to list node
	 * @param {string} fragmentHtml the fragment of HTML to parse
	 * @param {Element} context
	 * @param {string=} baseUri
	 * @return {Node[]}
	 */
	parseFragment(fragmentHtml: string, context: Element, baseUri?: string): Node[] {
		return this.treeBuilder.parseFragment(fragmentHtml, context, baseUri, this);
	}

	/**
	 * (An internal method, visible for Element. For HTML parse, signals that script
	 * and style text should be treated as Data Nodes).
	 */
	isContentForTagData(normalName: string): boolean {
		return this.treeBuilder.isContentForTagData(normalName);
	}

	//------------------ STATIC FNC --------------------

	/**
	 * Create a new HTML parser. This parser treats input as HTML5, and enforces the creation of a normalised document,
	 * based on a knowledge of the semantics of the incoming tags.
	 * @return a new HTML parser.
	 */
	static htmlParser(): Parser {
		return new Parser(new HtmlBuilder());
	}

	static parse(html: string, baseUri?: string): Document {
		return Parser.htmlParser().parseDoc(html, baseUri);
	}

	static parseBodyFragment(bodyHtml: string, baseUri?: string): Document {
		let doc = Document.createShell(baseUri);
        let body: Element = doc.body();
        let nodes = Parser.parseFragment(bodyHtml, body, baseUri);
		nodes.slice().reverse().forEach(node => node.remove());
		nodes.forEach(node => body.appendChild(node));
        return doc;
	}

	static parseFragment(fragmentHtml: string, context: Element, baseUri: string) {
		let treeBuilder = new HtmlBuilder();
        return treeBuilder.parseFragment(fragmentHtml, context, baseUri, new Parser(treeBuilder));
	}

	/**
	 * Get the parser that was used to make this node,
	 * or the default HTML parser if it has no parent.
	 */
	static getParserForNode(node: Node): Parser {
		let doc = node.ownerDocument();
		return doc?.parser() || Parser.htmlParser();
	}

	/**
	 * Utility method to unescape HTML entities from a string
	 * @param string HTML escaped string
	 * @param inAttribute if the string is to be escaped in strict mode (as attributes are)
	 * @return an unescaped string
	 */
	static unescapeEntities(string: string, inAttribute: boolean) {
		let reader = new CharacterReader(string);
		let tokeniser = new Tokeniser(reader, ParseErrorList.noTracking());
		return tokeniser.unescapeEntities(inAttribute);
	}
}
