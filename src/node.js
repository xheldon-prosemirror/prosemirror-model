import {Fragment} from "./fragment"
import {Mark} from "./mark"
import {Slice, replace} from "./replace"
import {ResolvedPos} from "./resolvedpos"
import {compareDeep} from "./comparedeep"

const emptyAttrs = Object.create(null)

// ::- This class represents a node in the tree that makes up a
// ProseMirror document. So a document is an instance of `Node`, with
// children that are also instances of `Node`.
//  
// @cn 这个类表示 ProseMirror 中组成文档树的节点，因此一个文档就是一个 `Node` 的实例，以及它的子节点同样是 `Node` 的实例。
//
// Nodes are persistent data structures. Instead of changing them, you
// create new ones with the content you want. Old ones keep pointing
// at the old document shape. This is made cheaper by sharing
// structure between the old and new data as much as possible, which a
// tree shape like this (without back pointers) makes easy.
//
// @cn 节点都是一些持久化的数据结构。每次更新会创建一个新的节点与一些你想要的内容，而不是改变旧的节点。旧的节点始终保持旧文档的引用。
// 这使得在旧的和新的数据之间共享结构变得容易，因为像这样的树状结构没有「向后的指针」（？）
//
// **Do not** directly mutate the properties of a `Node` object. See
// [the guide](/docs/guide/#doc) for more information.
//
// @cn **不要** 直接修改 `Node` 对象的属性。查看 [中文指南](https://www.xheldon.com/prosemirror-guide-chinese.html) 的「Documents」一节，获取更多信息。
export class Node {
  constructor(type, attrs, content, marks) {
    // :: NodeType
    // The type of node that this is.
    //
    // @cn 当前节点的类型。
    this.type = type

    // :: Object
    // An object mapping attribute names to values. The kind of
    // attributes allowed and required are
    // [determined](#model.NodeSpec.attrs) by the node type.
    //
    // @cn 一个键值对。允许的和需要的 attributes [取决于](#model.NodeSpec.attrs) 节点类型。
    this.attrs = attrs

    // :: Fragment
    // A container holding the node's children.
    // 
    // @cn 一个持有节点子元素的容器。
    //
    // @comment 该容器是 Fragment 类型
    this.content = content || Fragment.empty

    // :: [Mark]
    // The marks (things like whether it is emphasized or part of a
    // link) applied to this node.
    //
    // @cn 应用到当前节点的 marks（marks 是一些类似于加粗或者链接一样的节点）
    this.marks = marks || Mark.none
  }

  // text:: ?string
  // For text nodes, this contains the node's text content.
  //
  // @cn 对于文本节点，它包含了节点的文本内容。

  // :: number
  // The size of this node, as defined by the integer-based [indexing
  // scheme](/docs/guide/#doc.indexing). For text nodes, this is the
  // amount of characters. For other leaf nodes, it is one. For
  // non-leaf nodes, it is the size of the content plus two (the start
  // and end token).
  //
  // @cn 表示该节点的大小，由基于整数的 [indexing scheme](https://www.xheldon.com/prosemirror-guide-chinese.html) 决定。
  // 对于文本节点，它是字符数，对于其他叶子节点，是 1。对于非叶子节点，它是其内容的大小加上 2（开始和结束标签）。
  //
  // @comment indexing scheme 链接指向中文翻译指南，请搜索 Document 一节 下的 Indexing 一节。
  get nodeSize() { return this.isLeaf ? 1 : 2 + this.content.size }

  // :: number
  // The number of children that the node has.
  //
  // @cn 该节点拥有的子节点个数。
  get childCount() { return this.content.childCount }

  // :: (number) → Node
  // Get the child node at the given index. Raises an error when the
  // index is out of range.
  //
  // @cn 获取给定 index 处的子节点。如果 index 超出范围，则返回错误。
  child(index) { return this.content.child(index) }

  // :: (number) → ?Node
  // Get the child node at the given index, if it exists.
  //
  // @cn 获取给定 index 处的子节点，如果存在的话。
  //
  // @comment 不存在返回 undefined。
  maybeChild(index) { return this.content.maybeChild(index) }

  // :: ((node: Node, offset: number, index: number))
  // Call `f` for every child node, passing the node, its offset
  // into this parent node, and its index.
  // 
  // @cn 对每个子节点调用 `f` 函数，参数是子节点、子节点相对于当前节点的偏移以及它的 index。
  forEach(f) { this.content.forEach(f) }

