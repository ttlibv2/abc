/* eslint-disable no-undef, no-unused-vars, no-use-before-define*/

import { Helper } from '../helper/Helper';
import { HtmlBuilder } from './HtmlBuilder';
import { TokeniserState } from './TokeniserState';
import * as TK from './Token';
import { DocumentType } from '../nodes/DocumentType';
import { QuirksMode } from '../nodes/Document';

export abstract class HtmlState {
	static Initial = new HtmlState_Initial();

	abstract process(token: TK.Token, tb: HtmlBuilder): boolean;

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
		tb.transition(Text);
		tb.insert(startTag);
	}

	static handleRawtext(startTag: TK.StartTag, tb: HtmlBuilder) {
		tb.tokeniser.transition(TokeniserState.Rawtext);
		tb.markInsertionMode();
		tb.transition(Text);
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

export class HtmlState_Initial extends HtmlState {

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
			let doctype = new DocumentType( tb.setting.normalizeTag(d.getName()), 
			d.getPublicIdentifier(), d.getSystemIdentifier())
			.setPubSysKey(d.getPubSysKey());

			tb.getDocument().appendChild(doctype);
			if (d.isForceQuirks())tb.getDocument().quirksMode(QuirksMode.quirks);
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

export class HtmlState_BeforeHtml extends HtmlState {
	process(token: TK.Token, tb: HtmlBuilder): boolean {
		throw new Error('Method not implemented.');
	}
	static instance = new HtmlState_BeforeHtml();
	
}

