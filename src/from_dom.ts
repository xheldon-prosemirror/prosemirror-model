import {Fragment} from "./fragment"
import {Slice} from "./replace"
import {Mark} from "./mark"
import {Node, TextNode} from "./node"
import {ContentMatch} from "./content"
import {ResolvedPos} from "./resolvedpos"
import {Schema, Attrs, NodeType, MarkType} from "./schema"
import {DOMNode} from "./dom"

/// These are the options recognized by the
/// [`parse`](#model.DOMParser.parse) and
/// [`parseSlice`](#model.DOMParser.parseSlice) methods.
///
/// @cn 这是一个被 [`parse`](#model.DOMParser.parse) 和 [`parseSlice`](#model.DOMParser.parseSlice) 方法用到的参数配置对象。
export interface ParseOptions {
  /// By default, whitespace is collapsed as per HTML's rules. Pass
  /// `true` to preserve whitespace, but normalize newlines to
  /// spaces, and `"full"` to preserve whitespace entirely.
  //
  /// @cn 默认情况下，根据 HTML 的规则，空白符会被折叠起来不显示。传递 `true` 表示保留空白符，但会将换行符表示为空格。
  /// `"full"` 表示完全保留所有的空白符。
  preserveWhitespace?: boolean | "full"

  /// When given, the parser will, beside parsing the content,
  /// record the document positions of the given DOM positions. It
  /// will do so by writing to the objects, adding a `pos` property
  /// that holds the document position. DOM positions that are not
  /// in the parsed content will not be written to.
  ///
  /// @cn 如果设置了该参数，则 parser 除了 parsing 内容外，还将记录给定位置 DOM 在文档中相应的位置。
  /// 它将通过写入对象，添加一个保存文档位置的 `pos` 属性来实现。不在 parsed 内容中的 DOM 的位置将不会被写入。
  findPositions?: {node: DOMNode, offset: number, pos?: number}[]

  /// The child node index to start parsing from.
  ///
  /// @cn 从开始 parsing 位置计算的子节点的索引。
  from?: number

  /// The child node index to stop parsing at.
  ///
  /// @cn 从结束 parsing 位置计算的子节点的索引。
  to?: number

  /// By default, the content is parsed into the schema's default
  /// [top node type](#model.Schema.topNodeType). You can pass this
  /// option to use the type and attributes from a different node
  /// as the top container.
  ///
  /// @cn 默认情况下，内容会被 parsed 到 schema 的默认 [顶级节点](#model.Schema.topNodeType) 中。
  /// 你可以传递这个选项和 attributes 以使用一个不同的节点作为顶级容器。
  topNode?: Node

  /// Provide the starting content match that content parsed into the
  /// top node is matched against.
  ///
  /// @cn 提供与 parsed 到顶级节点的内容匹配的起始内容匹配。
  topMatch?: ContentMatch

  /// A set of additional nodes to count as
  /// [context](#model.ParseRule.context) when parsing, above the
  /// given [top node](#model.ParseOptions.topNode).
  ///
  /// @cn 在 parsing 的时候的一个额外的节点集合，其被算作给定 [top node](#model.ParseOptions.topNode) 之上的 [context](#model.ParseRule.context)。
  context?: ResolvedPos

  /// @internal
  ruleFromNode?: (node: DOMNode) => Omit<TagParseRule, "tag"> | null
  /// @internal
  topOpen?: boolean
}

/// Fields that may be present in both [tag](#model.TagParseRule) and
/// [style](#model.StyleParseRule) parse rules.
///
/// @cn 在 [tag](#model.TagParseRule) 和 [style](#model.StyleParseRule) parse rules 中可能出现的字段。
export interface GenericParseRule {
  /// Can be used to change the order in which the parse rules in a
  /// schema are tried. Those with higher priority come first. Rules
  /// without a priority are counted as having priority 50. This
  /// property is only meaningful in a schema—when directly
  /// constructing a parser, the order of the rule array is used.
  ///
  /// @cn 可以用来改变 schema 中 parse rules 的顺序。具有更高优先级的 rules 会首先被尝试。
  /// 没有 priority 的 rules 会被算作优先级为 50。这个属性只在 schema 中有效，当直接构造一个 parser 时，
  /// 使用 rule 数组的顺序。
  priority?: number

  /// By default, when a rule matches an element or style, no further
  /// rules get a chance to match it. By setting this to `false`, you
  /// indicate that even when this rule matches, other rules that come
  /// after it should also run.
  ///
  /// @cn 默认情况下，如果一个 rule 匹配了一个元素或者样式，那么就不会进一步的匹配接下来的 rule 了。
  /// 而通过设置该参数为 `false`，你可以决定即使当一个 rule 匹配了，在该 rule 之后的 rule 也依然会运行一次。
  consuming?: boolean