  // :: (number, number, (node: Node, pos: number, parent: Node, index: number) → ?bool, ?number)
  // Invoke a callback for all descendant nodes recursively between
  // the given two positions that are relative to start of this node's
  // content. The callback is invoked with the node, its
  // parent-relative position, its parent node, and its child index.
  // When the callback returns false for a given node, that node's
  // children will not be recursed over. The last parameter can be
  // used to specify a starting position to count from.
  //
  // @cn 在相对于当前节点内容开始位置的两个位置之间对所有的后代节点递归的调用 `f` 回调。
  // 回调的参数是后代节点、后代节点开始位置相对于当前节点的偏移、后代节点的父节点、以及它在父节点中的 index。
  nodesBetween(from, to, f, startPos = 0) {
    this.content.nodesBetween(from, to, f, startPos, this)
  }

  // :: ((node: Node, pos: number, parent: Node) → ?bool)
  // Call the given callback for every descendant node. Doesn't
  // descend into a node when the callback returns `false`.
  // 
  // @cn 对每一个后代节点调用给定的回调函数 `f`。当回调处理一个节点的时候返回 false ，则后续不会继续对该节点的子节点再调用该回调了。
  //
  // @comment 上述递归都是深度优先。
  descendants(f) {
    this.nodesBetween(0, this.content.size, f)
  }

  // :: string
  // Concatenates all the text nodes found in this fragment and its
  // children.
  //
  // @cn 该节点的所有文本内容连接为一个字符串返回。
  get textContent() { return this.textBetween(0, this.content.size, "") }

  // :: (number, number, ?string, ?string) → string
  // Get all text between positions `from` and `to`. When
  // `blockSeparator` is given, it will be inserted whenever a new
  // block node is started. When `leafText` is given, it'll be
  // inserted for every non-text leaf node encountered.
  //
  // @cn 获取 `from` 和 `to` 之间的所有文本内容。当 `blockSeparator` 给定的时候，它将会插入到每一个新的块级节点开始的地方。
  // 当 `leafText` 给定的时候，它将会插入到遇到的每一个非文本叶子节点后面。
  textBetween(from, to, blockSeparator, leafText) {
    return this.content.textBetween(from, to, blockSeparator, leafText)
  }

  // :: ?Node
  // Returns this node's first child, or `null` if there are no
  // children.
  //
  // @cn 返回节点的第一个子节点，如果没有则是 `null`。
  get firstChild() { return this.content.firstChild }

  // :: ?Node
  // Returns this node's last child, or `null` if there are no
  // children.
  // 
  // @cn 返回节点的最后一个子节点，如果没有则是 `null`。
  get lastChild() { return this.content.lastChild }

  // :: (Node) → bool
  // Test whether two nodes represent the same piece of document.
  //
  // @cn 测试两个节点是否表示的是文档中相同的部分。
  //
  // @comment 比较的手段是先比较节点的引用，如果相等直接为 true；否则比较 markup 是否相等，如果不是则返回 false，如果是再递归比较二者的子节点。
  //
  // @comment markup 指的是节点类型、节点 attributes、和其上的 marks。
  eq(other) {
    return this == other || (this.sameMarkup(other) && this.content.eq(other.content))
  }

  // :: (Node) → bool
  // Compare the markup (type, attributes, and marks) of this node to
  // those of another. Returns `true` if both have the same markup.
  // 
  // @cn 比较当前与给定节点的 markup（包含类型、attributes 和 marks）是否相等。如果相同返回 `true`。
  sameMarkup(other) {
    return this.hasMarkup(other.type, other.attrs, other.marks)
  }

  // :: (NodeType, ?Object, ?[Mark]) → bool
  // Check whether this node's markup correspond to the given type,
  // attributes, and marks.
  // 
  // @cn 检查节点是否有给定的类型、attributes 和 marks。
  hasMarkup(type, attrs, marks) {
    return this.type == type &&
      compareDeep(this.attrs, attrs || type.defaultAttrs || emptyAttrs) &&
      Mark.sameSet(this.marks, marks || Mark.none)
  }

  // :: (?Fragment) → Node
  // Create a new node with the same markup as this node, containing
  // the given content (or empty, if no content is given).
  //
  // @cn 新建一个与当前节点有相同 markup 的节点，包含给定的内容（如果没有给定内容则为空）。
  copy(content = null) {
    if (content == this.content) return this
    return new this.constructor(this.type, this.attrs, content, this.marks)
  }

