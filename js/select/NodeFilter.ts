import { Node } from "../nodes/Node";

export interface NodeFilter {

    /**
     * Callback for when a node is first visited.
     * @param node the node being visited.
     * @param depth the depth of the node, relative to the root node. E.g., the root node has depth 0, and a child node of that will have depth 1.
     * @return Filter decision
     */
    head(node: Node, depth: number): NodeFilterResult;

    /**
     * Callback for when a node is last visited, after all of its descendants have been visited.
     * @param node the node being visited.
     * @param depth the depth of the node, relative to the root node. E.g., the root node has depth 0, and a child node of that will have depth 1.
     * @return Filter decision
     */
    tail(node: Node, depth: number): NodeFilterResult;

}

export enum NodeFilterResult {

    /** Continue processing the tree */
    CONTINUE,

    /** Skip the child nodes, but do call {@link NodeFilter#tail(Node, int)} next. */
    SKIP_CHILDREN,

    /** Skip the subtree, and do not call {@link NodeFilter#tail(Node, int)}. */
    SKIP_ENTIRELY,

    /** Remove the node and its children */
    REMOVE,

    /** Stop processing */
    STOP
}