  /// When given, restricts this rule to only match when the current
  /// context—the parent nodes into which the content is being
  /// parsed—matches this expression. Should contain one or more node
  /// names or node group names followed by single or double slashes.
  /// For example `"paragraph/"` means the rule only matches when the
  /// parent node is a paragraph, `"blockquote/paragraph/"` restricts
  /// it to be in a paragraph that is inside a blockquote, and
  /// `"section//"` matches any position inside a section—a double
  /// slash matches any sequence of ancestor nodes. To allow multiple
  /// different contexts, they can be separated by a pipe (`|`)
  /// character, as in `"blockquote/|list_item/"`.
  ///
  /// @cn 如果设置了该属性，则限制 rule 只匹配给定的上下文表达式，该上下文即为被 parsed 的内容所在的父级节点。
  /// 应该包含一个或者多个节点名或者节点 group 名，用一个或者两个斜杠结尾。例如 `"paragraph/"` 表示只有当父级节点是段落的时候才会被匹配，
  /// `"blockquote/paragraph/"` 限制只有在一个 blockquote 中的一个段落中才会被匹配，`"section//"` 表示匹配在一个 section 中的任何位置--一个双斜线表示匹配
  /// 任何祖先节点序列。为了允许多个不同的上下文，它们可以用 `|` 分隔，比如 `"blockquote/|list_item/"`。
  context?: string

  /// The name of the mark type to wrap the matched content in.
  ///
  /// @cn 包裹匹配内容的 mark 类型的名字。
  mark?: string

  /// When true, ignore content that matches this rule.
  ///
  /// @cn 当给定时，表示匹配到的内容将被忽略。
  ignore?: boolean

  /// When true, finding an element that matches this rule will close
  /// the current node.
  ///
  /// @cn 如果是 true，则会在寻找匹配该 rule 的元素的时候关闭当前节点。
  closeParent?: boolean

  /// When true, ignore the node that matches this rule, but do parse
  /// its content.
  ///
  /// @cn 如果是 true，则会忽略匹配当前规则的节点，但是会 parse 它的内容。
  skip?: boolean

  /// Attributes for the node or mark created by this rule. When
  /// `getAttrs` is provided, it takes precedence.
  ///
  /// @cn 由该 rule 创建的节点或者 mark 的 attributes。如果 `getAttrs` 存在的话，`getAttrs` 优先。
  attrs?: Attrs
}

/// Parse rule targeting a DOM element.
///
/// @cn 一个针对 DOM 元素的 parse rule。
export interface TagParseRule extends GenericParseRule {
  /// A CSS selector describing the kind of DOM elements to match.
  ///
  /// @cn 一个 CSS 选择器，描述了要匹配的 DOM 元素的类型。
  tag: string

  /// The namespace to match. Nodes are only matched when the
  /// namespace matches or this property is null.
  ///
  /// @cn 需要匹配的命名空间。只有命名空间匹配之后或者为 null 表示没有命名空间，才会开始匹配节点。
  namespace?: string

  /// The name of the node type to create when this rule matches. Each
  /// rule should have either a `node`, `mark`, or `ignore` property
  /// (except when it appears in a [node](#model.NodeSpec.parseDOM) or
  /// [mark spec](#model.MarkSpec.parseDOM), in which case the `node`
  /// or `mark` property will be derived from its position).
  ///
  /// @cn 当 rule 匹配的时候，将要创建的节点类型的名字。仅对带有 `tag` 属性的 rules 可用，对样式 rule 无效。
  /// 每个 rule 应该有 `node`、`mark`、`ignore` 属性的其中一个（除非是当 rule 出现在一个 [node](#model.NodeSpec.parseDOM) 或者
  /// [mark spec](#model.MarkSpec.parseDOM) 中时，在这种情况下，`node` 或者 `mark` 属性将会从它的位置推断出来）。
  node?: string

  /// A function used to compute the attributes for the node or mark
  /// created by this rule. Can also be used to describe further
  /// conditions the DOM element or style must match. When it returns
  /// `false`, the rule won't match. When it returns null or undefined,
  /// that is interpreted as an empty/default set of attributes.
  ///
  ///
  /// @cn 用来计算由当前 rule 新建的节点或者 mark 的 attributes。也可以用来描述进一步 DOM 元素或者行内样式匹配的话需要满足的条件。
  /// 当它返回 `false`，则 rule 不会匹配。当它返回 null 或者 undefined，则被当成是一个空的/默认的 attributes 集合。
  getAttrs?: (node: HTMLElement) => Attrs | false | null

  /// For rules that produce non-leaf nodes, by default the content of
  /// the DOM element is parsed as content of the node. If the child
  /// nodes are in a descendent node, this may be a CSS selector
  /// string that the parser must use to find the actual content
  /// element, or a function that returns the actual content element
  /// to the parser.
  ///
  /// @cn 对于 `tag` rule 来说，其产生一个非叶子节点的 node 或者 marks，默认情况下 DOM 元素的内容被 parsed 作为该 mark 或者
  /// 节点的内容。如果子节点在一个子孙节点中，则这个可能是一个 CSS 选择器字符串， parser 必须使用它以寻找实际的内容元素，或者是一个函数，
  /// 为 parser 返回实际的内容元素。
  contentElement?: string | HTMLElement | ((node: DOMNode) => HTMLElement)

