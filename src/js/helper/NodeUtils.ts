import { CDataNode } from '../nodes/CDataNode';
import { DataNode } from '../nodes/DataNode';
import { Document } from '../nodes/Document';
import { Element } from '../nodes/Element';
import { Elements } from '../nodes/Elements';
import { FormElement } from '../nodes/FormElement';
import { Node } from '../nodes/Node';
import { TextNode } from '../nodes/TextNode';
import { Parser } from '../parse/Parser';
import { OutputSetting } from '../parse/Setting';

export class NodeUtils {
	//

	static isFormElement(node: Node): node is FormElement {
		return node instanceof FormElement;
	}

	static isCDataNode(node: Node): node is CDataNode {
		return node instanceof CDataNode;
	}

	static isDocument(node: Node): node is Document {
		return node instanceof Document;
	}

	static isElement(node: any): node is Element {
		return node instanceof Element;
	}

	static isTextNode(node: Node): node is TextNode {
		return node instanceof TextNode;
	}

	static isNode(node: Node): node is Node {
		return node instanceof Node;
	}

	static isElements(node: any): node is Elements {
		return node instanceof Elements;
	}

	static isDataNode(node: Node): node is DataNode {
		return node instanceof DataNode;
	}

	/**
	 * Get the parser that was used to make this node,
	 * or the default HTML parser if it has no parent.
	 */
	static parser(node: Node): Parser {
		let doc = node.ownerDocument();
		return doc?.parser() || Parser.htmlParser();
	}

	/**
	 * Get the output setting for this node,  or if this node has no document
	 * (or parent), retrieve the default output
	 * settings
	 */
	static outputSettings(node: Node): OutputSetting {
		let owner = node.ownerDocument() || new Document('');
		return owner.outputSetting;
	}
}