  // :: ([Mark]) → Node
  // Create a copy of this node, with the given set of marks instead
  // of the node's own marks.
  //
  // @cn 新建一个当前节点的副本，包含给定的 marks，而不是当前节点原始的 marks。
  mark(marks) {
    return marks == this.marks ? this : new this.constructor(this.type, this.attrs, this.content, marks)
  }

  // :: (number, ?number) → Node
  // Create a copy of this node with only the content between the
  // given positions. If `to` is not given, it defaults to the end of
  // the node.
  // 
  // @cn 创建一个当前节点的副本，该节点仅包含给定位置范围的内容。如果 `to` 没有给定，则默认是当前节点的结束位置。
  cut(from, to) {
    if (from == 0 && to == this.content.size) return this
    return this.copy(this.content.cut(from, to))
  }

  // :: (number, ?number) → Slice
  // Cut out the part of the document between the given positions, and
  // return it as a `Slice` object.
  //
  // @cn 剪切文档给定位置范围的部分，然后作为 `Slice` 对象返回。
  slice(from, to = this.content.size, includeParents = false) {
    if (from == to) return Slice.empty

    let $from = this.resolve(from), $to = this.resolve(to)
    let depth = includeParents ? 0 : $from.sharedDepth(to)
    let start = $from.start(depth), node = $from.node(depth)
    let content = node.content.cut($from.pos - start, $to.pos - start)
    return new Slice(content, $from.depth - depth, $to.depth - depth)
  }

  // :: (number, number, Slice) → Node
  // Replace the part of the document between the given positions with
  // the given slice. The slice must 'fit', meaning its open sides
  // must be able to connect to the surrounding content, and its
  // content nodes must be valid children for the node they are placed
  // into. If any of this is violated, an error of type
  // [`ReplaceError`](#model.ReplaceError) is thrown.
  //
  // @cn 用给定的 slice 替换给定位置范围的文档内容。slice 必须「适合」该位置范围，也就是说，slice 打开的两侧必须能够正确的连接它两侧被切开的周围的内容，
  // 同时它的子节点也必须符合放入位置的祖先节点的 scheme 约束。如果有任何违背，那么将会抛出一个 [`ReplaceError`](#model.ReplaceError)。
  replace(from, to, slice) {
    return replace(this.resolve(from), this.resolve(to), slice)
  }

  // :: (number) → ?Node
  // Find the node directly after the given position.
  //
  // @cn 返回给定位置右侧的节点。
  // 
  // @commetn 「右侧」为紧挨着给定位置的右侧节点，不存在则为 null。
  nodeAt(pos) {
    for (let node = this;;) {
      let {index, offset} = node.content.findIndex(pos)
      node = node.maybeChild(index)
      if (!node) return null
      if (offset == pos || node.isText) return node
      pos -= offset + 1
    }
  }

  // :: (number) → {node: ?Node, index: number, offset: number}
  // Find the (direct) child node after the given offset, if any,
  // and return it along with its index and offset relative to this
  // node.
  // 
  // @cn 如果有的话，返回给定偏移量后面的直接子节点，同时返回它的 index 以及相对于当前节点的偏移。
  childAfter(pos) {
    let {index, offset} = this.content.findIndex(pos)
    return {node: this.content.maybeChild(index), index, offset}
  }

  // :: (number) → {node: ?Node, index: number, offset: number}
  // Find the (direct) child node before the given offset, if any,
  // and return it along with its index and offset relative to this
  // node.
  //
  // @cn 如果有的话，返回给定偏移量前面的直接子节点，同时返回它的 index 以及相对于当前节点的偏移。
  childBefore(pos) {
    if (pos == 0) return {node: null, index: 0, offset: 0}
    let {index, offset} = this.content.findIndex(pos)
    if (offset < pos) return {node: this.content.child(index), index, offset}
    let node = this.content.child(index - 1)
    return {node, index: index - 1, offset: offset - node.nodeSize}
  }

  // :: (number) → ResolvedPos
  // Resolve the given position in the document, returning an
  // [object](#model.ResolvedPos) with information about its context.
  // 
  // @cn resolve 文档中给定的位置，返回一个关于此位置上下文信息的 [object](#model.ResolvedPos)。
  resolve(pos) { return ResolvedPos.resolveCached(this, pos) }