  /// Can be used to override the content of a matched node. When
  /// present, instead of parsing the node's child nodes, the result of
  /// this function is used.
  ///
  ///   @cn 如果设置了该方法，则会使用函数返回的结果来作为匹配节点的内容，而不是 parsing 节点的子节点。
  getContent?: (node: DOMNode, schema: Schema) => Fragment

  /// Controls whether whitespace should be preserved when parsing the
  /// content inside the matched element. `false` means whitespace may
  /// be collapsed, `true` means that whitespace should be preserved
  /// but newlines normalized to spaces, and `"full"` means that
  /// newlines should also be preserved.
  ///
  /// @cn 控制当 parsing 匹配元素的内容的时候，空白符是否应该保留。`false` 表示空白符应该不显示，
  /// `true` 表示空白符应该不显示但是换行符会被换成空格，`"full"` 表示换行符也应该被保留。
  preserveWhitespace?: boolean | "full"
}

/// A parse rule targeting a style property.
///
/// @cn 一个针对 CSS 样式属性的 parse rule。
export interface StyleParseRule extends GenericParseRule {
  /// A CSS property name to match. This rule will match inline styles
  /// that list that property. May also have the form
  /// `"property=value"`, in which case the rule only matches if the
  /// property's value exactly matches the given value. (For more
  /// complicated filters, use [`getAttrs`](#model.ParseRule.getAttrs)
  /// and return false to indicate that the match failed.) Rules
  /// matching styles may only produce [marks](#model.ParseRule.mark),
  /// not nodes.
  ///
  /// @cn 需要匹配的 CSS 属性名。如果给定的话，这个 rule 将会匹配包含该属性的行内样式。
  /// 也可以是 `"property=value"` 的形式，这种情况下 property 的值完全符合给定值时 rule 才会匹配。
  /// （对于更复杂的过滤方式，使用 [`getAttrs`](#model.ParseRule.getAttrs)，然后返回 false 表示匹配失败。）
  style: string

  /// Given to make TS see ParseRule as a tagged union @hide
  tag?: undefined

  /// Style rules can remove marks from the set of active marks.
  ///
  /// @cn style rules 可以移除 mark 集合中被激活的 mark。
  clearMark?: (mark: Mark) => boolean

  /// A function used to compute the attributes for the node or mark
  /// created by this rule. Called with the style's value.
  ///
  /// @cn 用来计算由当前 rule 新建的节点或者 mark 的 attributes。
  getAttrs?: (node: string) => Attrs | false | null
}

/// A value that describes how to parse a given DOM node or inline
/// style as a ProseMirror node or mark.
///
/// @cn 一个描述如何解析给定 DOM 节点或者行内样式的 ProseMirror 节点或者 mark 的值。
export type ParseRule = TagParseRule | StyleParseRule

function isTagRule(rule: ParseRule): rule is TagParseRule { return (rule as TagParseRule).tag != null }
function isStyleRule(rule: ParseRule): rule is StyleParseRule { return (rule as StyleParseRule).style != null }

/// A DOM parser represents a strategy for parsing DOM content into a
/// ProseMirror document conforming to a given schema. Its behavior is
/// defined by an array of [rules](#model.ParseRule).
///
/// @cn 一个为了让 ProseMirror 文档符合给定 schema 的 Parser。它的行为由一个 [rules](#model.ParseRule) 数组定义。
export class DOMParser {
  /// @internal
  tags: TagParseRule[] = []
  /// @internal
  styles: StyleParseRule[] = []
  /// @internal
  matchedStyles: readonly string[]
  /// @internal
  normalizeLists: boolean

  /// Create a parser that targets the given schema, using the given
  /// parsing rules.
  ///
  /// @cn 新建一个针对给定 schema 的 parser，使用给定的 parsing rules。
  constructor(
    /// The schema into which the parser parses.
    ///
    /// @cn parser 所 parses 的 schema。
    ///
    /// @comment 解析器所解析的 schema。
    readonly schema: Schema,
    /// The set of [parse rules](#model.ParseRule) that the parser
    /// uses, in order of precedence.
    ///
    /// @cn parser 所使用的 [parse rules](#model.ParseRule)，按顺序优先。
    readonly rules: readonly ParseRule[]
  ) {
    let matchedStyles: string[] = this.matchedStyles = []
    rules.forEach(rule => {
      if (isTagRule(rule)) {
        this.tags.push(rule)
      } else if (isStyleRule(rule)) {
        let prop = /[^=]*/.exec(rule.style)![0]
        if (matchedStyles.indexOf(prop) < 0) matchedStyles.push(prop)
        this.styles.push(rule)
      }
    })

    // Only normalize list elements when lists in the schema can't directly contain themselves
    this.normalizeLists = !this.tags.some(r => {
      if (!/^(ul|ol)\b/.test(r.tag!) || !r.node) return false
      let node = schema.nodes[r.node]
      return node.contentMatch.matchType(node)
    })
  }

