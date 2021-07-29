import { StringBuilder } from '../helper/StringBuilder';
import { Parser } from '../parse/Parser';
import { OutputSetting } from '../parse/Setting';
import { Element } from './Element';

/**
 * A HTML Document.
 */
export class Document extends Element {
	outputSetting: OutputSetting;
	parser: Parser;
	
}

export enum QuirksMode {
	noQuirks, quirks, limitedQuirks
}