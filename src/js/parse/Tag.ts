import { Assert } from "../helper/Assert";
import { Helper } from "../helper/Helper";
import { Normalizer } from "../helper/Normalizer";
import { ParseSetting } from "./Setting";

/**
 * HTML Tag capabilities.
 */
export class Tag {
  static readonly tags: Map<string, Tag> = new Map();

  // normalized (lowercased) tag name.
  readonly normalName?: string;

  // block
  isBlock: boolean = true;

  // should be formatted as a block
  formatAsBlock: boolean = true;

  // can hold nothing; e.g. img
  empty: boolean = false;

  // can self close (<foo />). used for unknown tags that self close,
  // without forcing them as empty.
  selfClosing: boolean = false;

  // for pre, textarea, script etc
  preserveWhitespace: boolean = false;

  // a control that appears in forms: input, textarea, output etc
  formList: boolean = false;

  // a control that can be submitted in a form: input etc
  formSubmit: boolean = false;

  constructor(public tagName: string) {
    this.normalName = Normalizer.lowerCase(tagName);
  }

  /**
   * Gets if this tag is an inline tag.
   * @return if this tag is an inline tag.
   */
  get isInline(): boolean {
    return !this.isBlock;
  }

  /**
   * Get if this tag is self closing.
   * @return if this tag should be output as self closing.
   */
  get isSelfClosing(): boolean {
    return this.empty || this.selfClosing;
  }

  /**
   * Get if this is a pre-defined tag, or was auto created on parsing.
   * @return if a known tag
   */
  isKnownTag(tagName: string): boolean {
    return Tag.tags.has(tagName);
  }

  setSelfClosing(): this {
    this.selfClosing = true;
    return this;
  }

  toString(): string {
    return this.tagName;
  }

  clone(): Tag {
    return Object.create(this);
  }

  getName(): string {
    return this.tagName;
  }

  /**
   * Check if this tagname is a known tag.
   *
   * @param tagName name of tag
   * @return if known HTML tag
   */
  static isKnownTag(tagName: string): boolean {
    return Tag.tags.has(tagName);
  }

  /**
   * Get a Tag by name. If not previously defined (unknown), returns a new generic tag, that can do anything.
   * <p>
   * Pre-defined tags (P, DIV etc) will be ==, but unknown tags are not registered and will only .equals().
   * </p>
   *
   * @param tagName Name of tag, e.g. "p". Case insensitive.
   * @param settings used to control tag name sensitivity
   * @return The tag, either defined or new generic.
   */
  static valueOf(tagName: string, setting?: ParseSetting): Tag | null {
    Assert.notNull(tagName);

    setting = setting || ParseSetting.preserveCase;

    let tag: any = Tag.tags.get(tagName);

    if (!Helper.isNull(tag)) return tag;
    else {
      tagName = Assert.notEmpty(setting.normalizeTag(tagName));
      let normalName = Normalizer.lowerCase(tagName);

      tag = Tag.tags.get(normalName);
      if (Helper.isNull(tag)) {
        tag = new Tag(tagName);
        tag.isBlock = false;
        return tag;
      } else if (setting.preserveTagCase && tagName !== normalName) {
        tag = tag?.clone();
        tag.tagName = tagName;
        return tag;
      } else return null;
    }
  }

  private static getTag(tagName: string): Tag | null {
    return Tag.tags.get(tagName) || null;
  }

  // internal static initialisers:
  // prepped from http://www.w3.org/TR/REC-html40/sgml/dtd.html and other sources

  static readonly blockTags: string[] = [
    "html",
    "head",
    "body",
    "frameset",
    "script",
    "noscript",
    "style",
    "meta",
    "link",
    "title",
    "frame",
    "noframes",
    "section",
    "nav",
    "aside",
    "hgroup",
    "header",
    "footer",
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "pre",
    "div",
    "blockquote",
    "hr",
    "address",
    "figure",
    "figcaption",
    "form",
    "fieldset",
    "ins",
    "del",
    "dl",
    "dt",
    "dd",
    "li",
    "table",
    "caption",
    "thead",
    "tfoot",
    "tbody",
    "colgroup",
    "col",
    "tr",
    "th",
    "td",
    "video",
    "audio",
    "canvas",
    "details",
    "menu",
    "plaintext",
    "template",
    "article",
    "main",
    "svg",
    "math",
    "center"
  ];