  /// Parse a document from the content of a DOM node.
  ///
  /// @cn 从一个 DOM 节点中解析一个文档。
  parse(dom: DOMNode, options: ParseOptions = {}): Node {
    let context = new ParseContext(this, options, false)
    context.addAll(dom, Mark.none, options.from, options.to)
    return context.finish() as Node
  }

  /// Parses the content of the given DOM node, like
  /// [`parse`](#model.DOMParser.parse), and takes the same set of
  /// options. But unlike that method, which produces a whole node,
  /// this one returns a slice that is open at the sides, meaning that
  /// the schema constraints aren't applied to the start of nodes to
  /// the left of the input and the end of nodes at the end.
  ///
  /// @cn parses 给定的 DOM 节点，与 [`parse`](#model.DOMParser.parse) 类似，接受与之相同的参数。
  /// 不过与 parse 方法产生一整个节点不同的是，这个方法返回一个在节点两侧打开的 slice，这意味着 schema
  /// 的约束不适用于输入节点左侧节点的开始位置和末尾节点的结束位置。
  ///
  /// @comment 这表示该方法可能产生一个不受 schema 约束的 node，只是该 node 由于 openStart 和 openEnd 的存在而适合 schema
  /// （被 open 剪切掉以适合 schema，但是整体不适合 schema）。
  parseSlice(dom: DOMNode, options: ParseOptions = {}) {
    let context = new ParseContext(this, options, true)
    context.addAll(dom, Mark.none, options.from, options.to)
    return Slice.maxOpen(context.finish() as Fragment)
  }

  /// @internal
  matchTag(dom: DOMNode, context: ParseContext, after?: TagParseRule) {
    for (let i = after ? this.tags.indexOf(after) + 1 : 0; i < this.tags.length; i++) {
      let rule = this.tags[i]
      if (matches(dom, rule.tag!) &&
          (rule.namespace === undefined || (dom as HTMLElement).namespaceURI == rule.namespace) &&
          (!rule.context || context.matchesContext(rule.context))) {
        if (rule.getAttrs) {
          let result = rule.getAttrs(dom as HTMLElement)
          if (result === false) continue
          rule.attrs = result || undefined
        }
        return rule
      }
    }
  }

  /// @internal
  matchStyle(prop: string, value: string, context: ParseContext, after?: StyleParseRule) {
    for (let i = after ? this.styles.indexOf(after) + 1 : 0; i < this.styles.length; i++) {
      let rule = this.styles[i], style = rule.style!
      if (style.indexOf(prop) != 0 ||
          rule.context && !context.matchesContext(rule.context) ||
          // Test that the style string either precisely matches the prop,
          // or has an '=' sign after the prop, followed by the given
          // value.
          style.length > prop.length &&
          (style.charCodeAt(prop.length) != 61 || style.slice(prop.length + 1) != value))
        continue
      if (rule.getAttrs) {
        let result = rule.getAttrs(value)
        if (result === false) continue
        rule.attrs = result || undefined
      }
      return rule
    }
  }

  /// @internal
  static schemaRules(schema: Schema) {
    let result: ParseRule[] = []
    function insert(rule: ParseRule) {
      let priority = rule.priority == null ? 50 : rule.priority, i = 0
      for (; i < result.length; i++) {
        let next = result[i], nextPriority = next.priority == null ? 50 : next.priority
        if (nextPriority < priority) break
      }
      result.splice(i, 0, rule)
    }

    for (let name in schema.marks) {
      let rules = schema.marks[name].spec.parseDOM
      if (rules) rules.forEach(rule => {
        insert(rule = copy(rule) as ParseRule)
        if (!(rule.mark || rule.ignore || (rule as StyleParseRule).clearMark))
          rule.mark = name
      })
    }
    for (let name in schema.nodes) {
      let rules = schema.nodes[name].spec.parseDOM
      if (rules) rules.forEach(rule => {
        insert(rule = copy(rule) as TagParseRule)
        if (!((rule as TagParseRule).node || rule.ignore || rule.mark))
          rule.node = name
      })
    }
    return result
  }

  /// Construct a DOM parser using the parsing rules listed in a
  /// schema's [node specs](#model.NodeSpec.parseDOM), reordered by
  /// [priority](#model.ParseRule.priority).
  ///
  /// @cn 用给定的 schema 中的 [node 配置对象](#model.NodeSpec.parseDOM) 中的 parsing rule 来构造一个 DOM parser，
  /// 被按 [优先级](#model.ParseRule.priority) 重新排序。
  static fromSchema(schema: Schema) {
    return schema.cached.domParser as DOMParser ||
      (schema.cached.domParser = new DOMParser(schema, DOMParser.schemaRules(schema)))
  }
}

const blockTags: {[tagName: string]: boolean} = {
  address: true, article: true, aside: true, blockquote: true, canvas: true,
  dd: true, div: true, dl: true, fieldset: true, figcaption: true, figure: true,
  footer: true, form: true, h1: true, h2: true, h3: true, h4: true, h5: true,
  h6: true, header: true, hgroup: true, hr: true, li: true, noscript: true, ol: true,
  output: true, p: true, pre: true, section: true, table: true, tfoot: true, ul: true
}

