/*eslint-disable*/

import * as TK from './Token';
import { Helper } from '../helper/Helper';
import { HtmlBuilder } from './HtmlBuilder';
import { TokeniserState } from './TokeniserState';
import { DocumentType } from '../nodes/DocumentType';
import { QuirksMode } from '../nodes/Document';
import { Char } from '../helper/Char';
import { Element } from '../nodes/Element';
import { Attributes } from '../nodes/Attributes';
import { ParseSetting } from './Setting';
import { Tag } from './Tag';
const { inSorted, equalsIgnoreCase, notNull } = Helper;

export abstract class HtmlState {

	static readonly nullString: string = Char.Default.string;

	abstract process(t: TK.Token, tb: HtmlBuilder): boolean;

	equals(o: any): boolean {
		return this === o;
	}

	static isWhitespace(t: TK.Token | string): boolean {
		if (typeof t === 'string') return Helper.isBlank(t);
		else if (!t.isCharacter()) return false;
		else {
			let data = t.asCharacter().getData();
			return Helper.isBlank(data);
		}
	}

	static handleRcData(startTag: TK.StartTag, tb: HtmlBuilder): void {
		tb.tokeniser.transition(TokeniserState.Rcdata);
		tb.markInsertionMode();
		tb.transition(HtmlState_Text.instance);
		tb.insert(startTag);
	}

	static handleRawtext(startTag: TK.StartTag, tb: HtmlBuilder) {
		tb.tokeniser.transition(TokeniserState.Rawtext);
		tb.markInsertionMode();
		tb.transition(HtmlState_Text.instance);
		tb.insert(startTag);
	}

	// lists of tags to search through
	static Constants: { [key: string]: string[] } = {
		InHeadEmpty: ["base", "basefont", "bgsound", "command", "link"],
		InHeadRaw: ["noframes", "style"],
		InHeadEnd: ["body", "br", "html"],
		AfterHeadBody: ["body", "html"],
		BeforeHtmlToHead: ["body", "br", "head", "html",],
		InHeadNoScriptHead: ["basefont", "bgsound", "link", "meta", "noframes", "style"],
		InBodyStartToHead: ["base", "basefont", "bgsound", "command", "link", "meta", "noframes", "script", "style", "title"],
		InBodyStartPClosers: ["address", "article", "aside", "blockquote", "center", "details", "dir", "div", "dl", "fieldset", "figcaption", "figure", "footer", "header", "hgroup", "menu", "nav", "ol", "p", "section", "summary", "ul"],
		Headings: ["h1", "h2", "h3", "h4", "h5", "h6"],
		InBodyStartLiBreakers: ["address", "div", "p"],
		DdDt: ["dd", "dt"],
		Formatters: ["b", "big", "code", "em", "font", "i", "s", "small", "strike", "strong", "tt", "u"],
		InBodyStartApplets: ["applet", "marquee", "object"],
		InBodyStartEmptyFormatters: ["area", "br", "embed", "img", "keygen", "wbr"],
		InBodyStartMedia: ["param", "source", "track"],
		InBodyStartInputAttribs: ["action", "name", "prompt"],
		InBodyStartDrop: ["caption", "col", "colgroup", "frame", "head", "tbody", "td", "tfoot", "th", "thead", "tr"],
		InBodyEndClosers: ["address", "article", "aside", "blockquote", "button", "center", "details", "dir", "div", "dl", "fieldset", "figcaption", "figure", "footer", "header", "hgroup", "listing", "menu", "nav", "ol", "pre", "section", "summary", "ul"],
		InBodyEndAdoptionFormatters: ["a", "b", "big", "code", "em", "font", "i", "nobr", "s", "small", "strike", "strong", "tt", "u"],
		InBodyEndTableFosters: ["table", "tbody", "tfoot", "thead", "tr"],
		InTableToBody: ["tbody", "tfoot", "thead"],
		InTableAddBody: ["td", "th", "tr"],
		InTableToHead: ["script", "style"],
		InCellNames: ["td", "th"],
		InCellBody: ["body", "caption", "col", "colgroup", "html"],
		InCellTable: ["table", "tbody", "tfoot", "thead", "tr"],
		InCellCol: ["caption", "col", "colgroup", "tbody", "td", "tfoot", "th", "thead", "tr"],
		InTableEndErr: ["body", "caption", "col", "colgroup", "html", "tbody", "td", "tfoot", "th", "thead", "tr"],
		InTableFoster: ["table", "tbody", "tfoot", "thead", "tr"],
		InTableBodyExit: ["caption", "col", "colgroup", "tbody", "tfoot", "thead"],
		InTableBodyEndIgnore: ["body", "caption", "col", "colgroup", "html", "td", "th", "tr"],
		InRowMissing: ["caption", "col", "colgroup", "tbody", "tfoot", "thead", "tr"],
		InRowIgnore: ["body", "caption", "col", "colgroup", "html", "td", "th"],
		InSelectEnd: ["input", "keygen", "textarea"],
		InSelecTableEnd: ["caption", "table", "tbody", "td", "tfoot", "th", "thead", "tr"],
		InTableEndIgnore: ["tbody", "tfoot", "thead"],
		InHeadNoscriptIgnore: ["head", "noscript"],
		InCaptionIgnore: ["body", "col", "colgroup", "html", "tbody", "td", "tfoot", "th", "thead", "tr"]
	};
}

class HtmlState_Initial extends HtmlState {

	static instance = new HtmlState_Initial();


	process(t: TK.Token, tb: HtmlBuilder): boolean {
		// ignore whitespace until we get the first content
		if (HtmlState.isWhitespace(t)) {
			return true;
		}

		// comment
		else if (t.isComment()) {
			tb.insert(t.asComment());
			return true;
		}

		else if (t.isDoctype()) {
			// todo: parse error check on expected doctypes
			// todo: quirk state check on doctype ids
			let d = t.asDoctype();
			let doctype = new DocumentType(tb.setting.normalizeTag(d.getName()),
				d.getPublicIdentifier(), d.getSystemIdentifier())
				.setPubSysKey(d.getPubSysKey());

			tb.getDocument().appendChild(doctype);
			if (d.isForceQuirks()) tb.getDocument().quirksMode(QuirksMode.quirks);
			tb.transition(HtmlState_BeforeHtml.instance);
			return true;
		}

		else {
			// todo: check not iframe srcdoc
			tb.transition(HtmlState_BeforeHtml.instance);
			return tb.process(t); // re-process token
		}
	}


}

class HtmlState_BeforeHtml extends HtmlState {
	static instance = new HtmlState_BeforeHtml();

	process(t: TK.Token, tb: HtmlBuilder): boolean {

		if (t.isDoctype()) {
			tb.error(this);
			return false;
		}

		else if (t.isComment()) {
			tb.insert(t.asComment());
			return true;
		}

		else if (HtmlState.isWhitespace(t)) {
			tb.insert(t.asCharacter()); // out of spec - include whitespace
			return true;
		}

		else if (t.isStartTag() && t.asStartTag().normalName() === 'html') {
			tb.insert(t.asStartTag());
			tb.transition(HtmlState_BeforeHead.instance);
			return true;
		}

		else if (t.isEndTag() && (Helper.inSorted(t.asEndTag().normalName(), HtmlState.Constants.BeforeHtmlToHead))) {
			return this.anythingElse(t, tb);
		}

		else if (t.isEndTag()) {
			tb.error(this);
			return false;
		}

		else {
			return this.anythingElse(t, tb);
		}

	}

	anythingElse(t: TK.Token, tb: HtmlBuilder): boolean {
		tb.insertStartTag("html");
		tb.transition(HtmlState_BeforeHead.instance);
		return tb.process(t);
	}


}

