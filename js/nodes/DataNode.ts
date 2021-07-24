import { StringBuilder } from '../helper/StringBuilder';
import { OutputSetting } from '../parse/Setting';
import { LeafNode } from './LeafNode';

/**
 * A data node, for contents of style, script tags etc,
 * where contents should not show in text().
 */
export class DataNode extends LeafNode {
	//

	/**
     Create a new DataNode.
     @param data data contents
     */
	/* eslint-disable */
	constructor(data: string) {
		super(data);
	}

	nodeName(): string {
		return `#data`;
	}

	/**
	 * Get the data contents of this node. Will be unescaped and with original new lines, space etc.
	 * @return data
	 */
	getWholeData(): string {
		return this.coreVal;
	}

	/**
	 * Set the data contents of this node.
	 * @param data unencoded data
	 * @return this node, for chaining
	 */
	setWholeData(data: string): this {
		this.coreVal = data;
		return this;
	}

	outerHtmlHead(accum: StringBuilder, depth: number, setting: OutputSetting): void {
		accum.append(this.getWholeData());
	}

	outerHtmlTail(accum: StringBuilder, depth: number, setting: OutputSetting): void {}
}
