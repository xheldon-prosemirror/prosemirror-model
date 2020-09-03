import {Mark} from "./mark"

// ::- You can [_resolve_](#model.Node.resolve) a position to get more
// information about it. Objects of this class represent such a
// resolved position, providing various pieces of context information,
// and some helper methods.
//
// @cn 你可以 [_resolve_](#model.Node.resolve) 一个位置以得到该位置的更多信息。该类的对象就是表示这样一种 resolve 过的位置，
// 它提供一些上下文信息，以及一些有用的工具函数。
//
// Throughout this interface, methods that take an optional `depth`
// parameter will interpret undefined as `this.depth` and negative
// numbers as `this.depth + value`.
// 
// @cn 通过这个接口，对于那些接受可选参数 `depth` 的方法来说，如果没有传入该参数则默认会是 `this.depth`，如果是负数则会是 `this.depth + value`。
export class ResolvedPos {
  constructor(pos, path, parentOffset) {
    // :: number The position that was resolved.
    // 
    // @cn 被 resolve 的位置。
    this.pos = pos
    this.path = path
    // :: number
    // The number of levels the parent node is from the root. If this
    // position points directly into the root node, it is 0. If it
    // points into a top-level paragraph, 1, and so on.
    // 
    // @cn 从根节点开始算，它的父节点的深度。如果位置直接指向根节点，则是 0。如果它指向一个顶级节点如段落，则是 1，以此类推。
    this.depth = path.length / 3 - 1
    // :: number The offset this position has into its parent node.
    // 
    // @cn 该位置相对于父节点的偏移量。
    this.parentOffset = parentOffset
  }

  resolveDepth(val) {
    if (val == null) return this.depth
    if (val < 0) return this.depth + val
    return val
  }

  // :: Node
  // The parent node that the position points into. Note that even if
  // a position points into a text node, that node is not considered
  // the parent—text nodes are ‘flat’ in this model, and have no content.
  // 
  // @cn 该位置指向的父级节点。记住，即使一个位置指向的是文本节点，那该节点也不认为是父级，因为文本节点在 ProseMirror 世界里是 「扁平」的，它没有内容。
  get parent() { return this.node(this.depth) }

  // :: Node
  // The root node in which the position was resolved.
  // 
  // @cn 该位置被 resolve 的根节点。
  get doc() { return this.node(0) }

  // :: (?number) → Node
  // The ancestor node at the given level. `p.node(p.depth)` is the
  // same as `p.parent`.
  // 
  // @cn 在给定深度的祖先节点。p.node(p.depth)` 与 `p.parent` 相同。
  node(depth) { return this.path[this.resolveDepth(depth) * 3] }

  // :: (?number) → number
  // The index into the ancestor at the given level. If this points at
  // the 3rd node in the 2nd paragraph on the top level, for example,
  // `p.index(0)` is 1 and `p.index(1)` is 2.
  // 
  // @cn 在给定深度的祖先节点的 index。例如，如果该位置指向顶级节点的第二个段落的第三个节点，那么 `p.index(0)` 是 1，`p.index(1)` 是 2。
  index(depth) { return this.path[this.resolveDepth(depth) * 3 + 1] }

  // :: (?number) → number
  // The index pointing after this position into the ancestor at the
  // given level.
  // 
  // @cn 在给定深度的祖先节点后面节点的 index。
  indexAfter(depth) {
    depth = this.resolveDepth(depth)
    return this.index(depth) + (depth == this.depth && !this.textOffset ? 0 : 1)
  }

  // :: (?number) → number
  // The (absolute) position at the start of the node at the given
  // level.
  // 
  // @cn 给定深度的祖先节点的开始位置（绝对位置）。
  //
  // @comment 绝对位置是相对于 doc 根节点的位置，一般都是用它来定位。
  start(depth) {
    depth = this.resolveDepth(depth)
    return depth == 0 ? 0 : this.path[depth * 3 - 1] + 1
  }

  // :: (?number) → number
  // The (absolute) position at the end of the node at the given
  // level.
  // 
  // @cn 给定深度的祖先节点的结束位置（绝对位置）。
  end(depth) {
    depth = this.resolveDepth(depth)
    return this.start(depth) + this.node(depth).content.size
  }