class HtmlState_BeforeHead extends HtmlState {
	static instance = new HtmlState_BeforeHead();

	process(t: TK.Token, tb: HtmlBuilder): boolean {
		if (HtmlState.isWhitespace(t)) {
			tb.insert(t.asCharacter()); // out of spec - include whitespace
		}

		else if (t.isComment()) {
			tb.insert(t.asComment());
		}

		else if (t.isDoctype()) {
			tb.error(this);
			return false;
		}

		else if (t.isStartTag() && t.asStartTag().normalName() == 'html') {
			return HtmlState_InBody.instance.process(t, tb); // does not transition
		}

		else if (t.isStartTag() && t.asStartTag().normalName() == 'head') {
			let head = tb.insert(t.asStartTag());
			tb.setHeadElement(head);
			tb.transition(HtmlState_InHead.instance);
		}

		else if (t.isEndTag() && (inSorted(t.asEndTag().normalName(), HtmlState.Constants.BeforeHtmlToHead))) {
			tb.processStartTag("head");
			return tb.process(t);
		}

		else if (t.isEndTag()) {
			tb.error(this);
			return false;
		}

		else {
			tb.processStartTag("head");
			return tb.process(t);
		}

		return true;
	}
}

class HtmlState_InHead extends HtmlState {
	static instance = new HtmlState_InHead();

	process(t: TK.Token, tb: HtmlBuilder): boolean {

		if (HtmlState.isWhitespace(t)) {
			tb.insert(t.asCharacter()); // out of spec - include whitespace
			return true;
		}

		switch (t.tokenType) {
			case TK.TokenType.Comment: tb.insert(t.asComment()); break;
			case TK.TokenType.Doctype: tb.error(this); return false;
			case TK.TokenType.StartTag: return this.handleStartTag(t, tb);
			case TK.TokenType.EndTag: return this.handleEndTag(t, tb);
			default: return this.anythingElse(t, tb);
		}
		return true;
	}

	private handleStartTag(t: TK.Token, tb: HtmlBuilder) {
		let start = t.asStartTag();
		let name = start.normalName();

		// html
		if (name === 'html') {
			return HtmlState_InBody.instance.process(t, tb);
		}

		// InHeadEmpty
		else if (inSorted(name, HtmlState.Constants.InHeadEmpty)) {
			let el = tb.insertEmpty(start);
			// jsoup special: update base the first time it is seen
			if (name === 'base' && el.hasAttr("href")) tb.maybeSetBaseUri(el);
		}

		// meta
		else if (name === 'meta') {
			tb.insertEmpty(start);
			// todo: charset switches
		}

		// title
		else if (name === 'title') {
			HtmlState.handleRcData(start, tb);
		}
		else if (inSorted(name, HtmlState.Constants.InHeadRaw)) {
			HtmlState_InHead.handleRawtext(start, tb);
		}
		else if (name === 'noscript') {
			// else if noscript && scripting flag = true: rawtext (jsoup doesn't run script, to handle as noscript)
			tb.insert(start);
			tb.transition(HtmlState_InHeadNoscript.instance);
		}
		else if (name === 'script') {
			// skips some script rules as won't execute them

			tb.tokeniser.transition(TokeniserState.ScriptData);
			tb.markInsertionMode();
			tb.transition(HtmlState_Text.instance);
			tb.insert(start);
		}
		else if (name === 'head') {
			tb.error(this);
			return false;
		} else {
			return this.anythingElse(t, tb);
		}

		return true;
	}

	private handleEndTag(t: TK.Token, tb: HtmlBuilder) {
		let name = t.asEndTag().normalName();
		if (name === 'head') {
			tb.pop();
			tb.transition(HtmlState_AfterHead.instance);
		}

		else if (inSorted(name, HtmlState_InHead.Constants.InHeadEnd)) {
			return this.anythingElse(t, tb);
		}

		else {
			tb.error(this);
			return false;
		}
		return true;
	}


	private anythingElse(t: TK.Token, tb: HtmlBuilder): boolean {
		tb.processEndTag("head");
		return tb.process(t);
	}


}

class HtmlState_InHeadNoscript extends HtmlState {
	static instance = new HtmlState_InHeadNoscript();

	process(t: TK.Token, tb: HtmlBuilder): boolean {
		if (t.isDoctype()) {
			tb.error(this);
		}
		else if (t.isStartTag() && t.asStartTag().normalName() === ("html")) {
			return tb.process(t, HtmlState_InBody.instance);
		}
		else if (t.isEndTag() && t.asEndTag().normalName() === ("noscript")) {
			tb.pop();
			tb.transition(HtmlState_InHead.instance);
		}
		else if (HtmlState_InHeadNoscript.isWhitespace(t) || t.isComment() || (t.isStartTag() && inSorted(t.asStartTag().normalName(), HtmlState.Constants.InHeadNoScriptHead))) {
			return tb.process(t, HtmlState_InHead.instance);
		}
		else if (t.isEndTag() && t.asEndTag().normalName() === ("br")) {
			return this.anythingElse(t, tb);
		}
		else if ((t.isStartTag() && inSorted(t.asStartTag().normalName(), HtmlState.Constants.InHeadNoscriptIgnore)) || t.isEndTag()) {
			tb.error(this);
			return false;
		} else {
			return this.anythingElse(t, tb);
		}
		return true;
	}
	private anythingElse(t: TK.Token, tb: HtmlBuilder): boolean {
		// note that this deviates from spec, which is to pop out of noscript and reprocess in head:
		// https://html.spec.whatwg.org/multipage/parsing.html#parsing-main-inheadnoscript
		// allows content to be inserted as data
		tb.error(this);
		tb.insert(new TK.Character().data(t.toString()));
		return true;
	}
}

class HtmlState_AfterHead extends HtmlState {
	static instance = new HtmlState_AfterHead();

	process(t: TK.Token, tb: HtmlBuilder): boolean {
		if (HtmlState_AfterHead.isWhitespace(t)) {
			tb.insert(t.asCharacter());
		} else if (t.isComment()) {
			tb.insert(t.asComment());
		} else if (t.isDoctype()) {
			tb.error(this);
		} else if (t.isStartTag()) {
			let startTag = t.asStartTag();
			let name = startTag.normalName();
			if (name === ("html")) {
				return tb.process(t, HtmlState_InBody.instance);
			} else if (name === ("body")) {
				tb.insert(startTag);
				tb.framesetOk = false;
				tb.transition(HtmlState_InBody.instance);
			} else if (name === ("frameset")) {
				tb.insert(startTag);
				tb.transition(HtmlState_InFrameset.instance);
			} else if (inSorted(name, HtmlState.Constants.InBodyStartToHead)) {
				tb.error(this);
				let head = tb.getHeadElement();
				tb.push(head);
				tb.process(t, HtmlState_InHead.instance);
				tb.removeFromStack(head);
			} else if (name === ("head")) {
				tb.error(this);
				return false;
			} else {
				this.anythingElse(t, tb);
			}
		} else if (t.isEndTag()) {
			if (inSorted(t.asEndTag().normalName(), HtmlState.Constants.AfterHeadBody)) {
				this.anythingElse(t, tb);
			} else {
				tb.error(this);
				return false;
			}
		} else {
			this.anythingElse(t, tb);
		}
		return true;
	}

	private anythingElse(t: TK.Token, tb: HtmlBuilder): boolean {
		tb.processStartTag("body");
		tb.framesetOk = true;
		return tb.process(t);
	}
}

class HtmlState_InBody extends HtmlState {
	static instance = new HtmlState_InBody();

