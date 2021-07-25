import { StringReader } from '../helper/CharacterReader';
import { Parser } from './Parser';
import { Tokeniser } from './Tokeniser';

export abstract class TreeBuilder {
	parser: Parser;
	reader: StringReader;
	tokeniser: Tokeniser;
}
