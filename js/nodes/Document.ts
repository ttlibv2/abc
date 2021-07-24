import { Parser } from '../parse/Parser';
import { Element } from './Element';

/**
 * A HTML Document.
 */
export class Document extends Element {
	body(): Element {
		throw new Error('Method not implemented.');
	}

	parser(): Parser {
		throw new Error('Method not implemented.');
	}

	static fromDomDoc(domDoc: any, baseUri?: string): Document {
		throw new Error('Method not implemented.');
	}
}