	process(t: TK.Token, tb: HtmlBuilder): boolean {
		switch (t.tokenType) {
			case TK.TokenType.Character: {
				let c = t.asCharacter();
				if (c.getData() === HtmlState_InBody.nullString) {
					// todo confirm that check
					tb.error(this);
					return false;
				} else if (tb.framesetOk && HtmlState_InBody.isWhitespace(c)) { // don't check if whitespace if frames already closed
					tb.reconstructFormattingElements();
					tb.insert(c);
				} else {
					tb.reconstructFormattingElements();
					tb.insert(c);
					tb.framesetOk = false;
				}
				break;
			}
			case TK.TokenType.Comment: {
				tb.insert(t.asComment());
				break;
			}
			case TK.TokenType.Doctype: {
				tb.error(this);
				return false;
			}
			case TK.TokenType.StartTag:
				return this.inBodyStartTag(t, tb);
			case TK.TokenType.EndTag:
				return this.inBodyEndTag(t, tb);
			case TK.TokenType.EOF:
				// todo: error if stack contains something not dd, dt, li, p, tbody, td, tfoot, th, thead, tr, body, html
				// stop parsing
				break;
		}
		return true;
	}

	private inBodyStartTag(t: TK.Token, tb: HtmlBuilder): boolean {
		let startTag: TK.StartTag = t.asStartTag();
		let name: string = startTag.normalName();
		let stack: Element[] = [];
		let el: Element = null;

		switch (name) {
			case "a":
				let eEl = tb.getActiveFormattingElement("a");
				if (Helper.notNull(eEl)) {
					tb.error(this);
					tb.processEndTag("a");

					// still on stack?
					let remainingA = tb.getFromStack("a");
					if (Helper.notNull(remainingA)) {
						tb.removeFromActiveFormattingElements(remainingA);
						tb.removeFromStack(remainingA);
					}
				}

				tb.reconstructFormattingElements();
				el = tb.insert(startTag);
				tb.pushActiveFormattingElements(el);
				break;
			case "span":
				// same as final else, but short circuits lots of checks
				tb.reconstructFormattingElements();
				tb.insert(startTag);
				break;
			case "li":
				tb.framesetOk = false;
				for (let i = tb.stackSize - 1; i > 0; i--) {
					el = tb.get_stack()[i];
					if (el.normalName() === 'li') {
						tb.processEndTag("li");
						break;
					}
					if (tb.isSpecial(el) && !inSorted(el.normalName(), HtmlState_InBody.Constants.InBodyStartLiBreakers))
						break;
				}
				if (tb.inButtonScope("p")) {
					tb.processEndTag("p");
				}
				tb.insert(startTag);
				break;
			case "html":
				tb.error(this);
				// merge attributes onto real html
				let html = tb.get_stack()[0];
				if (startTag.hasAttributes()) {
					for (let attribute of startTag.attributes.get_all()) {
						if (!html.hasAttr(attribute.get_key()))
							html.get_attributes().put(attribute);
					}
				}
				break;
			case "body":
				tb.error(this);
				stack = tb.get_stack();
				if (stack.length === 1 || (stack.length > 2 && stack[1].normalName() !== 'body')) {
					// only in fragment case
					return false; // ignore
				}
				else {
					tb.framesetOk = false;
					let body = stack[1];
					if (startTag.hasAttributes()) {
						for (let attribute of startTag.attributes.get_all()) {
							if (!body.hasAttr(attribute.get_key()))
								body.get_attributes().put(attribute);
						}
					}
				}
				break;
			case "frameset":
				tb.error(this);
				stack = tb.getStack();
				if (stack.length === 1 || (stack.length > 2 && stack[0].normalName() !== 'body')) {
					// only in fragment case
					return false; // ignore
				}
				else if (!tb.framesetOk) {
					return false; // ignore frameset
				}
				else {
					let second = stack[1];
					if (Helper.notNull(second.parentNode)) second.remove();
					// pop up to html element
					while (stack.length > 1) stack.pop();
					tb.insert(startTag);
					tb.transition(HtmlState_InFrameset.instance);
				}
				break;
			case "form":
				if (tb.getFormElement() != null) {
					tb.error(this);
					return false;
				}
				if (tb.inButtonScope("p")) {
					tb.processEndTag("p");
				}
				tb.insertForm(startTag, true);
				break;
			case "plaintext":
				if (tb.inButtonScope("p")) {
					tb.processEndTag("p");
				}
				tb.insert(startTag);
				tb.tokeniser.transition(TokeniserState.PLAINTEXT); // once in, never gets out
				break;
			case "button":
				if (tb.inButtonScope("button")) {
					// close and reprocess
					tb.error(this);
					tb.processEndTag("button");
					tb.process(startTag);
				} else {
					tb.reconstructFormattingElements();
					tb.insert(startTag);
					tb.framesetOk = false;
				}
				break;
			case "nobr":
				tb.reconstructFormattingElements();
				if (tb.inScope("nobr")) {
					tb.error(this);
					tb.processEndTag("nobr");
					tb.reconstructFormattingElements();
				}
				el = tb.insert(startTag);
				tb.pushActiveFormattingElements(el);
				break;
			case "table":
				if (tb.getDocument().quirksMode() !== QuirksMode.quirks && tb.inButtonScope("p")) {
					tb.processEndTag("p");
				}
				tb.insert(startTag);
				tb.framesetOk = false;
				tb.transition(HtmlState_InTable.instance);
				break;
			case "input":
				tb.reconstructFormattingElements();
				el = tb.insertEmpty(startTag);
				if (!equalsIgnoreCase(el.attr("type"), "hidden"))
					tb.framesetOk = false;
				break;
			case "hr":
				if (tb.inButtonScope("p")) {
					tb.processEndTag("p");
				}
				tb.insertEmpty(startTag);
				tb.framesetOk = false;
				break;
			case "image":
				if (tb.getFromStack("svg") == null)
					return tb.process(startTag.set_tagName("img")); // change <image> to <img>, unless in svg
				else
					tb.insert(startTag);
				break;
			case "isindex":
				// how much do we care about the early 90s?
				tb.error(this);
				if (tb.getFormElement() != null)
					return false;

				tb.processStartTag("form");
				if (startTag.hasAttribute("action")) {
					let form = tb.getFormElement();
					form.attr(startTag.attributes.get("action"));
				}

				tb.processStartTag("hr");
				tb.processStartTag("label");

				// hope you like english.
				let hasAttr = startTag.hasAttribute("prompt");
				let prompt = hasAttr ? startTag.get_attr('prompt') : 'This is a searchable index. Enter search keywords:';
				tb.process(new TK.Character().data(prompt));

				// input
				let inputAttribs = new Attributes();
				if (startTag.hasAttributes()) {
					for (let attr of startTag.attributes.get_all()) {
						if (!inSorted(attr.get_key(), HtmlState_InBody.Constants.InBodyStartInputAttribs))
							inputAttribs.put(attr);
					}
				}
				inputAttribs.put("name", "isindex");
				tb.processStartTag("input", inputAttribs);
				tb.processEndTag("label");
				tb.processStartTag("hr");
				tb.processEndTag("form");
				break;
			case "textarea":
				tb.insert(startTag);
				if (!startTag.isSelfClosing()) {
					tb.tokeniser.transition(TokeniserState.Rcdata);
					tb.markInsertionMode();
					tb.framesetOk = false;
					tb.transition(HtmlState_Text.instance);
				}
				break;
			case "xmp":
				if (tb.inButtonScope("p")) tb.processEndTag("p");
				tb.reconstructFormattingElements();
				tb.framesetOk = false;
				HtmlState_InBody.handleRawtext(startTag, tb);
				break;
			case "iframe":
				tb.framesetOk = false;
				HtmlState_InBody.handleRawtext(startTag, tb);
				break;
			case "noembed":
				// also handle noscript if script enabled
				HtmlState_InBody.handleRawtext(startTag, tb);
				break;
			case "select":
				tb.reconstructFormattingElements();
				tb.insert(startTag);
				tb.framesetOk = false;

				if (tb.state.equals(HtmlState_InTable.instance)
					|| tb.state.equals(HtmlState_InCaption.instance)
					|| tb.state.equals(HtmlState_InTableBody.instance)
					|| tb.state.equals(HtmlState_InRow.instance)
					|| tb.state.equals(HtmlState_InCell.instance))
					tb.transition(HtmlState_InSelectInTable.instance);
				else
					tb.transition(HtmlState_InSelect.instance);
				break;
			case "math":
				tb.reconstructFormattingElements();
				// todo: handle A start tag whose tag name is "math" (i.e. foreign, mathml)
				tb.insert(startTag);
				break;
			case "svg":
				tb.reconstructFormattingElements();
				// todo: handle A start tag whose tag name is "svg" (xlink, svg)
				tb.insert(startTag);
				break;
			// static final String[] Headings = new String[]{"h1", "h2", "h3", "h4", "h5", "h6"};
			case "h1":
			case "h2":
			case "h3":
			case "h4":
			case "h5":
			case "h6":
				if (tb.inButtonScope("p")) {
					tb.processEndTag("p");
				}
				if (inSorted(tb.currentElement().normalName(), HtmlState_InBody.Constants.Headings)) {
					tb.error(this);
					tb.pop();
				}
				tb.insert(startTag);
				break;
			// static final String[] InBodyStartPreListing = new String[]{"listing", "pre"};
			case "pre":
			case "listing":
				if (tb.inButtonScope("p")) {
					tb.processEndTag("p");
				}
				tb.insert(startTag);
				tb.reader.matchConsume("\n"); // ignore LF if next token
				tb.framesetOk = false;
				break;
			// static final String[] DdDt = new String[]{"dd", "dt"};
			case "dd":
			case "dt":
				tb.framesetOk = false;
				stack = tb.getStack();
				for (let i = stack.length - 1; i > 0; i--) {
					el = stack[i];
					if (inSorted(el.normalName(), HtmlState_InBody.Constants.DdDt)) {
						tb.processEndTag(el.normalName());
						break;
					}
					if (tb.isSpecial(el) && !inSorted(el.normalName(), HtmlState_InBody.Constants.InBodyStartLiBreakers))
						break;
				}
				if (tb.inButtonScope("p")) {
					tb.processEndTag("p");
				}
				tb.insert(startTag);
				break;
			// static final String[] InBodyStartOptions = new String[]{"optgroup", "option"};
			case "optgroup":
			case "option":
				if (tb.currentElement().normalName() === 'option')
					tb.processEndTag("option");
				tb.reconstructFormattingElements();
				tb.insert(startTag);
				break;
			// static final String[] InBodyStartRuby = new String[]{"rp", "rt"};
			case "rp":
			case "rt":
				if (tb.inScope("ruby")) {
					tb.generateImpliedEndTags();
					if (tb.currentElement().normalName() !== 'ruby') {
						tb.error(this);
						tb.popStackToBefore("ruby"); // i.e. close up to but not include name
					}
					tb.insert(startTag);
				}
				// todo - is this right? drops rp, rt if ruby not in scope?
				break;
			default:
				// todo - bring scan groups in if desired
				if (inSorted(name, HtmlState_InBody.Constants.InBodyStartEmptyFormatters)) {
					tb.reconstructFormattingElements();
					tb.insertEmpty(startTag);
					tb.framesetOk = false;
				} else if (inSorted(name, HtmlState_InBody.Constants.InBodyStartPClosers)) {
					if (tb.inButtonScope("p")) {
						tb.processEndTag("p");
					}
					tb.insert(startTag);
				} else if (inSorted(name, HtmlState_InBody.Constants.InBodyStartToHead)) {
					return tb.process(t, HtmlState_InHead.instance);
				} else if (inSorted(name, HtmlState_InBody.Constants.Formatters)) {
					tb.reconstructFormattingElements();
					el = tb.insert(startTag);
					tb.pushActiveFormattingElements(el);
				} else if (inSorted(name, HtmlState_InBody.Constants.InBodyStartApplets)) {
					tb.reconstructFormattingElements();
					tb.insert(startTag);
					tb.insertMarkerToFormattingElements();
					tb.framesetOk = false;
				} else if (inSorted(name, HtmlState_InBody.Constants.InBodyStartMedia)) {
					tb.insertEmpty(startTag);
				} else if (inSorted(name, HtmlState_InBody.Constants.InBodyStartDrop)) {
					tb.error(this);
					return false;
				} else {
					tb.reconstructFormattingElements();
					tb.insert(startTag);
				}
		}
		return true;
	}

