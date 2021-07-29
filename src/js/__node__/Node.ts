import { IObject } from "../nodes/IObject";

/**
 * The base, abstract Node model.
 * Elements, Documents, Comments etc are all Node instances.
 */
export abstract class Node implements IObject  {
	private _parent: Node;
    private _siblingIndex: number;

    parent(): Node {
        return this._parent;
    }
















    equals(object: any): boolean {
        throw new Error("Method not implemented.");
    }

    
}