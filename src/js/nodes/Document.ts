import { StringBuilder } from '../helper/StringBuilder';
import { Parser } from '../parse/Parser';
import { OutputSetting } from '../parse/Setting';
import { Element } from './Element';

/**
 * A HTML Document.
 */
export class Document extends Element {
	quirksMode(arg0?: any): any {
		throw new Error('Method not implemented.');
	}
	outerHtmlHead(accum: StringBuilder, depth: number, setting: OutputSetting): void {
		throw new Error('Method not implemented.');
	}
	outerHtmlTail(accum: StringBuilder, depth: number, setting: OutputSetting): void {
		throw new Error('Method not implemented.');
	}
	body(): Element {
		throw new Error('Method not implemented.');
	}

	parser(parser?: any): Parser {
		throw new Error('Method not implemented.');
	}

	static fromDomDoc(domDoc: any, baseUri?: string): Document {
		throw new Error('Method not implemented.');
	}
}

export enum QuirksMode {
	noQuirks, quirks, limitedQuirks
}