const ignoreTags: {[tagName: string]: boolean} = {
  head: true, noscript: true, object: true, script: true, style: true, title: true
}

const listTags: {[tagName: string]: boolean} = {ol: true, ul: true}

// Using a bitfield for node context options
const OPT_PRESERVE_WS = 1, OPT_PRESERVE_WS_FULL = 2, OPT_OPEN_LEFT = 4

function wsOptionsFor(type: NodeType | null, preserveWhitespace: boolean | "full" | undefined, base: number) {
  if (preserveWhitespace != null) return (preserveWhitespace ? OPT_PRESERVE_WS : 0) |
    (preserveWhitespace === "full" ? OPT_PRESERVE_WS_FULL : 0)
  return type && type.whitespace == "pre" ? OPT_PRESERVE_WS | OPT_PRESERVE_WS_FULL : base & ~OPT_OPEN_LEFT
}

class NodeContext {
  match: ContentMatch | null
  content: Node[] = []

  // Marks applied to the node's children
  activeMarks: readonly Mark[] = Mark.none

  constructor(
    readonly type: NodeType | null,
    readonly attrs: Attrs | null,
    readonly marks: readonly Mark[],
    readonly solid: boolean,
    match: ContentMatch | null,
    readonly options: number
  ) {
    this.match = match || (options & OPT_OPEN_LEFT ? null : type!.contentMatch)
  }

  findWrapping(node: Node) {
    if (!this.match) {
      if (!this.type) return []
      let fill = this.type.contentMatch.fillBefore(Fragment.from(node))
      if (fill) {
        this.match = this.type.contentMatch.matchFragment(fill)!
      } else {
        let start = this.type.contentMatch, wrap
        if (wrap = start.findWrapping(node.type)) {
          this.match = start
          return wrap
        } else {
          return null
        }
      }
    }
    return this.match.findWrapping(node.type)
  }

  finish(openEnd?: boolean): Node | Fragment {
    if (!(this.options & OPT_PRESERVE_WS)) { // Strip trailing whitespace
      let last = this.content[this.content.length - 1], m
      if (last && last.isText && (m = /[ \t\r\n\u000c]+$/.exec(last.text!))) {
        let text = last as TextNode
        if (last.text!.length == m[0].length) this.content.pop()
        else this.content[this.content.length - 1] = text.withText(text.text.slice(0, text.text.length - m[0].length))
      }
    }
    let content = Fragment.from(this.content)
    if (!openEnd && this.match)
      content = content.append(this.match.fillBefore(Fragment.empty, true)!)
    return this.type ? this.type.create(this.attrs, content, this.marks) : content
  }

  inlineContext(node: DOMNode) {
    if (this.type) return this.type.inlineContent
    if (this.content.length) return this.content[0].isInline
    return node.parentNode && !blockTags.hasOwnProperty(node.parentNode.nodeName.toLowerCase())
  }
}

class ParseContext {
  open: number = 0
  find: {node: DOMNode, offset: number, pos?: number}[] | undefined
  needsBlock: boolean
  nodes: NodeContext[]

  constructor(
    // The parser we are using.
    readonly parser: DOMParser,
    // The options passed to this parse.
    readonly options: ParseOptions,
    readonly isOpen: boolean
  ) {
    let topNode = options.topNode, topContext: NodeContext
    let topOptions = wsOptionsFor(null, options.preserveWhitespace, 0) | (isOpen ? OPT_OPEN_LEFT : 0)
    if (topNode)
      topContext = new NodeContext(topNode.type, topNode.attrs, Mark.none, true,
                                   options.topMatch || topNode.type.contentMatch, topOptions)
    else if (isOpen)
      topContext = new NodeContext(null, null, Mark.none, true, null, topOptions)
    else
      topContext = new NodeContext(parser.schema.topNodeType, null, Mark.none, true, null, topOptions)
    this.nodes = [topContext]
    this.find = options.findPositions
    this.needsBlock = false
  }

  get top() {
    return this.nodes[this.open]
  }

  // Add a DOM node to the content. Text is inserted as text node,
  // otherwise, the node is passed to `addElement` or, if it has a
  // `style` attribute, `addElementWithStyles`.
  addDOM(dom: DOMNode, marks: readonly Mark[]) {
    if (dom.nodeType == 3) this.addTextNode(dom as Text, marks)
    else if (dom.nodeType == 1) this.addElement(dom as HTMLElement, marks)
  }

