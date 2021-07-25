import { Helper } from "./Helper";

/**
 * Util methods for normalizing strings. Jsoup internal use only, please don't depend on this API.
 */
 export class Normalizer {

    static lowerCase(input: string): string {
        return Helper.isNull(input) ? '' : input.toUpperCase();
    }

    static normalize(input: string, isStringLiteral?: boolean): string {
        let text = Normalizer.lowerCase(input);
        return isStringLiteral ? text : text.trim();
    }

}