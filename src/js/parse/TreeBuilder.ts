import { Assert } from '../helper/Assert';
import { Helper } from '../helper/Helper';
import { Attributes } from '../nodes/Attributes';
import { Document } from '../nodes/Document';
import { Element } from '../nodes/Element';
import { Node } from '../nodes/Node';
import { CharacterReader } from './CharacterReader';
import { ParseError } from './ParseError';
import { Parser } from './Parser';
import { ParseSetting } from './Setting';
import { EndTag, StartTag, Token, TokenType } from './Token';
import { Tokeniser } from './Tokeniser';

export abstract class TreeBuilder {
	reader: CharacterReader;
	tokeniser: Tokeniser;

	protected parser: Parser;
	protected doc: Document;
	protected stack: Element[];
	protected baseUri: string;
	protected currentToken: Token;
	setting: ParseSetting;

	private start = new StartTag();
	private end = new EndTag();

	abstract defaultSetting(): ParseSetting;

	protected initialiseParse(input: string, baseUri: string, parser: Parser): void {
		Assert.notNull(input, 'String input must not be null');
		Assert.notNull(baseUri, 'BaseURI must not be null');
		Assert.notNull(parser);

		this.doc = new Document(baseUri);
		this.doc.parser(parser);
		this.parser = parser;
		this.setting = parser.setting();
		this.reader = new CharacterReader(input);
		this.currentToken = null;
		this.tokeniser = new Tokeniser(this.reader, parser.errors);
		this.stack = Array(32);
		this.baseUri = baseUri;
	}

	protected parse(input: string, baseUri: string, parser: Parser): Document {
		this.initialiseParse(input, baseUri, parser);
		try {
			this.runParser();
		} finally {
			this.reader.close();
			this.reader = null;
			this.tokeniser = null;
			this.stack = null;
		}

		return this.doc;
	}

	/**
	 * Create a new copy of this TreeBuilder
	 * @return copy, ready for a new parse
	 */
	abstract newInstace(): TreeBuilder;

	abstract parseFragment(inputFragment: string, context: Element, baseUri: string, parser: Parser): Node[];

	protected runParser() {
		let tokeniser = this.tokeniser;
		while (true) {
			let token = tokeniser.read();
			this.process(token);
			token.reset();
			if (token.isEOF()) break;
		}
	}

	protected abstract process(token: Token): boolean;

	processStartTag(name: string, attrs?: Attributes): boolean {
		let bool = this.currentToken === this.start;
		let token = bool ? new StartTag() : this.start.reset();
		let hasAttr = Helper.notNull(attrs);
		return this.process(hasAttr ? token.nameAttr(name, attrs) : token.set_tagName(name));
	}

	protected processEndTag(name: string): boolean {
		let bool = this.currentToken === this.end;
		let token = bool ? new EndTag() : this.end.reset();
		return this.process(token.set_tagName(name));
	}

	protected currentElement(): Element {
		let size = this.stack.length;
		return size > 0 ? this.stack[size - 1] : null;
	}

	/**
	 * If the parser is tracking errors, add an error at the current position.
	 * @param msg error message
	 */
	protected error(msg: string | any): void {
		let errors = this.parser.errors;
		if (errors.canAddError()) {
			errors.push(new ParseError(this.reader.pos(), msg));
		}
	}

	/**
	 * (An internal method, visible for Element.
	 * For HTML parse, signals that script and style text should be treated as Data Nodes).
	 */
	protected isContentForTagData(normalName: string): boolean {
		return false;
	}
}