  addTextNode(dom: Text, marks: readonly Mark[]) {
    let value = dom.nodeValue!
    let top = this.top
    if (top.options & OPT_PRESERVE_WS_FULL ||
        top.inlineContext(dom) ||
        /[^ \t\r\n\u000c]/.test(value)) {
      if (!(top.options & OPT_PRESERVE_WS)) {
        value = value.replace(/[ \t\r\n\u000c]+/g, " ")
        // If this starts with whitespace, and there is no node before it, or
        // a hard break, or a text node that ends with whitespace, strip the
        // leading space.
        if (/^[ \t\r\n\u000c]/.test(value) && this.open == this.nodes.length - 1) {
          let nodeBefore = top.content[top.content.length - 1]
          let domNodeBefore = dom.previousSibling
          if (!nodeBefore ||
              (domNodeBefore && domNodeBefore.nodeName == 'BR') ||
              (nodeBefore.isText && /[ \t\r\n\u000c]$/.test(nodeBefore.text!)))
            value = value.slice(1)
        }
      } else if (!(top.options & OPT_PRESERVE_WS_FULL)) {
        value = value.replace(/\r?\n|\r/g, " ")
      } else {
        value = value.replace(/\r\n?/g, "\n")
      }
      if (value) this.insertNode(this.parser.schema.text(value), marks)
      this.findInText(dom)
    } else {
      this.findInside(dom)
    }
  }

  // Try to find a handler for the given tag and use that to parse. If
  // none is found, the element's content nodes are added directly.
  addElement(dom: HTMLElement, marks: readonly Mark[], matchAfter?: TagParseRule) {
    let name = dom.nodeName.toLowerCase(), ruleID: TagParseRule | undefined
    if (listTags.hasOwnProperty(name) && this.parser.normalizeLists) normalizeList(dom)
    let rule = (this.options.ruleFromNode && this.options.ruleFromNode(dom)) ||
        (ruleID = this.parser.matchTag(dom, this, matchAfter))
    if (rule ? rule.ignore : ignoreTags.hasOwnProperty(name)) {
      this.findInside(dom)
      this.ignoreFallback(dom, marks)
    } else if (!rule || rule.skip || rule.closeParent) {
      if (rule && rule.closeParent) this.open = Math.max(0, this.open - 1)
      else if (rule && (rule.skip as any).nodeType) dom = rule.skip as any as HTMLElement
      let sync, top = this.top, oldNeedsBlock = this.needsBlock
      if (blockTags.hasOwnProperty(name)) {
        if (top.content.length && top.content[0].isInline && this.open) {
          this.open--
          top = this.top
        }
        sync = true
        if (!top.type) this.needsBlock = true
      } else if (!dom.firstChild) {
        this.leafFallback(dom, marks)
        return
      }
      let innerMarks = rule && rule.skip ? marks : this.readStyles(dom, marks)
      if (innerMarks) this.addAll(dom, innerMarks)
      if (sync) this.sync(top)
      this.needsBlock = oldNeedsBlock
    } else {
      let innerMarks = this.readStyles(dom, marks)
      if (innerMarks)
        this.addElementByRule(dom, rule as TagParseRule, innerMarks, rule!.consuming === false ? ruleID : undefined)
    }
  }

  // Called for leaf DOM nodes that would otherwise be ignored
  leafFallback(dom: DOMNode, marks: readonly Mark[]) {
    if (dom.nodeName == "BR" && this.top.type && this.top.type.inlineContent)
      this.addTextNode(dom.ownerDocument!.createTextNode("\n"), marks)
  }

  // Called for ignored nodes
  ignoreFallback(dom: DOMNode, marks: readonly Mark[]) {
    // Ignored BR nodes should at least create an inline context
    if (dom.nodeName == "BR" && (!this.top.type || !this.top.type.inlineContent))
      this.findPlace(this.parser.schema.text("-"), marks)
  }

  // Run any style parser associated with the node's styles. Either
  // return an updated array of marks, or null to indicate some of the
  // styles had a rule with `ignore` set.
  readStyles(dom: HTMLElement, marks: readonly Mark[]) {
    let styles = dom.style
    // Because many properties will only show up in 'normalized' form
    // in `style.item` (i.e. text-decoration becomes
    // text-decoration-line, text-decoration-color, etc), we directly
    // query the styles mentioned in our rules instead of iterating
    // over the items.
    if (styles && styles.length) for (let i = 0; i < this.parser.matchedStyles.length; i++) {
      let name = this.parser.matchedStyles[i], value = styles.getPropertyValue(name)
      if (value) for (let after: StyleParseRule | undefined = undefined;;) {
        let rule = this.parser.matchStyle(name, value, this, after)
        if (!rule) break
        if (rule.ignore) return null
        if (rule.clearMark)
          marks = marks.filter(m => !rule!.clearMark!(m))
        else
          marks = marks.concat(this.parser.schema.marks[rule.mark!].create(rule.attrs))
        if (rule.consuming === false) after = rule
        else break
      }
    }
    return marks
  }