  resolveNoCache(pos) { return ResolvedPos.resolve(this, pos) }

  // :: (number, number, union<Mark, MarkType>) → bool
  // Test whether a given mark or mark type occurs in this document
  // between the two given positions.
  // 
  // @cn 测试文档中给定的位置范围内是否有给定的 mark 或者 mark 类型。
  rangeHasMark(from, to, type) {
    let found = false
    if (to > from) this.nodesBetween(from, to, node => {
      if (type.isInSet(node.marks)) found = true
      return !found
    })
    return found
  }

  // :: bool
  // True when this is a block (non-inline node)
  //
  // @cn 是否是一个块级节点（非内联节点的都是块级节点）。
  get isBlock() { return this.type.isBlock }

  // :: bool
  // True when this is a textblock node, a block node with inline
  // content.
  //
  // @cn 是否是一个文本块节点（textblock），即有内联内容的块级节点。
  get isTextblock() { return this.type.isTextblock }

  // :: bool
  // True when this node allows inline content.
  //
  // @cn 节点是否允许内联内容。
  get inlineContent() { return this.type.inlineContent }

  // :: bool
  // True when this is an inline node (a text node or a node that can
  // appear among text).
  //
  // @cn 节点是否是内联节点（文本节点或者能够出现在文本之间的节点都是内联节点）。
  get isInline() { return this.type.isInline }

  // :: bool
  // True when this is a text node.
  // 
  // @cn 是否是文本节点。
  get isText() { return this.type.isText }

  // :: bool
  // True when this is a leaf node.
  // 
  // @cn 是否是一个叶子节点。
  get isLeaf() { return this.type.isLeaf }

  // :: bool
  // True when this is an atom, i.e. when it does not have directly
  // editable content. This is usually the same as `isLeaf`, but can
  // be configured with the [`atom` property](#model.NodeSpec.atom) on
  // a node's spec (typically used when the node is displayed as an
  // uneditable [node view](#view.NodeView)).
  // 
  // @cn 是否是一个原子节点，例如，它没有一个直接可编辑的内容。它的值通常与 `isLeaf` 一样，不过可以通过节点配置对象上的 [`atom` 属性](#model.NodeSpec.atom) 进行设置。
  // （典型的使用场景是节点展示成一个不可编辑的 [node view](#view.NodeView)）。
  get isAtom() { return this.type.isAtom }

  // :: () → string
  // Return a string representation of this node for debugging
  // purposes.
  //
  // @cn 为了 debug 目的获取当前节点的字符串表示。
  toString() {
    if (this.type.spec.toDebugString) return this.type.spec.toDebugString(this)
    let name = this.type.name
    if (this.content.size)
      name += "(" + this.content.toStringInner() + ")"
    return wrapMarks(this.marks, name)
  }

  // :: (number) → ContentMatch
  // Get the content match in this node at the given index.
  //
  // @cn 获取当前节点给定 index 的 content match。
  //
  // @comment content match 在 ProseMirror 中也是一个专有名词。
  contentMatchAt(index) {
    let match = this.type.contentMatch.matchFragment(this.content, 0, index)
    if (!match) throw new Error("Called contentMatchAt on a node with invalid content")
    return match
  }

  // :: (number, number, ?Fragment, ?number, ?number) → bool
  // Test whether replacing the range between `from` and `to` (by
  // child index) with the given replacement fragment (which defaults
  // to the empty fragment) would leave the node's content valid. You
  // can optionally pass `start` and `end` indices into the
  // replacement fragment.
  //
  // @cn 测试用给定的 fragment（默认是空的 fragment） 替换 `from` 到 `to`（from 和 to 是子节点位置 index） 之间的内容是否合法（即符合 schema 约束）。
  // 你可以可选的传入 `start` 和 `end`（start 和 end 都是子节点的位置 index）以只用 fragment 的一部分替换。
  canReplace(from, to, replacement = Fragment.empty, start = 0, end = replacement.childCount) {
    let one = this.contentMatchAt(from).matchFragment(replacement, start, end)
    let two = one && one.matchFragment(this.content, to)
    if (!two || !two.validEnd) return false
    for (let i = start; i < end; i++) if (!this.type.allowsMarks(replacement.child(i).marks)) return false
    return true
  }