	private inBodyEndTag(t: TK.Token, tb: HtmlBuilder): boolean {
		let endTag = t.asEndTag();
		let name = endTag.normalName();

		switch (name) {
			case "sarcasm": // *sigh*
			case "span":
				// same as final fall through, but saves short circuit
				return this.anyOtherEndTag(t, tb);
			case "li":
				if (!tb.inListItemScope(name)) {
					tb.error(this);
					return false;
				} else {
					tb.generateImpliedEndTags(name);
					if (tb.currentElement().normalName() !== name)
						tb.error(this);
					tb.popStackToClose(name);
				}
				break;
			case "body":
				if (!tb.inScope("body")) {
					tb.error(this);
					return false;
				} else {
					// todo: error if stack contains something not dd, dt, li, optgroup, option, p, rp, rt, tbody, td, tfoot, th, thead, tr, body, html
					tb.transition(HtmlState_AfterBody.instance);
				}
				break;
			case "html":
				let notIgnored = tb.processEndTag("body");
				if (notIgnored) return tb.process(endTag);
				break;
			case "form":
				let currentForm = tb.getFormElement();
				tb.setFormElement(null);
				if (currentForm == null || !tb.inScope(name)) {
					tb.error(this);
					return false;
				} else {
					tb.generateImpliedEndTags();
					if (tb.currentElement().normalName() !== name)
						tb.error(this);
					// remove currentForm from stack. will shift anything under up.
					tb.removeFromStack(currentForm);
				}
				break;
			case "p":
				if (!tb.inButtonScope(name)) {
					tb.error(this);
					tb.processStartTag(name); // if no p to close, creates an empty <p></p>
					return tb.process(endTag);
				} else {
					tb.generateImpliedEndTags(name);
					if (tb.currentElement().normalName() !== name)
						tb.error(this);
					tb.popStackToClose(name);
				}
				break;
			case "dd":
			case "dt":
				if (!tb.inScope(name)) {
					tb.error(this);
					return false;
				} else {
					tb.generateImpliedEndTags(name);
					if (tb.currentElement().normalName() !== name)
						tb.error(this);
					tb.popStackToClose(name);
				}
				break;
			case "h1":
			case "h2":
			case "h3":
			case "h4":
			case "h5":
			case "h6":
				if (!tb.inScope(HtmlState_InBody.Constants.Headings)) {
					tb.error(this);
					return false;
				} else {
					tb.generateImpliedEndTags(name);
					if (tb.currentElement().normalName() !== name)
						tb.error(this);
					tb.popStackToClose(...HtmlState_InBody.Constants.Headings);
				}
				break;
			case "br":
				tb.error(this);
				tb.processStartTag("br");
				return false;
			default:
				// todo - move rest to switch if desired
				if (inSorted(name, HtmlState_InBody.Constants.InBodyEndAdoptionFormatters)) {
					return this.inBodyEndTagAdoption(t, tb);
				} else if (inSorted(name, HtmlState_InBody.Constants.InBodyEndClosers)) {
					if (!tb.inScope(name)) {
						// nothing to close
						tb.error(this);
						return false;
					} else {
						tb.generateImpliedEndTags();
						if (tb.currentElement().normalName() !== name)
							tb.error(this);
						tb.popStackToClose(name);
					}
				} else if (inSorted(name, HtmlState_InBody.Constants.InBodyStartApplets)) {
					if (!tb.inScope("name")) {
						if (!tb.inScope(name)) {
							tb.error(this);
							return false;
						}
						tb.generateImpliedEndTags();
						if (tb.currentElement().normalName() !== name)
							tb.error(this);
						tb.popStackToClose(name);
						tb.clearFormattingElementsToLastMarker();
					}
				} else {
					return this.anyOtherEndTag(t, tb);
				}
		}
		return true;
	}

