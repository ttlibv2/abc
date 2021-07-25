import { Node } from '../nodes/Node';

/**
 * Node visitor interface. Provide an implementing class to {@link NodeTraversor} to iterate through nodes.
 * <p>
 * This interface provides two methods, {@code head} and {@code tail}. The head method is called when the node is first
 * seen, and the tail method when all of the node's children have been visited. As an example, {@code head} can be used to
 * emit a start tag for a node, and {@code tail} to create the end tag.
 * </p>
 */
export interface NodeVisitor {
	/**
     Callback for when a node is first visited.
     <p>The node may be modified (e.g. {@link Node#attr(String)} or replaced {@link Node#replaceWith(Node)}). If it's
     {@code instanceOf Element}, you may cast it to an {@link Element} and access those methods.</p>
     <p>Note that nodes may not be removed during traversal using this method; use {@link
    NodeTraversor#filter(NodeFilter, Node)} with a {@link NodeFilter.FilterResult#REMOVE} return instead.</p>
     @param node the node being visited.
     @param depth the depth of the node, relative to the root node. E.g., the root node has depth 0, and a child node
     of that will have depth 1.
     */
	head(node: Node, depth: number): void;

	/**
     Callback for when a node is last visited, after all of its descendants have been visited.
     <p>Note that replacement with {@link Node#replaceWith(Node)}</p> is not supported in {@code tail}.
     @param node the node being visited.
     @param depth the depth of the node, relative to the root node. E.g., the root node has depth 0, and a child node
     of that will have depth 1.
     */
	tail(node: Node, depth: number): void;
}

export type VisitorArgCb = (node: Node, depth: number) => void;

export class NodeVisitorCallback implements NodeVisitor {
	/**
	 * Create new constructor
	 * @param {VisitorArgCb} headCbFnc
	 * @param {VisitorArgCb=} tailCbFnc
	 */
	constructor(private headCbFnc: VisitorArgCb, private tailCbFnc?: VisitorArgCb) {
		this.headCbFnc = headCbFnc || (() => {});
		this.tailCbFnc = tailCbFnc || (() => {});
	}

	head(node: Node, depth: number): void {
		this.headCbFnc(node, depth);
	}

	tail(node: Node, depth: number): void {
		this.tailCbFnc(node, depth);
	}
}