  // :: (?number) → number
  // The (absolute) position directly before the wrapping node at the
  // given level, or, when `depth` is `this.depth + 1`, the original
  // position.
  // 
  // @cn 在给定深度的祖先节点之前的（绝对）位置，或者，如果 `depth` 是 `this.depth + 1` 的话，则是原始的位置。
  before(depth) {
    depth = this.resolveDepth(depth)
    if (!depth) throw new RangeError("There is no position before the top-level node")
    return depth == this.depth + 1 ? this.pos : this.path[depth * 3 - 1]
  }

  // :: (?number) → number
  // The (absolute) position directly after the wrapping node at the
  // given level, or the original position when `depth` is `this.depth + 1`.
  // 
  // @cn 在给定深度的祖先节点之后的（绝对）位置，或者如果 `depth` 是 `this.depth + 1` 的话则是原始的位置。
  //
  // @comment 「before 之前」、「start 开始」、「after 之后」、「end 结束」位置的区别：有以下结构 `<p>123</p>`，则（I表示「这个」位置） `I<p>123</p>` 表示 `before`；
  // `<p>I123</p>` 表示 `start`；`<p>123I</p>` 表示 `end`；`<p>123</p>I` 表示 `after`。
  after(depth) {
    depth = this.resolveDepth(depth)
    if (!depth) throw new RangeError("There is no position after the top-level node")
    return depth == this.depth + 1 ? this.pos : this.path[depth * 3 - 1] + this.path[depth * 3].nodeSize
  }

  // :: number
  // When this position points into a text node, this returns the
  // distance between the position and the start of the text node.
  // Will be zero for positions that point between nodes.
  // 
  // @cn 当位置指向一个文本节点，该函数返回当前位置到文本节点开始位置的距离。如果指向节点之间则是 0。
  get textOffset() { return this.pos - this.path[this.path.length - 1] }

  // :: ?Node
  // Get the node directly after the position, if any. If the position
  // points into a text node, only the part of that node after the
  // position is returned.
  // 
  // @cn 获取紧挨着该位置后的节点，如果有的话。如果位置指向一个文本节点，则只有在文本节点中该位置之后的内容会被返回。
  get nodeAfter() {
    let parent = this.parent, index = this.index(this.depth)
    if (index == parent.childCount) return null
    let dOff = this.pos - this.path[this.path.length - 1], child = parent.child(index)
    return dOff ? parent.child(index).cut(dOff) : child
  }

  // :: ?Node
  // Get the node directly before the position, if any. If the
  // position points into a text node, only the part of that node
  // before the position is returned.
  // 
  // @cn 获取紧挨着该位置前的节点，如果有的话。如果位置指向一个文本节点，则只有在文本节点中该位置之前的内容会被返回。
  get nodeBefore() {
    let index = this.index(this.depth)
    let dOff = this.pos - this.path[this.path.length - 1]
    if (dOff) return this.parent.child(index).cut(0, dOff)
    return index == 0 ? null : this.parent.child(index - 1)
  }

  // :: (number, ?number) → number
  // Get the position at the given index in the parent node at the
  // given depth (which defaults to `this.depth`).
  // 
  // @cn 获取在给定深度的祖先节点的给定 index 的位置（深度默认是 `this.depth`)。
  posAtIndex(index, depth) {
    depth = this.resolveDepth(depth)
    let node = this.path[depth * 3], pos = depth == 0 ? 0 : this.path[depth * 3 - 1] + 1
    for (let i = 0; i < index; i++) pos += node.child(i).nodeSize
    return pos
  }

