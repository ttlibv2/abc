import { Assert } from "../helper/Assert";
import { TokenQueue } from "../parse/TokenQueue";
import { AndEval, Evaluator, OrEval } from "./Evaluator";

/**
 * Parses a CSS selector into an Evaluator tree.
 */
export class QueryParser {
    static readonly combinators: string[] = [",", ">", "+", "~", " "];
    static readonly AttributeEvals: string[] = ["=", "!=", "^=", "$=", "*=", "~="];

    readonly tq: TokenQueue;
    readonly query: string;
    readonly evaluators: Evaluator[];

     /**
     * Create a new QueryParser.
     * @param query CSS query
     */
    private constructor(query: string) {
        Assert.notEmpty(query);
        this.query = query.trim();
        this.tq = new TokenQueue(query);
        this.evaluators = [];
    }

    /**
     * Parse the query
     * @return Evaluator
     */
    private parse(): Evaluator {
        this.tq.consumeWhitespace();

        // if starts with a combinator, use root as elements
        if(this.tq.matchesAny(...QueryParser.combinators)) {
            this.evaluators.push(new StructuralEvaluator.Root());
            this.combinator(this.tq.consume());
        }
        else this.findElements();

        while (!this.tq.isEmpty()) {
            let seenWhite = this.tq.consumeWhitespace();
            if (this.tq.matchesAny(...QueryParser.combinators))this.combinator(this.tq.consume());
            else if (seenWhite) this.combinator(' ');
            else this.findElements(); // // E.class, E#id, E[attr] etc. AND --- take next el, #. etc off queue
        }

        if (this.evaluators.length == 1)return this.evaluators[0];
        else return new AndEval(this.evaluators);
    }

    private combinator(combinator: string) {
        this.tq.consumeWhitespace();

        let subQuery:string = this.consumeSubQuery(); // support multi > childs
        
        // the new topmost evaluator
        let rootEval: Evaluator;
        
        // the evaluator the new eval will be combined to. could be root, or rightmost or.
        let currentEval: Evaluator;

        // the evaluator to add into target evaluator
        let newEval = QueryParser.parse(subQuery);
        let replaceRightMost = false;

        if(this.evaluators.length === 1) {
            rootEval = currentEval = this.evaluators[0];

            // make sure OR (,) has precedence:
            if(rootEval instanceof OrEval && combinator !== ',') {
                currentEval = (<any>currentEval).rightMostEvaluator();
                Assert.notNull(currentEval); // rightMost signature can return null (if none set), but always will have one by this point
                replaceRightMost = true;
            }
        }
        else {
            rootEval = currentEval = new AndEval(this.evaluators);
        }

        // clear evaluators
        this.evaluators.splice(0, this.evaluators.length);

        // for most combinators: change the current eval into an AND of the current eval and the new eval
        switch (combinator) {
            case '>':
                currentEval = new AndEval(new ImmediateParentEval(currentEval), newEval);
                break;
            case ' ':
                currentEval = new AndEval(new ParentEval(currentEval), newEval);
                break;
            case '+':
                currentEval = new AndEval(new ImmediatePreviousSiblingEval(currentEval), newEval);
                break;
            case '~':
                currentEval = new AndEval(new PreviousSiblingEval(currentEval), newEval);
                break;
            case ',':
                let or = currentEval instanceof OrEval ? currentEval : new OrEval([currentEval]);
                or.add(newEval);
                currentEval = or;
                break;
            default:
                throw new Error(`SelectorParseException: Unknown combinator '${combinator}'`);
        }


        if (replaceRightMost) (<any>rootEval).replaceRightMostEvaluator(currentEval);
        else rootEval = currentEval;

        //
        this.evaluators.push(rootEval);
    }

    /**
     * Parse a CSS query into an Evaluator.
     * @param query CSS query
     * @return Evaluator
     * @see Selector selector query syntax
     */
    static parse(query: string): Evaluator {
        try {
            let queryParse = new QueryParser(query);
            return queryParse.parse();
        } catch (error) {
            throw new Error(`SelectorParseException: ${error}`);
        }
    }
}