	private anyOtherEndTag(t: TK.Token, tb: HtmlBuilder): boolean {
		let name = t.asEndTag().normalName(); // case insensitive search - goal is to preserve output case, not for the parse to be case sensitive
		let stack = tb.getStack();
		for (let pos = stack.length - 1; pos >= 0; pos--) {
			let node = stack[pos];
			if (node.normalName() === name) {
				tb.generateImpliedEndTags(name);
				if (name !== tb.currentElement().normalName())
					tb.error(this);
				tb.popStackToClose(name);
				break;
			} else {
				if (tb.isSpecial(node)) {
					tb.error(this);
					return false;
				}
			}
		}
		return true;
	}

	private inBodyEndTagAdoption(t: TK.Token, tb: HtmlBuilder): boolean {
		let endTag = t.asEndTag();
		let name = endTag.normalName();

		let stack = tb.getStack();
		let el: Element;
		for (let i = 0; i < 8; i++) {
			let formatEl = tb.getActiveFormattingElement(name);
			if (formatEl == null)
				return this.anyOtherEndTag(t, tb);
			else if (!tb.onStack(formatEl)) {
				tb.error(this);
				tb.removeFromActiveFormattingElements(formatEl);
				return true;
			} else if (!tb.inScope(formatEl.normalName())) {
				tb.error(this);
				return false;
			} else if (tb.currentElement() != formatEl)
				tb.error(this);

			let furthestBlock = null;
			let commonAncestor = null;
			let seenFormattingElement = false;
			// the spec doesn't limit to < 64, but in degenerate cases (9000+ stack depth) this prevents
			// run-aways
			let stackSize = stack.length;
			let bookmark = -1;
			for (let si = 0; si < stackSize && si < 64; si++) {
				el = stack[si];
				if (el == formatEl) {
					commonAncestor = stack[si - 1];
					seenFormattingElement = true;
					// Let a bookmark note the position of the formatting element in the list of active formatting elements relative to the elements on either side of it in the list.
					bookmark = tb.positionOfElement(el);
				} else if (seenFormattingElement && tb.isSpecial(el)) {
					furthestBlock = el;
					break;
				}
			}
			if (furthestBlock == null) {
				tb.popStackToClose(formatEl.normalName());
				tb.removeFromActiveFormattingElements(formatEl);
				return true;
			}

			let node = furthestBlock;
			let lastNode = furthestBlock;
			for (let j = 0; j < 3; j++) {
				if (tb.onStack(node))
					node = tb.aboveOnStack(node);
				if (!tb.isInActiveFormattingElements(node)) { // note no bookmark check
					tb.removeFromStack(node);
					continue;
				} else if (node == formatEl)
					break;

				let replacement = new Element(Tag.valueOf(node.nodeName(), ParseSetting.preserveCase), tb.getBaseUri());
				// case will follow the original node (so honours ParseSettings)
				tb.replaceActiveFormattingElement(node, replacement);
				tb.replaceOnStack(node, replacement);
				node = replacement;

				if (lastNode == furthestBlock) {
					// move the aforementioned bookmark to be immediately after the new node in the list of active formatting elements.
					// not getting how this bookmark both straddles the element above, but is inbetween here...
					bookmark = tb.positionOfElement(node) + 1;
				}
				if (lastNode.parent() != null)
					lastNode.remove();
				node.appendChild(lastNode);

				lastNode = node;
			}

			if (commonAncestor != null) { // safety check, but would be an error if null
				if (inSorted(commonAncestor.normalName(), HtmlState_InBody.Constants.InBodyEndTableFosters)) {
					if (lastNode.parent() != null)
						lastNode.remove();
					tb.insertInFosterParent(lastNode);
				} else {
					if (lastNode.parent() != null)
						lastNode.remove();
					commonAncestor.appendChild(lastNode);
				}
			}

			let adopter = new Element(formatEl.get_tag(), tb.getBaseUri());
			adopter.get_attributes().addAll(formatEl.get_attributes());
			let childNodes = furthestBlock.childNodes().toArray(new Node[0]);
			for (let childNode of childNodes) {
				adopter.appendChild(childNode); // append will reparent. thus the clone to avoid concurrent mod.
			}
			furthestBlock.appendChild(adopter);
			tb.removeFromActiveFormattingElements(formatEl);
			// insert the new element into the list of active formatting elements at the position of the aforementioned bookmark.
			tb.pushWithBookmark(adopter, bookmark);
			tb.removeFromStack(formatEl);
			tb.insertOnStackAfter(furthestBlock, adopter);
		}
		return true;
	}

}

class HtmlState_Text extends HtmlState {
	static instance = new HtmlState_Text();

	process(t: TK.Token, tb: HtmlBuilder): boolean {
		if (t.isCharacter()) {
			tb.insert(t.asCharacter());
		}
		else if (t.isEndTag()) {
			// if: An end tag whose tag name is "script" -- scripting nesting level, if evaluating scripts
			tb.pop();
			tb.transition(tb.originalState);
		}
		else if (t.isEOF()) {
			tb.error(this);
			// if current node is script: already started
			tb.pop();
			tb.transition(tb.originalState);
			return tb.process(t);
		}
		return true;
	}
}

class HtmlState_InTable extends HtmlState {
	static instance = new HtmlState_InTable();