  // :: () → [Mark]
  // Get the marks at this position, factoring in the surrounding
  // marks' [`inclusive`](#model.MarkSpec.inclusive) property. If the
  // position is at the start of a non-empty node, the marks of the
  // node after it (if any) are returned.
  //
  // @cn 充分考虑 marks 们的 [`inclusive`](#model.MarkSpec.inclusive) 属性后，获取当前位置的最终的 marks。如果该位置是在一个非空节点的起始位置，则会返回该位置之后节点的 marks（如果有的话）。
  // 
  // @comment 如果位置在一个空元素内，则返回空的数组（即 Mark 的静态属性，Mark.none)。如果是在一个文本节点中，则简单返回文本节点的 marks。
  // 如果在一个非空节点的起始位置（before 为空），则考虑该位置之后节点的 marks。最后（此时只剩一种情况，也即在一个非文本节点的末尾位置）考虑排除那些设置了 `inclusive` 属性为 false 的 marks 们。
  marks() {
    let parent = this.parent, index = this.index()

    // In an empty parent, return the empty array
    if (parent.content.size == 0) return Mark.none

    // When inside a text node, just return the text node's marks
    if (this.textOffset) return parent.child(index).marks

    let main = parent.maybeChild(index - 1), other = parent.maybeChild(index)
    // If the `after` flag is true of there is no node before, make
    // the node after this position the main reference.
    if (!main) { let tmp = main; main = other; other = tmp }

    // Use all marks in the main node, except those that have
    // `inclusive` set to false and are not present in the other node.
    let marks = main.marks
    for (var i = 0; i < marks.length; i++)
      if (marks[i].type.spec.inclusive === false && (!other || !marks[i].isInSet(other.marks)))
        marks = marks[i--].removeFromSet(marks)

    return marks
  }

  // :: (ResolvedPos) → ?[Mark]
  // Get the marks after the current position, if any, except those
  // that are non-inclusive and not present at position `$end`. This
  // is mostly useful for getting the set of marks to preserve after a
  // deletion. Will return `null` if this position is at the end of
  // its parent node or its parent node isn't a textblock (in which
  // case no marks should be preserved).
  // 
  // @cn 获取在当前位置之后的 marks，如果有的话，会排除那些 inclusive 为 false 以及没有出现在 `$end` 位置的 marks 们。
  // 这个方法最有用的场景是在执行删除操作后获取需要保留的 marks 集合。如果该位置在它的父级节点的结束的地方或者它的父级节点不是一个文本 block，则会返回 null（此时不应该有任何 marks 被保留）。
  marksAcross($end) {
    let after = this.parent.maybeChild(this.index())
    if (!after || !after.isInline) return null

    let marks = after.marks, next = $end.parent.maybeChild($end.index())
    for (var i = 0; i < marks.length; i++)
      if (marks[i].type.spec.inclusive === false && (!next || !marks[i].isInSet(next.marks)))
        marks = marks[i--].removeFromSet(marks)
    return marks
  }

  // :: (number) → number
  // The depth up to which this position and the given (non-resolved)
  // position share the same parent nodes.
  // 
  // @cn 返回在给定位置和当前位置拥有的相同父级节点所在的最大深度。
  sharedDepth(pos) {
    for (let depth = this.depth; depth > 0; depth--)
      if (this.start(depth) <= pos && this.end(depth) >= pos) return depth
    return 0
  }

  // :: (?ResolvedPos, ?(Node) → bool) → ?NodeRange
  // Returns a range based on the place where this position and the
  // given position diverge around block content. If both point into
  // the same textblock, for example, a range around that textblock
  // will be returned. If they point into different blocks, the range
  // around those blocks in their shared ancestor is returned. You can
  // pass in an optional predicate that will be called with a parent
  // node to see if a range into that parent is acceptable.
  // 
  // @cn 根据当前位置与给定位置围绕块级节点的周围看返回相应的 Range。例如，如果两个位置都指向一个文本 block，则文本 block 的 range 会被返回；
  // 如果它们指向不同的块级节点，则包含这些块级节点的深度最大的共同祖先节点 range 将会被返回。你可以传递一个指示函数，来决定该祖先节点是否可接受。
  blockRange(other = this, pred) {
    if (other.pos < this.pos) return other.blockRange(this)
    for (let d = this.depth - (this.parent.inlineContent || this.pos == other.pos ? 1 : 0); d >= 0; d--)
      if (other.pos <= this.end(d) && (!pred || pred(this.node(d))))
        return new NodeRange(this, other, d)
  }

  // :: (ResolvedPos) → bool
  // Query whether the given position shares the same parent node.
  //
  // @cn 当前位置和给定位置是否具有相同的父级节点。
  sameParent(other) {
    return this.pos - this.parentOffset == other.pos - other.parentOffset
  }

  // :: (ResolvedPos) → ResolvedPos
  // Return the greater of this and the given position.
  // 
  // @cn 返回当前位置和给定位置较大的那个。
  max(other) {
    return other.pos > this.pos ? other : this
  }

  // :: (ResolvedPos) → ResolvedPos
  // Return the smaller of this and the given position.
  // 
  // @cn 返回当前位置和给定位置较小的那个。
  min(other) {
    return other.pos < this.pos ? other : this
  }

