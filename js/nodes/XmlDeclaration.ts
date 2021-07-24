import { Assert } from '../helper/Assert';
import { StringBuilder } from '../helper/StringBuilder';
import { OutputSetting } from '../parse/Setting';
import { LeafNode } from './LeafNode';

export class XmlDeclaration extends LeafNode {

		/**
     * Create a new XML declaration
     * @param name of declaration
     * @param isProcessingInstruction is processing instruction
     */
		constructor(name: string, private isProcessingInstruction: boolean) {
			super(Assert.notNull(name));
		}

	nodeName(): string {
		return `#declaration`;
	}

		/**
     * Get the name of this declaration.
     * @return name of this declaration.
     */
		get_name(): string {
			return this.coreVal;
		}

		/**
     * Get the unencoded XML declaration.
     * @return XML declaration
     */
		getWholeDeclaration(): string {
			this.get_attributes().map(attr => {

			});

		}

	outerHtmlHead(accum: StringBuilder, depth: number, setting: OutputSetting): void {
		throw new Error('Method not implemented.');
	}
	outerHtmlTail(accum: StringBuilder, depth: number, setting: OutputSetting): void {
		throw new Error('Method not implemented.');
	}
}