	process(t: TK.Token, tb: HtmlBuilder): boolean {
		if (t.isCharacter() && inSorted(tb.currentElement().normalName(), HtmlState.Constants.InTableFoster)) {
			tb.newPendingTableCharacters();
			tb.markInsertionMode();
			tb.transition(HtmlState_InTableText.instance);
			return tb.process(t);
		}

		else if (t.isComment()) {
			tb.insert(t.asComment());
			return true;
		}

		else if (t.isDoctype()) {
			tb.error(this);
			return false;
		}

		else if (t.isStartTag()) {
			let startTag = t.asStartTag();
			let name = startTag.normalName();
			if (name === "caption") {
				tb.clearStackToTableContext();
				tb.insertMarkerToFormattingElements();
				tb.insert(startTag);
				tb.transition(HtmlState_InCaption.instance);
			} else if (name === "colgroup") {
				tb.clearStackToTableContext();
				tb.insert(startTag);
				tb.transition(HtmlState_InColumnGroup.instance);
			} else if (name === "col") {
				tb.clearStackToTableContext();
				tb.processStartTag("colgroup");
				return tb.process(t);
			} else if (inSorted(name, HtmlState.Constants.InTableToBody)) {
				tb.clearStackToTableContext();
				tb.insert(startTag);
				tb.transition(HtmlState_InTableBody.instance);
			} else if (inSorted(name, HtmlState.Constants.InTableAddBody)) {
				tb.clearStackToTableContext();
				tb.processStartTag("tbody");
				return tb.process(t);
			} else if (name === "table") {
				tb.error(this);
				if (!tb.inTableScope(name)) { // ignore it
					return false;
				} else {
					tb.popStackToClose(name);
					tb.resetInsertionMode();
					if (tb.state.equals(HtmlState_InTable.instance)) {
						// not per spec - but haven't transitioned out of table. so try something else
						tb.insert(startTag);
						return true;
					}
					return tb.process(t);
				}
			} else if (inSorted(name, HtmlState.Constants.InTableToHead)) {
				return tb.process(t, HtmlState_InHead.instance);
			} else if (name === "input") {
				if (!(startTag.hasAttributes() && equalsIgnoreCase(startTag.get_attr("type"), "hidden"))) {
					return this.anythingElse(t, tb);
				} else {
					tb.insertEmpty(startTag);
				}
			} else if (name === "form") {
				tb.error(this);
				if (tb.getFormElement() != null)
					return false;
				else {
					tb.insertForm(startTag, false);
				}
			} else {
				return this.anythingElse(t, tb);
			}
			return true; // todo: check if should return processed http://www.whatwg.org/specs/web-apps/current-work/multipage/tree-construction.html#parsing-main-intable
		} else if (t.isEndTag()) {
			let endTag = t.asEndTag();
			let name = endTag.normalName();

			if (name === "table") {
				if (!tb.inTableScope(name)) {
					tb.error(this);
					return false;
				} else {
					tb.popStackToClose("table");
					tb.resetInsertionMode();
				}
			} else if (inSorted(name, HtmlState.Constants.InTableEndErr)) {
				tb.error(this);
				return false;
			} else {
				return this.anythingElse(t, tb);
			}
			return true; // todo: as above todo
		} else if (t.isEOF()) {
			if (tb.currentElement().normalName() === "html")
				tb.error(this);
			return true; // stops parsing
		}
		return this.anythingElse(t, tb);
	}
	anythingElse(t: TK.Token, tb: HtmlBuilder): boolean {
		tb.error(this);
		tb.setFosterInserts(true);
		tb.process(t, HtmlState_InBody.instance);
		tb.setFosterInserts(false);
		return true;
	}
}

class HtmlState_InTableText extends HtmlState {
	static instance = new HtmlState_InTableText();

	process(t: TK.Token, tb: HtmlBuilder): boolean {
		if (t.tokenType === TK.TokenType.Character) {
			let c = t.asCharacter();
			if (c.getData() === HtmlState_InTableText.nullString) {
				tb.error(this);
				return false;
			} else {
				tb.getPendingTableCharacters().push(c.getData());
			}
		} else {// todo - don't really like the way these table character data lists are built
			if (tb.getPendingTableCharacters().length > 0) {
				for (let character of tb.getPendingTableCharacters()) {
					if (!HtmlState_InTableText.isWhitespace(character)) {
						// InTable anything else section:
						tb.error(this);
						if (inSorted(tb.currentElement().normalName(), HtmlState.Constants.InTableFoster)) {
							tb.setFosterInserts(true);
							tb.process(new TK.Character().data(character), HtmlState_InBody.instance);
							tb.setFosterInserts(false);
						} else {
							tb.process(new TK.Character().data(character), HtmlState_InBody.instance);
						}
					} else
						tb.insert(new TK.Character().data(character));
				}
				tb.newPendingTableCharacters();
			}
			tb.transition(tb.originalState);
			return tb.process(t);
		}
		return true;
	}
}

class HtmlState_InCaption extends HtmlState {
	static instance = new HtmlState_InCaption();

	process(t: TK.Token, tb: HtmlBuilder): boolean {
		if (t.isEndTag() && t.asEndTag().normalName() === 'caption') {
			let endTag = t.asEndTag();
			let name = endTag.normalName();
			if (!tb.inTableScope(name)) {
				tb.error(this);
				return false;
			} else {
				tb.generateImpliedEndTags();
				if (tb.currentElement().normalName() !== 'caption') tb.error(this);
				tb.popStackToClose("caption");
				tb.clearFormattingElementsToLastMarker();
				tb.transition(HtmlState_InTable.instance);
			}
		} else if ((
			t.isStartTag() && inSorted(t.asStartTag().normalName(), HtmlState.Constants.InCellCol) ||
			t.isEndTag() && t.asEndTag().normalName() === 'table')
		) {
			tb.error(this);
			let processed = tb.processEndTag("caption");
			if (processed) return tb.process(t);
		} else if (t.isEndTag() && inSorted(t.asEndTag().normalName(), HtmlState.Constants.InCaptionIgnore)) {
			tb.error(this);
			return false;
		} else {
			return tb.process(t, HtmlState_InBody.instance);
		}
		return true;
	}
}

class HtmlState_InColumnGroup extends HtmlState {
	static instance = new HtmlState_InColumnGroup();

	process(t: TK.Token, tb: HtmlBuilder): boolean {
		if (HtmlState_InColumnGroup.isWhitespace(t)) {
			tb.insert(t.asCharacter());
			return true;
		}
		switch (t.tokenType) {
			case TK.TokenType.Comment:
				tb.insert(t.asComment());
				break;
			case TK.TokenType.Doctype:
				tb.error(this);
				break;
			case TK.TokenType.StartTag:
				let startTag = t.asStartTag();
				switch (startTag.normalName()) {
					case "html":
						return tb.process(t, HtmlState_InBody.instance);
					case "col":
						tb.insertEmpty(startTag);
						break;
					default:
						return this.anythingElse(t, tb);
				}
				break;
			case TK.TokenType.EndTag:
				let endTag = t.asEndTag();
				if (endTag.normalName() === 'colgroup') {
					if (tb.currentElement().normalName() === 'html') { // frag case
						tb.error(this);
						return false;
					} else {
						tb.pop();
						tb.transition(HtmlState_InTable.instance);
					}
				} else
					return this.anythingElse(t, tb);
				break;
			case TK.TokenType.EOF:
				if (tb.currentElement().normalName() === 'html')
					return true; // stop parsing; frag case
				else
					return this.anythingElse(t, tb);
			default:
				return this.anythingElse(t, tb);
		}
		return true;
	}
	private anythingElse(t: TK.Token, tb: HtmlBuilder): boolean {
		let processed = tb.processEndTag("colgroup");
		if (processed) // only ignored in frag case
			return tb.process(t);
		return true;
	}
}

class HtmlState_InTableBody extends HtmlState {
	static instance = new HtmlState_InTableBody();

	process(t: TK.Token, tb: HtmlBuilder): boolean {
		switch (t.tokenType) {
			case TK.TokenType.StartTag:
				let startTag = t.asStartTag();
				let name = startTag.normalName();
				if (name === 'template') {
					tb.insert(startTag);
				} else if (name === 'tr') {
					tb.clearStackToTableBodyContext();
					tb.insert(startTag);
					tb.transition(HtmlState_InRow.instance);
				} else if (inSorted(name, HtmlState.Constants.InCellNames)) {
					tb.error(this);
					tb.processStartTag("tr");
					return tb.process(startTag);
				} else if (inSorted(name, HtmlState.Constants.InTableBodyExit)) {
					return this.exitTableBody(t, tb);
				} else
					return this.anythingElse(t, tb);
				break;
			case TK.TokenType.EndTag:
				let endTag = t.asEndTag();
				name = endTag.normalName();
				if (inSorted(name, HtmlState.Constants.InTableEndIgnore)) {
					if (!tb.inTableScope(name)) {
						tb.error(this);
						return false;
					} else {
						tb.clearStackToTableBodyContext();
						tb.pop();
						tb.transition(HtmlState_InTable.instance);
					}
				} else if (name === 'table') {
					return this.exitTableBody(t, tb);
				} else if (inSorted(name, HtmlState.Constants.InTableBodyEndIgnore)) {
					tb.error(this);
					return false;
				} else
					return this.anythingElse(t, tb);
				break;
			default:
				return this.anythingElse(t, tb);
		}
		return true;
	}
	private exitTableBody(t: TK.Token, tb: HtmlBuilder): boolean {
		if (!(tb.inTableScope("tbody") || tb.inTableScope("thead") || tb.inScope("tfoot"))) {
			// frag case
			tb.error(this);
			return false;
		}
		tb.clearStackToTableBodyContext();
		tb.processEndTag(tb.currentElement().normalName()); // tbody, tfoot, thead
		return tb.process(t);
	}
	private anythingElse(t: TK.Token, tb: HtmlBuilder): boolean {
		return tb.process(t, HtmlState_InTable.instance);
	}
}