  // Look up a handler for the given node. If none are found, return
  // false. Otherwise, apply it, use its return value to drive the way
  // the node's content is wrapped, and return true.
  addElementByRule(dom: HTMLElement, rule: TagParseRule, marks: readonly Mark[], continueAfter?: TagParseRule) {
    let sync, nodeType
    if (rule.node) {
      nodeType = this.parser.schema.nodes[rule.node]
      if (!nodeType.isLeaf) {
        let inner = this.enter(nodeType, rule.attrs || null, marks, rule.preserveWhitespace)
        if (inner) {
          sync = true
          marks = inner
        }
      } else if (!this.insertNode(nodeType.create(rule.attrs), marks)) {
        this.leafFallback(dom, marks)
      }
    } else {
      let markType = this.parser.schema.marks[rule.mark!]
      marks = marks.concat(markType.create(rule.attrs))
    }
    let startIn = this.top

    if (nodeType && nodeType.isLeaf) {
      this.findInside(dom)
    } else if (continueAfter) {
      this.addElement(dom, marks, continueAfter)
    } else if (rule.getContent) {
      this.findInside(dom)
      rule.getContent(dom, this.parser.schema).forEach(node => this.insertNode(node, marks))
    } else {
      let contentDOM = dom
      if (typeof rule.contentElement == "string") contentDOM = dom.querySelector(rule.contentElement)!
      else if (typeof rule.contentElement == "function") contentDOM = rule.contentElement(dom)
      else if (rule.contentElement) contentDOM = rule.contentElement
      this.findAround(dom, contentDOM, true)
      this.addAll(contentDOM, marks)
    }
    if (sync && this.sync(startIn)) this.open--
  }

  // Add all child nodes between `startIndex` and `endIndex` (or the
  // whole node, if not given). If `sync` is passed, use it to
  // synchronize after every block element.
  addAll(parent: DOMNode, marks: readonly Mark[], startIndex?: number, endIndex?: number) {
    let index = startIndex || 0
    for (let dom = startIndex ? parent.childNodes[startIndex] : parent.firstChild,
             end = endIndex == null ? null : parent.childNodes[endIndex];
         dom != end; dom = dom!.nextSibling, ++index) {
      this.findAtPoint(parent, index)
      this.addDOM(dom!, marks)
    }
    this.findAtPoint(parent, index)
  }

  // Try to find a way to fit the given node type into the current
  // context. May add intermediate wrappers and/or leave non-solid
  // nodes that we're in.
  findPlace(node: Node, marks: readonly Mark[]) {
    let route, sync: NodeContext | undefined
    for (let depth = this.open; depth >= 0; depth--) {
      let cx = this.nodes[depth]
      let found = cx.findWrapping(node)
      if (found && (!route || route.length > found.length)) {
        route = found
        sync = cx
        if (!found.length) break
      }
      if (cx.solid) break
    }
    if (!route) return null
    this.sync(sync!)
    for (let i = 0; i < route.length; i++)
      marks = this.enterInner(route[i], null, marks, false)
    return marks
  }

  // Try to insert the given node, adjusting the context when needed.
  insertNode(node: Node, marks: readonly Mark[]) {
    if (node.isInline && this.needsBlock && !this.top.type) {
      let block = this.textblockFromContext()
      if (block) marks = this.enterInner(block, null, marks)
    }
    let innerMarks = this.findPlace(node, marks)
    if (innerMarks) {
      this.closeExtra()
      let top = this.top
      if (top.match) top.match = top.match.matchType(node.type)
      let nodeMarks = Mark.none
      for (let m of innerMarks.concat(node.marks))
        if (top.type ? top.type.allowsMarkType(m.type) : markMayApply(m.type, node.type))
          nodeMarks = m.addToSet(nodeMarks)
      top.content.push(node.mark(nodeMarks))
      return true
    }
    return false
  }

  // Try to start a node of the given type, adjusting the context when
  // necessary.
  enter(type: NodeType, attrs: Attrs | null, marks: readonly Mark[], preserveWS?: boolean | "full") {
    let innerMarks = this.findPlace(type.create(attrs), marks)
    if (innerMarks) innerMarks = this.enterInner(type, attrs, marks, true, preserveWS)
    return innerMarks
  }

  // Open a node of the given type
  enterInner(type: NodeType, attrs: Attrs | null, marks: readonly Mark[],
             solid: boolean = false, preserveWS?: boolean | "full") {
    this.closeExtra()
    let top = this.top
    top.match = top.match && top.match.matchType(type)
    let options = wsOptionsFor(type, preserveWS, top.options)
    if ((top.options & OPT_OPEN_LEFT) && top.content.length == 0) options |= OPT_OPEN_LEFT
    let applyMarks = Mark.none
    marks = marks.filter(m => {
      if (top.type ? top.type.allowsMarkType(m.type) : markMayApply(m.type, type)) {
        applyMarks = m.addToSet(applyMarks)
        return false
      }
      return true
    })
    this.nodes.push(new NodeContext(type, attrs, applyMarks, solid, null, options))
    this.open++
    return marks
  }

  // Make sure all nodes above this.open are finished and added to
  // their parents
  closeExtra(openEnd = false) {
    let i = this.nodes.length - 1
    if (i > this.open) {
      for (; i > this.open; i--) this.nodes[i - 1].content.push(this.nodes[i].finish(openEnd) as Node)
      this.nodes.length = this.open + 1
    }
  }

  finish() {
    this.open = 0
    this.closeExtra(this.isOpen)
    return this.nodes[0].finish(this.isOpen || this.options.topOpen)
  }