  // :: (number, number, NodeType, ?[Mark]) → bool
  // Test whether replacing the range `from` to `to` (by index) with a
  // node of the given type would leave the node's content valid.
  //
  // @cn 测试用给定的节点类型替换当前节点 `from` 到 `to` index 之间的子元素是否合法。
  canReplaceWith(from, to, type, marks) {
    if (marks && !this.type.allowsMarks(marks)) return false
    let start = this.contentMatchAt(from).matchType(type)
    let end = start && start.matchFragment(this.content, to)
    return end ? end.validEnd : false
  }

  // :: (Node) → bool
  // Test whether the given node's content could be appended to this
  // node. If that node is empty, this will only return true if there
  // is at least one node type that can appear in both nodes (to avoid
  // merging completely incompatible nodes).
  // 
  // @cn 测试给定节点的内容可以被附加到当前节点最后。如果给定节点是空的，那么只有当至少一个节点类型能够出现在这两个节点之内的时候才会返回 true（以避免合并完全不兼容的节点）。
  canAppend(other) {
    if (other.content.size) return this.canReplace(this.childCount, this.childCount, other.content)
    else return this.type.compatibleContent(other.type)
  }

  // :: ()
  // Check whether this node and its descendants conform to the
  // schema, and raise error when they do not.
  // 
  // @cn 检查当前节点和节点的所有后代是否符合当前节点的 schema，如果不符合的话会抛出一个错误。
  check() {
    if (!this.type.validContent(this.content))
      throw new RangeError(`Invalid content for node ${this.type.name}: ${this.content.toString().slice(0, 50)}`)
    this.content.forEach(node => node.check())
  }

  // :: () → Object
  // Return a JSON-serializeable representation of this node.
  //
  // @cn 返回一个当前节点 JSON 序列化的表示。
  //
  // @comment 不像我们认为的 JSON 序列化后与 `stringify` 过一样是个字符串，这里的序列化后是个对象。
  toJSON() {
    let obj = {type: this.type.name}
    for (let _ in this.attrs) {
      obj.attrs = this.attrs
      break
    }
    if (this.content.size)
      obj.content = this.content.toJSON()
    if (this.marks.length)
      obj.marks = this.marks.map(n => n.toJSON())
    return obj
  }

  // :: (Schema, Object) → Node
  // Deserialize a node from its JSON representation.
  // 
  // @cn 从一个节点 JSON 序列化的对象中反序列化出 Node 节点。
  static fromJSON(schema, json) {
    if (!json) throw new RangeError("Invalid input for Node.fromJSON")
    let marks = null
    if (json.marks) {
      if (!Array.isArray(json.marks)) throw new RangeError("Invalid mark data for Node.fromJSON")
      marks = json.marks.map(schema.markFromJSON)
    }
    if (json.type == "text") {
      if (typeof json.text != "string") throw new RangeError("Invalid text node in JSON")
      return schema.text(json.text, marks)
    }
    let content = Fragment.fromJSON(schema, json.content)
    return schema.nodeType(json.type).create(json.attrs, content, marks)
  }
}

export class TextNode extends Node {
  constructor(type, attrs, content, marks) {
    super(type, attrs, null, marks)

    if (!content) throw new RangeError("Empty text nodes are not allowed")

    this.text = content
  }

  toString() {
    if (this.type.spec.toDebugString) return this.type.spec.toDebugString(this)
    return wrapMarks(this.marks, JSON.stringify(this.text))
  }

  get textContent() { return this.text }

  textBetween(from, to) { return this.text.slice(from, to) }

  get nodeSize() { return this.text.length }

  mark(marks) {
    return marks == this.marks ? this : new TextNode(this.type, this.attrs, this.text, marks)
  }

  withText(text) {
    if (text == this.text) return this
    return new TextNode(this.type, this.attrs, text, this.marks)
  }

  cut(from = 0, to = this.text.length) {
    if (from == 0 && to == this.text.length) return this
    return this.withText(this.text.slice(from, to))
  }

  eq(other) {
    return this.sameMarkup(other) && this.text == other.text
  }

  toJSON() {
    let base = super.toJSON()
    base.text = this.text
    return base
  }
}

function wrapMarks(marks, str) {
  for (let i = marks.length - 1; i >= 0; i--)
    str = marks[i].type.name + "(" + str + ")"
  return str
}