  toString() {
    let str = ""
    for (let i = 1; i <= this.depth; i++)
      str += (str ? "/" : "") + this.node(i).type.name + "_" + this.index(i - 1)
    return str + ":" + this.parentOffset
  }

  static resolve(doc, pos) {
    if (!(pos >= 0 && pos <= doc.content.size)) throw new RangeError("Position " + pos + " out of range")
    let path = []
    let start = 0, parentOffset = pos
    for (let node = doc;;) {
      let {index, offset} = node.content.findIndex(parentOffset)
      let rem = parentOffset - offset
      path.push(node, index, start + offset)
      if (!rem) break
      node = node.child(index)
      if (node.isText) break
      parentOffset = rem - 1
      start += offset + 1
    }
    return new ResolvedPos(pos, path, parentOffset)
  }

  static resolveCached(doc, pos) {
    for (let i = 0; i < resolveCache.length; i++) {
      let cached = resolveCache[i]
      if (cached.pos == pos && cached.doc == doc) return cached
    }
    let result = resolveCache[resolveCachePos] = ResolvedPos.resolve(doc, pos)
    resolveCachePos = (resolveCachePos + 1) % resolveCacheSize
    return result
  }
}

let resolveCache = [], resolveCachePos = 0, resolveCacheSize = 12

// ::- Represents a flat range of content, i.e. one that starts and
// ends in the same node.
// 
// @cn 表示一个内容的扁平范围（range），例如，一个开始和结束在相同节点的范围。
export class NodeRange {
  // :: (ResolvedPos, ResolvedPos, number)
  // Construct a node range. `$from` and `$to` should point into the
  // same node until at least the given `depth`, since a node range
  // denotes an adjacent set of nodes in a single parent node.
  //
  // @cn 构造一个节点 range。至少深度在 `depth` 及更小的时候 `$from` 和 `$to` 应该始终指向相同的节点，因为一个节点 range 表示具有相同父级节点的相邻节点的集合。
  constructor($from, $to, depth) {
    // :: ResolvedPos A resolved position along the start of the
    // content. May have a `depth` greater than this object's `depth`
    // property, since these are the positions that were used to
    // compute the range, not re-resolved positions directly at its
    // boundaries.
    // 
    // @cn range 的内容开始处 resolve 过的位置。它可能有一个大于该 range 的 `depth` 属性的深度，因为这些位置是用来计算 range 的，其不会直接在 range 的边界再次 resolve。
    this.$from = $from
    // :: ResolvedPos A position along the end of the content. See
    // caveat for [`$from`](#model.NodeRange.$from).
    // 
    // @cn range 的内容结束处 resolve 过的位置。看一下关于 [`$from`](#model.NodeRange.$from) 的警告。
    // 
    // @comment 举个例子：有以下结构 `<ul><li><p>abc</p></li><li><p>123</p><p>456</p></li></ul>` 则构造一个 NodeRange 的时候，如果 $from 在 1 后面位置，
    // $to 在 4 后面位置，则 depth 必须是在第二个 li 的开始位置的深度或者更小，因为如果再深的话，$from 和 $to 就没有共同的父级节点，就无法构建一个 NodeRange。
    // 也因此，$from 和 $to 的 depth 属性是有可能大于 NodeRange 的 depth 属性的。
    this.$to = $to
    // :: number The depth of the node that this range points into.
    // 
    // @cn 该 range 指向的节点的深度。
    this.depth = depth
  }

  // :: number The position at the start of the range.
  // 
  // @cn 该 range 开始的位置。
  get start() { return this.$from.before(this.depth + 1) }
  // :: number The position at the end of the range.
  // 
  // @cn 该 range 结束的位置。
  get end() { return this.$to.after(this.depth + 1) }

  // :: Node The parent node that the range points into.
  // 
  // @cn 该 range 所在的父级节点。
  get parent() { return this.$from.node(this.depth) }
  // :: number The start index of the range in the parent node.
  // 
  // @cn 该 range 在父级节点中的开始处的 index。
  get startIndex() { return this.$from.index(this.depth) }
  // :: number The end index of the range in the parent node.
  // 
  // @cn 该 range 在父级节点中结束处的 index。
  get endIndex() { return this.$to.indexAfter(this.depth) }
}
