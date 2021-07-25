import { ParseSetting } from './Setting';
import * as htmlparser2 from 'htmlparser2';
import { Node } from '../nodes/Node';
import { Document } from '../nodes/Document';
import { Element } from '../nodes/Element';

export interface ParseApdater {
	defaultSettings(): ParseSetting;
	newInstance(): ParseApdater;
	parseDoc(html: string, baseUri?: string): Document;
	parseFragment(fragmentHtml: string, context: Element, baseUri?: string): Node[];
	parseBodyFragment(bodyHtml: string, baseUri?: string): Document;
	isContentForTagData(normalName: string): boolean;
}

export class HtmlParse2Adapter implements ParseApdater {
	defaultSettings(): ParseSetting {
		return ParseSetting.htmlDefault;
	}

	newInstance(): HtmlParse2Adapter {
		return new HtmlParse2Adapter();
	}

	/**
	 * Parse html to ducument
	 * @param {string} html
	 * @param {string=} baseUri
	 */
	parseDoc(html: string, baseUri?: string): Document {
		let domDoc = htmlparser2.parseDocument(html, { xmlMode: true });
		return Document.fromDomDoc(domDoc, baseUri);
	}

	/**
	 * Parse fragment to list node
	 * @param {string} fragmentHtml the fragment of HTML to parse
	 * @param {Element} context
	 * @param {string=} baseUri
	 * @return {Node[]}
	 */
	parseFragment(fragmentHtml: string, context: Element, baseUri?: string): Node[] {
		//htmlparser2.parseDocument(fragmentHtml, {xmlMode: true});
		throw new Error('Method not implemented.');
	}

	parseBodyFragment(bodyHtml: string, baseUri?: string): Document {
		throw new Error('Method not implemented.');
	}

	isContentForTagData(normalName: string): boolean {
		return ['script', 'style'].includes(normalName);
	}

	text(node: Node) {
		// htmlparser2.DomUtils.getText()
	}
}