  static readonly inlineTags: string[] = [
    "object",
    "base",
    "font",
    "tt",
    "i",
    "b",
    "u",
    "big",
    "small",
    "em",
    "strong",
    "dfn",
    "code",
    "samp",
    "kbd",
    "var",
    "cite",
    "abbr",
    "time",
    "acronym",
    "mark",
    "ruby",
    "rt",
    "rp",
    "a",
    "img",
    "br",
    "wbr",
    "map",
    "q",
    "sub",
    "sup",
    "bdo",
    "iframe",
    "embed",
    "span",
    "input",
    "select",
    "textarea",
    "label",
    "button",
    "optgroup",
    "option",
    "legend",
    "datalist",
    "keygen",
    "output",
    "progress",
    "meter",
    "area",
    "param",
    "source",
    "track",
    "summary",
    "command",
    "device",
    "area",
    "basefont",
    "bgsound",
    "menuitem",
    "param",
    "source",
    "track",
    "data",
    "bdi",
    "s"
  ];

  static readonly emptyTags: string[] = [
    "meta",
    "link",
    "base",
    "frame",
    "img",
    "br",
    "wbr",
    "embed",
    "hr",
    "input",
    "keygen",
    "col",
    "command",
    "device",
    "area",
    "basefont",
    "bgsound",
    "menuitem",
    "param",
    "source",
    "track"
  ];

  // todo - rework this to format contents as inline; and update html emitter in Element. Same output, just neater.
  static readonly formatAsInlineTags: string[] = [
    "title",
    "a",
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "pre",
    "address",
    "li",
    "th",
    "td",
    "script",
    "style",
    "ins",
    "del",
    "s"
  ];

  static readonly preserveWhitespaceTags: string[] = [
    "pre",
    "plaintext",
    "title",
    "textarea"
    // script is not here as it is a data node, which always preserve whitespace
  ];

  // todo: I think we just need submit tags, and can scrub listed
  static readonly formListedTags: string[] = [
    "button",
    "fieldset",
    "input",
    "keygen",
    "object",
    "output",
    "select",
    "textarea"
  ];

  static readonly formSubmitTags: string[] = [
    "input",
    "keygen",
    "object",
    "select",
    "textarea"
  ];

  static registerAllTag = () => {
    let register = (tag: Tag) => Tag.tags.set(tag.tagName, tag);

    Tag.tags.clear();

    // creates
    for (let tagName of Tag.blockTags) {
      register(new Tag(tagName));
    }

    for (let tagName of Tag.inlineTags) {
      let tag = new Tag(tagName);
      tag.isBlock = false;
      tag.formatAsBlock = false;
      register(tag);
    }

    // mods:
    for (let tagName of Tag.emptyTags) {
      let tag: any = Assert.notNull(Tag.getTag(tagName));
      tag.empty = true;
    }

    for (let tagName of Tag.formatAsInlineTags) {
      let tag: any = Assert.notNull(Tag.getTag(tagName));
      tag.formatAsBlock = false;
    }

    for (let tagName of Tag.preserveWhitespaceTags) {
      let tag: any = Assert.notNull(Tag.getTag(tagName));
      tag.preserveWhitespace = true;
    }

    for (let tagName of Tag.formListedTags) {
      let tag: any = Assert.notNull(Tag.getTag(tagName));
      tag.formList = true;
    }

    for (let tagName of Tag.formSubmitTags) {
      let tag: any = Assert.notNull(Tag.getTag(tagName));
      tag.formSubmit = true;
    }
  };
}

// init
Tag.registerAllTag();
