import { StringBuilder } from '../helper/StringBuilder';
import { OutputSetting } from '../parse/Setting';
import { TextNode } from './TextNode';

/**
 * A Character Data node, to support CDATA sections.
 */
export class CDataNode extends TextNode {
	//

	/**
	 * constructor
	 * @param text
	 */
	/* eslint-disable */
	constructor(text: string) {
		super(text);
	}

	nodeName(): string {
		return `#cdata`;
	}

	/** @override */
	outerHtmlHead(accum: StringBuilder, depth: number, setting: OutputSetting): void {
		accum.append('<![CDATA[').append(this.getWholeText());
	}

	/** @override */
	outerHtmlTail(accum: StringBuilder, depth: number, setting: OutputSetting): void {
		accum.append(']]>');
	}
}