class HtmlState_InRow extends HtmlState {
	static instance = new HtmlState_InRow();

	process(t: TK.Token, tb: HtmlBuilder): boolean {
		if (t.isStartTag()) {
			let startTag = t.asStartTag();
			let name = startTag.normalName();

			if (name === 'template') {
				tb.insert(startTag);
			} else if (inSorted(name, HtmlState.Constants.InCellNames)) {
				tb.clearStackToTableRowContext();
				tb.insert(startTag);
				tb.transition(HtmlState_InCell.instance);
				tb.insertMarkerToFormattingElements();
			} else if (inSorted(name, HtmlState.Constants.InRowMissing)) {
				return this.handleMissingTr(t, tb);
			} else {
				return this.anythingElse(t, tb);
			}
		} else if (t.isEndTag()) {
			let endTag = t.asEndTag();
			let name = endTag.normalName();

			if (name === 'tr') {
				if (!tb.inTableScope(name)) {
					tb.error(this); // frag
					return false;
				}
				tb.clearStackToTableRowContext();
				tb.pop(); // tr
				tb.transition(HtmlState_InTableBody.instance);
			} else if (name === 'table') {
				return this.handleMissingTr(t, tb);
			} else if (inSorted(name, HtmlState.Constants.InTableToBody)) {
				if (!tb.inTableScope(name) || !tb.inTableScope("tr")) {
					tb.error(this);
					return false;
				}
				tb.clearStackToTableRowContext();
				tb.pop(); // tr
				tb.transition(HtmlState_InTableBody.instance);
			} else if (inSorted(name, HtmlState.Constants.InRowIgnore)) {
				tb.error(this);
				return false;
			} else {
				return this.anythingElse(t, tb);
			}
		} else {
			return this.anythingElse(t, tb);
		}
		return true;
	}
	handleMissingTr(t: TK.EndTag, tb: HtmlBuilder): boolean {
		let processed = tb.processEndTag("tr");
		if (processed) return tb.process(t);
		else return false;
	}
	private anythingElse(t: TK.Token, tb: HtmlBuilder): boolean {
		return tb.process(t, HtmlState_InTable.instance);
	}
}

class HtmlState_InCell extends HtmlState {
	static instance = new HtmlState_InCell();

	process(t: TK.Token, tb: HtmlBuilder): boolean {
		if (t.isEndTag()) {
			let endTag = t.asEndTag();
			let name = endTag.normalName();

			if (inSorted(name, HtmlState_InCell.Constants.InCellNames)) {
				if (!tb.inTableScope(name)) {
					tb.error(this);
					tb.transition(HtmlState_InRow.instance); // might not be in scope if empty: <td /> and processing fake end tag
					return false;
				}
				tb.generateImpliedEndTags();
				if (tb.currentElement().normalName() !== name) tb.error(this);
				tb.popStackToClose(name);
				tb.clearFormattingElementsToLastMarker();
				tb.transition(HtmlState_InRow.instance);
			} else if (inSorted(name, HtmlState_InCell.Constants.InCellBody)) {
				tb.error(this);
				return false;
			} else if (inSorted(name, HtmlState_InCell.Constants.InCellTable)) {
				if (!tb.inTableScope(name)) {
					tb.error(this);
					return false;
				}
				this.closeCell(tb);
				return tb.process(t);
			} else {
				return this.anythingElse(t, tb);
			}
		} else if (t.isStartTag() &&
			inSorted(t.asStartTag().normalName(), HtmlState_InCell.Constants.InCellCol)) {
			if (!(tb.inTableScope("td") || tb.inTableScope("th"))) {
				tb.error(this);
				return false;
			}
			this.closeCell(tb);
			return tb.process(t);
		} else {
			return this.anythingElse(t, tb);
		}
		return true;
	}
	private closeCell(tb: HtmlBuilder) {
		if (tb.inTableScope("td"))
			tb.processEndTag("td");
		else
			tb.processEndTag("th"); // only here if th or td in scope
	}
	private anythingElse(t: TK.Token, tb: HtmlBuilder): boolean {
		return tb.process(t, HtmlState_InBody.instance);
	}
}

class HtmlState_InSelect extends HtmlState {
	static instance = new HtmlState_InSelect();

	process(t: TK.Token, tb: HtmlBuilder): boolean {
		switch (t.tokenType) {
			case TK.TokenType.Character:
				let c = t.asCharacter();
				if (c.getData() === HtmlState_InSelect.nullString) {
					tb.error(this);
					return false;
				} else {
					tb.insert(c);
				}
				break;
			case TK.TokenType.Comment:
				tb.insert(t.asComment());
				break;
			case TK.TokenType.Doctype:
				tb.error(this);
				return false;
			case TK.TokenType.StartTag:
				let start = t.asStartTag();
				let name = start.normalName();
				if (name === 'html')
					return tb.process(start, HtmlState_InBody.instance);
				else if (name === 'option') {
					if (tb.currentElement().normalName() === 'option')
						tb.processEndTag("option");
					tb.insert(start);
				} else if (name === 'optgroup') {
					if (tb.currentElement().normalName() === 'option')
						tb.processEndTag("option"); // pop option and flow to pop optgroup
					if (tb.currentElement().normalName() === 'optgroup')
						tb.processEndTag("optgroup");
					tb.insert(start);
				} else if (name === 'select') {
					tb.error(this);
					return tb.processEndTag("select");
				} else if (inSorted(name, HtmlState.Constants.InSelectEnd)) {
					tb.error(this);
					if (!tb.inSelectScope("select"))
						return false; // frag
					tb.processEndTag("select");
					return tb.process(start);
				} else if (name === 'script') {
					return tb.process(t, HtmlState_InHead.instance);
				} else {
					return this.anythingElse(t, tb);
				}
				break;
			case TK.TokenType.EndTag:
				let end = t.asEndTag();
				name = end.normalName();
				switch (name) {
					case "optgroup":
						if (tb.currentElement().normalName() === 'option' && notNull(tb.aboveOnStack(tb.currentElement())) && tb.aboveOnStack(tb.currentElement()).normalName() === 'optgroup')
							tb.processEndTag("option");
						if (tb.currentElement().normalName() === 'optgroup')
							tb.pop();
						else
							tb.error(this);
						break;
					case "option":
						if (tb.currentElement().normalName() === 'option')
							tb.pop();
						else
							tb.error(this);
						break;
					case "select":
						if (!tb.inSelectScope(name)) {
							tb.error(this);
							return false;
						} else {
							tb.popStackToClose(name);
							tb.resetInsertionMode();
						}
						break;
					default:
						return this.anythingElse(t, tb);
				}
				break;
			case TK.TokenType.EOF:
				if (tb.currentElement().normalName() !== 'html')
					tb.error(this);
				break;
			default:
				return this.anythingElse(t, tb);
		}
		return true;
	}
	anythingElse(t: TK.Token, tb: HtmlBuilder): boolean {
		tb.error(this);
		return false;
	}

}

class HtmlState_InSelectInTable extends HtmlState {
	static instance = new HtmlState_InSelectInTable();

