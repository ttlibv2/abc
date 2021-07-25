import { NodeUtils } from '../helper/NodeUtils';
import { StringBuilder } from '../helper/StringBuilder';
import { Parser } from '../parse/Parser';
import { OutputSetting, ParseSetting } from '../parse/Setting';
import { LeafNode } from './LeafNode';
import { XmlDeclaration } from './XmlDeclaration';

/**
 * A comment node.
 */
export class Comment extends LeafNode {
	//

	/* eslint-disable */
	constructor(data: string) {
		super(data);
	}

	nodeName(): string {
		return '#comment';
	}

	/**
	 * Get the contents of the comment.
	 * @return comment content
	 */
	get_data(): string {
		return this.coreVal;
	}

	set_data(data: string): this {
		this.coreVal = data;
		return this;
	}

	/**
	 * Check if this comment looks like an XML Declaration.
	 * @return true if it looks like, maybe, it's an XML Declaration.
	 */
	isXmlDeclaration() {
		let data = this.get_data();
		return Comment.isXmlDeclarationData(data);
	}

	outerHtmlHead(accum: StringBuilder, depth: number, setting: OutputSetting): void {
		let pretty = setting.prettyPrint;
		let parent = this.parentNode;
		let isIf0 = () =>
			this.getSiblingIndex() === 0 &&
			NodeUtils.isElement(parent) &&
			parent.get_tag().formatAsBlock;

		if (pretty && isIf0() && setting.outline) {
			this.indent(accum, depth, setting);
			accum.append(`<!-- `).append(this.get_data()).append(` -->`);
		}

		//
	}

	outerHtmlTail(accum: StringBuilder, depth: number, setting: OutputSetting): void {}

	private static isXmlDeclarationData(data: string): boolean {
		return data.length > 1 && (data.startsWith('!') || data.startsWith('?'));
	}

	/**
	 * Attempt to cast this comment to an XML Declaration node.
	 * @return an XML declaration if it could be parsed as one, null otherwise.
	 */
	asXmlDeclaration(): any {
		let data = this.get_data();

		//
		let declContent = data.substring(1, data.length - 1);
		if (Comment.isXmlDeclarationData(declContent)) return null;

		//
		let fragment = `<${declContent}>`;

		// use the HTML parser not XML, so we don't get into a recursive XML Declaration on contrived data
		let doc = Parser.htmlParser()
			.setting(ParseSetting.preserveCase)
			.parseDoc(fragment, this.baseUri());

		if (doc.body().children().size() === 0) return null;
		else {
			let el = doc.body().child(0);
			let decl = new XmlDeclaration(
				doc.parser().setting().normalizeTag(el.tagName()),
				data.startsWith('!'),
			);

			decl.get_attributes().addAll(el.get_attributes());
			return decl;
		}
	}
}