  sync(to: NodeContext) {
    for (let i = this.open; i >= 0; i--) if (this.nodes[i] == to) {
      this.open = i
      return true
    }
    return false
  }

  get currentPos() {
    this.closeExtra()
    let pos = 0
    for (let i = this.open; i >= 0; i--) {
      let content = this.nodes[i].content
      for (let j = content.length - 1; j >= 0; j--)
        pos += content[j].nodeSize
      if (i) pos++
    }
    return pos
  }

  findAtPoint(parent: DOMNode, offset: number) {
    if (this.find) for (let i = 0; i < this.find.length; i++) {
      if (this.find[i].node == parent && this.find[i].offset == offset)
        this.find[i].pos = this.currentPos
    }
  }

  findInside(parent: DOMNode) {
    if (this.find) for (let i = 0; i < this.find.length; i++) {
      if (this.find[i].pos == null && parent.nodeType == 1 && parent.contains(this.find[i].node))
        this.find[i].pos = this.currentPos
    }
  }

  findAround(parent: DOMNode, content: DOMNode, before: boolean) {
    if (parent != content && this.find) for (let i = 0; i < this.find.length; i++) {
      if (this.find[i].pos == null && parent.nodeType == 1 && parent.contains(this.find[i].node)) {
        let pos = content.compareDocumentPosition(this.find[i].node)
        if (pos & (before ? 2 : 4))
          this.find[i].pos = this.currentPos
      }
    }
  }

  findInText(textNode: Text) {
    if (this.find) for (let i = 0; i < this.find.length; i++) {
      if (this.find[i].node == textNode)
        this.find[i].pos = this.currentPos - (textNode.nodeValue!.length - this.find[i].offset)
    }
  }

  // Determines whether the given context string matches this context.
  matchesContext(context: string) {
    if (context.indexOf("|") > -1)
      return context.split(/\s*\|\s*/).some(this.matchesContext, this)

    let parts = context.split("/")
    let option = this.options.context
    let useRoot = !this.isOpen && (!option || option.parent.type == this.nodes[0].type)
    let minDepth = -(option ? option.depth + 1 : 0) + (useRoot ? 0 : 1)
    let match = (i: number, depth: number) => {
      for (; i >= 0; i--) {
        let part = parts[i]
        if (part == "") {
          if (i == parts.length - 1 || i == 0) continue
          for (; depth >= minDepth; depth--)
            if (match(i - 1, depth)) return true
          return false
        } else {
          let next = depth > 0 || (depth == 0 && useRoot) ? this.nodes[depth].type
              : option && depth >= minDepth ? option.node(depth - minDepth).type
              : null
          if (!next || (next.name != part && next.groups.indexOf(part) == -1))
            return false
          depth--
        }
      }
      return true
    }
    return match(parts.length - 1, this.open)
  }

  textblockFromContext() {
    let $context = this.options.context
    if ($context) for (let d = $context.depth; d >= 0; d--) {
      let deflt = $context.node(d).contentMatchAt($context.indexAfter(d)).defaultType
      if (deflt && deflt.isTextblock && deflt.defaultAttrs) return deflt
    }
    for (let name in this.parser.schema.nodes) {
      let type = this.parser.schema.nodes[name]
      if (type.isTextblock && type.defaultAttrs) return type
    }
  }
}

// Kludge to work around directly nested list nodes produced by some
// tools and allowed by browsers to mean that the nested list is
// actually part of the list item above it.
function normalizeList(dom: DOMNode) {
  for (let child = dom.firstChild, prevItem: ChildNode | null = null; child; child = child.nextSibling) {
    let name = child.nodeType == 1 ? child.nodeName.toLowerCase() : null
    if (name && listTags.hasOwnProperty(name) && prevItem) {
      prevItem.appendChild(child)
      child = prevItem
    } else if (name == "li") {
      prevItem = child
    } else if (name) {
      prevItem = null
    }
  }
}

// Apply a CSS selector.
function matches(dom: any, selector: string): boolean {
  return (dom.matches || dom.msMatchesSelector || dom.webkitMatchesSelector || dom.mozMatchesSelector).call(dom, selector)
}

function copy(obj: {[prop: string]: any}) {
  let copy: {[prop: string]: any} = {}
  for (let prop in obj) copy[prop] = obj[prop]
  return copy
}

// Used when finding a mark at the top level of a fragment parse.
// Checks whether it would be reasonable to apply a given mark type to
// a given node, by looking at the way the mark occurs in the schema.
function markMayApply(markType: MarkType, nodeType: NodeType) {
  let nodes = nodeType.schema.nodes
  for (let name in nodes) {
    let parent = nodes[name]
    if (!parent.allowsMarkType(markType)) continue
    let seen: ContentMatch[] = [], scan = (match: ContentMatch) => {
      seen.push(match)
      for (let i = 0; i < match.edgeCount; i++) {
        let {type, next} = match.edge(i)
        if (type == nodeType) return true
        if (seen.indexOf(next) < 0 && scan(next)) return true
      }
    }
    if (scan(parent.contentMatch)) return true
  }
}