	process(t: TK.Token, tb: HtmlBuilder): boolean {
		if (t.isStartTag() && inSorted(t.asStartTag().normalName(), HtmlState.Constants.InSelecTableEnd)) {
			tb.error(this);
			tb.processEndTag("select");
			return tb.process(t);
		} else if (t.isEndTag() && inSorted(t.asEndTag().normalName(), HtmlState.Constants.InSelecTableEnd)) {
			tb.error(this);
			if (tb.inTableScope(t.asEndTag().normalName())) {
				tb.processEndTag("select");
				return (tb.process(t));
			} else
				return false;
		} else {
			return tb.process(t, HtmlState_InSelect.instance);
		}
	}
}

class HtmlState_AfterBody extends HtmlState {
	static instance = new HtmlState_AfterBody();

	process(t: TK.Token, tb: HtmlBuilder): boolean {
		if (HtmlState_AfterBody.isWhitespace(t)) {
			tb.insert(t.asCharacter()); // out of spec - include whitespace. spec would move into body
		} else if (t.isComment()) {
			tb.insert(t.asComment()); // into html node
		} else if (t.isDoctype()) {
			tb.error(this);
			return false;
		} else if (t.isStartTag() && t.asStartTag().normalName() === 'html') {
			return tb.process(t, HtmlState_InBody.instance);
		} else if (t.isEndTag() && t.asEndTag().normalName() === 'html') {
			if (tb.isFragmentParsing()) {
				tb.error(this);
				return false;
			} else {
				tb.transition(HtmlState_AfterAfterBody.instance);
			}
		} else if (t.isEOF()) {
			// chillax! we're done
		} else {
			tb.error(this);
			tb.transition(HtmlState_InBody.instance);
			return tb.process(t);
		}
		return true;
	}
}

class HtmlState_InFrameset extends HtmlState {
	static instance = new HtmlState_InFrameset();

	process(t: TK.Token, tb: HtmlBuilder): boolean {
		if (HtmlState_InFrameset.isWhitespace(t)) {
			tb.insert(t.asCharacter());
		} else if (t.isComment()) {
			tb.insert(t.asComment());
		} else if (t.isDoctype()) {
			tb.error(this);
			return false;
		} else if (t.isStartTag()) {
			let start = t.asStartTag();
			switch (start.normalName()) {
				case "html":
					return tb.process(start, HtmlState_InBody.instance);
				case "frameset":
					tb.insert(start);
					break;
				case "frame":
					tb.insertEmpty(start);
					break;
				case "noframes":
					return tb.process(start, HtmlState_InHead.instance);
				default:
					tb.error(this);
					return false;
			}
		} else if (t.isEndTag() && t.asEndTag().normalName() === 'frameset') {
			if (tb.currentElement().normalName() === 'html') { // frag
				tb.error(this);
				return false;
			} else {
				tb.pop();
				if (!tb.isFragmentParsing() && tb.currentElement().normalName() !== 'frameset') {
					tb.transition(HtmlState_AfterFrameset.instance);
				}
			}
		} else if (t.isEOF()) {
			if (tb.currentElement().normalName() !== 'html') {
				tb.error(this);
				return true;
			}
		} else {
			tb.error(this);
			return false;
		}
		return true;
	}
}

class HtmlState_AfterFrameset extends HtmlState {
	static instance = new HtmlState_AfterFrameset();

	process(t: TK.Token, tb: HtmlBuilder): boolean {
		if (HtmlState_AfterFrameset.isWhitespace(t)) {
			tb.insert(t.asCharacter());
		} else if (t.isComment()) {
			tb.insert(t.asComment());
		} else if (t.isDoctype()) {
			tb.error(this);
			return false;
		} else if (t.isStartTag() && t.asStartTag().normalName() === 'html') {
			return tb.process(t, HtmlState_InBody.instance);
		} else if (t.isEndTag() && t.asEndTag().normalName() === 'html') {
			tb.transition(HtmlState_AfterAfterFrameset.instance);
		} else if (t.isStartTag() && t.asStartTag().normalName() === 'noframes') {
			return tb.process(t, HtmlState_InHead.instance);
		} else if (t.isEOF()) {
			// cool your heels, we're complete
		} else {
			tb.error(this);
			return false;
		}
		return true;
	}
}

class HtmlState_AfterAfterBody extends HtmlState {
	static instance = new HtmlState_AfterAfterBody();

	process(t: TK.Token, tb: HtmlBuilder): boolean {
		if (t.isComment()) {
			tb.insert(t.asComment());
		} else if (t.isDoctype() || (t.isStartTag() && t.asStartTag().normalName() === 'html')) {
			return tb.process(t, HtmlState_InBody.instance);
		} else if (HtmlState_AfterAfterBody.isWhitespace(t)) {
			// allows space after </html>, and put the body back on stack to allow subsequent tags if any
			// todo - might be better for </body> and </html> to close them, allow trailing space, and then reparent
			//  that space into body if other tags get re-added. but that's overkill for now
			let html = tb.popStackToClose("html");
			tb.insert(t.asCharacter());
			if (html != null) {
				tb.get_stack().push(html);
				let body = html.selectFirst("body");
				if (body != null) tb.get_stack().push(body);
			}
		} else if (t.isEOF()) {
			// nice work chuck
		} else {
			tb.error(this);
			tb.transition(HtmlState_InBody.instance);
			return tb.process(t);
		}
		return true;
	}
}

class HtmlState_AfterAfterFrameset extends HtmlState {
	static instance = new HtmlState_AfterAfterFrameset();

	process(t: TK.Token, tb: HtmlBuilder): boolean {
		if (t.isComment()) {
			tb.insert(t.asComment());
		} else if (t.isDoctype() || HtmlState_AfterAfterFrameset.isWhitespace(t) || (t.isStartTag() && t.asStartTag().normalName() === 'html')) {
			return tb.process(t, HtmlState_InBody.instance);
		}
		else if (t.isStartTag() && t.asStartTag().normalName() === 'noframes') {
			return tb.process(t, HtmlState_InHead.instance);
		}
		else if (t.isEOF()) {
			// nice work chuck
		} else {
			tb.error(this);
			return false;
		}
		return true;
	}
}

class HtmlState_ForeignContent extends HtmlState {
	static instance = new HtmlState_ForeignContent();

	process(t: TK.Token, tb: HtmlBuilder): boolean {
		return true;
	}
}

export class HtmlStateCls {
	static Initial = HtmlState_Initial.instance;
	static BeforeHtml = HtmlState_BeforeHtml.instance;
	static BeforeHead = HtmlState_BeforeHead.instance;
	static InHead = HtmlState_InHead.instance;
	static InHeadNoscript = HtmlState_InHeadNoscript.instance;
	static AfterHead = HtmlState_AfterHead.instance;
	static InBody = HtmlState_InBody.instance;
	static Text = HtmlState_Text.instance;
	static InTable = HtmlState_InTable.instance;
	static InTableText = HtmlState_InTableText.instance;
	static InCaption = HtmlState_InCaption.instance;
	static InColumnGroup = HtmlState_InColumnGroup.instance;
	static InTableBody = HtmlState_InTableBody.instance;
	static InRow = HtmlState_InRow.instance;
	static InCell = HtmlState_InCell.instance;
	static InSelect = HtmlState_InSelect.instance;
	static InSelectInTable = HtmlState_InSelectInTable.instance;
	static AfterBody = HtmlState_AfterBody.instance;
	static InFrameset = HtmlState_InFrameset.instance;
	static AfterFrameset = HtmlState_AfterFrameset.instance;
	static AfterAfterBody = HtmlState_AfterAfterBody.instance;
	static AfterAfterFrameset = HtmlState_AfterAfterFrameset.instance;
	static ForeignContent = HtmlState_ForeignContent.instance;
}
