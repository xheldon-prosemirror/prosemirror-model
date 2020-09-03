import {Fragment} from "./fragment"

// ReplaceError:: class extends Error
// Error type raised by [`Node.replace`](#model.Node.replace) when
// given an invalid replacement.
// 
// @cn 一种调用 [`Node.replace`](#model.Node.replace) 方法时如果给定替换内容不可用的话会返回的错误类型。
export function ReplaceError(message) {
  let err = Error.call(this, message)
  err.__proto__ = ReplaceError.prototype
  return err
}

ReplaceError.prototype = Object.create(Error.prototype)
ReplaceError.prototype.constructor = ReplaceError
ReplaceError.prototype.name = "ReplaceError"

// ::- A slice represents a piece cut out of a larger document. It
// stores not only a fragment, but also the depth up to which nodes on
// both side are ‘open’ (cut through).
// 
// @cn 一个 slice 表示从大的文档中切出去的一小段片段。它不仅存储着 fragment，还有它两侧的节点「开放」的深度（切割节点产生的）。
export class Slice {
  // :: (Fragment, number, number)
  // Create a slice. When specifying a non-zero open depth, you must
  // make sure that there are nodes of at least that depth at the
  // appropriate side of the fragment—i.e. if the fragment is an empty
  // paragraph node, `openStart` and `openEnd` can't be greater than 1.
  //
  // @cn 新建一个 slice。当指定一个非零的开放深度的时候，你必须保证该 slice 的 fragment 至少在这个深度存在节点。
  // 例如，如果节点是一个空的段落节点，那么 `openStart` 和 `openEnd` 不能大于 1。
  //
  // It is not necessary for the content of open nodes to conform to
  // the schema's content constraints, though it should be a valid
  // start/end/middle for such a node, depending on which sides are
  // open.
  // 
  // @cn 开放节点的内容无需一定要符合 schema 的内容限制，因为对于开放节点来说，它的内容应该被在一个有效的开始/结束/中间位置开放，而这具体取决于节点的哪一侧被打开。
  // 
  // @comment 这句话举个例子比较好理解，如果 schema 内容限制 li 不能包含 p，但如果一个 slice 的 fragment 结构是 `<li><p>123</p><p>456</p></li>`，openStart 是 2，openEnd 也是 2
  // 那么该 slice 切割（打开/开放）出来的节点就会形如 `123</p><p>456`, 因此也是一个有效的 slice，可以被放到文档中需要的地方去（如另个一 p 标签内）。
  constructor(content, openStart, openEnd) {
    // :: Fragment The slice's content.
    // 
    // @cn 该 slice 的内容片段。
    // 
    // @comment 该内容片段以 Fragment 的实例形式存在。
    this.content = content
    // :: number The open depth at the start.
    // 
    // @cn 开始位置的开放深度。
    this.openStart = openStart
    // :: number The open depth at the end.
    // 
    // @cn 结束位置的开放深度。
    this.openEnd = openEnd
  }

  // :: number
  // The size this slice would add when inserted into a document.
  // 
  // @cn 当将插入 slice 到文档中时，插入的内容大小。
  get size() {
    return this.content.size - this.openStart - this.openEnd
  }

  insertAt(pos, fragment) {
    let content = insertInto(this.content, pos + this.openStart, fragment, null)
    return content && new Slice(content, this.openStart, this.openEnd)
  }

  removeBetween(from, to) {
    return new Slice(removeRange(this.content, from + this.openStart, to + this.openStart), this.openStart, this.openEnd)
  }

  // :: (Slice) → bool
  // Tests whether this slice is equal to another slice.
  // 
  // @cn 测试当前 slice 是否与另一个 slice 相等。
  // 
  // @comment 相等比较是比较 slice 的内容，也即调用 fragment 的 eq 方法比较的，而且需要满足 openStart 相等和 openEnd 相等。
  eq(other) {
    return this.content.eq(other.content) && this.openStart == other.openStart && this.openEnd == other.openEnd
  }

  toString() {
    return this.content + "(" + this.openStart + "," + this.openEnd + ")"
  }

  // :: () → ?Object
  // Convert a slice to a JSON-serializable representation.
  // 
  // @cn 返回当前 slice 的 JSON 序列化的表示。
  toJSON() {
    if (!this.content.size) return null
    let json = {content: this.content.toJSON()}
    if (this.openStart > 0) json.openStart = this.openStart
    if (this.openEnd > 0) json.openEnd = this.openEnd
    return json
  }

  // :: (Schema, ?Object) → Slice
  // Deserialize a slice from its JSON representation.
  // 
  // @cn 从 slice 的 JSON 表示形式反序列化出一个 slice。
  static fromJSON(schema, json) {
    if (!json) return Slice.empty
    let openStart = json.openStart || 0, openEnd = json.openEnd || 0
    if (typeof openStart != "number" || typeof openEnd != "number")
      throw new RangeError("Invalid input for Slice.fromJSON")
    return new Slice(Fragment.fromJSON(schema, json.content), openStart, openEnd)
  }

  // :: (Fragment, ?bool) → Slice
  // Create a slice from a fragment by taking the maximum possible
  // open value on both side of the fragment.
  // 
  // @cn 从一个 fragment 新建一个 slice，该 slice 两侧的的打开值尽可能的大。
  static maxOpen(fragment, openIsolating=true) {
    let openStart = 0, openEnd = 0
    for (let n = fragment.firstChild; n && !n.isLeaf && (openIsolating || !n.type.spec.isolating); n = n.firstChild) openStart++
    for (let n = fragment.lastChild; n && !n.isLeaf && (openIsolating || !n.type.spec.isolating); n = n.lastChild) openEnd++
    return new Slice(fragment, openStart, openEnd)
  }
}

function removeRange(content, from, to) {
  let {index, offset} = content.findIndex(from), child = content.maybeChild(index)
  let {index: indexTo, offset: offsetTo} = content.findIndex(to)
  if (offset == from || child.isText) {
    if (offsetTo != to && !content.child(indexTo).isText) throw new RangeError("Removing non-flat range")
    return content.cut(0, from).append(content.cut(to))
  }
  if (index != indexTo) throw new RangeError("Removing non-flat range")
  return content.replaceChild(index, child.copy(removeRange(child.content, from - offset - 1, to - offset - 1)))
}

function insertInto(content, dist, insert, parent) {
  let {index, offset} = content.findIndex(dist), child = content.maybeChild(index)
  if (offset == dist || child.isText) {
    if (parent && !parent.canReplace(index, index, insert)) return null
    return content.cut(0, dist).append(insert).append(content.cut(dist))
  }
  let inner = insertInto(child.content, dist - offset - 1, insert)
  return inner && content.replaceChild(index, child.copy(inner))
}

// :: Slice
// The empty slice.
// 
// @cn 空的 Slice。
Slice.empty = new Slice(Fragment.empty, 0, 0)

export function replace($from, $to, slice) {
  if (slice.openStart > $from.depth)
    throw new ReplaceError("Inserted content deeper than insertion position")
  if ($from.depth - slice.openStart != $to.depth - slice.openEnd)
    throw new ReplaceError("Inconsistent open depths")
  return replaceOuter($from, $to, slice, 0)
}

function replaceOuter($from, $to, slice, depth) {
  let index = $from.index(depth), node = $from.node(depth)
  if (index == $to.index(depth) && depth < $from.depth - slice.openStart) {
    let inner = replaceOuter($from, $to, slice, depth + 1)
    return node.copy(node.content.replaceChild(index, inner))
  } else if (!slice.content.size) {
    return close(node, replaceTwoWay($from, $to, depth))
  } else if (!slice.openStart && !slice.openEnd && $from.depth == depth && $to.depth == depth) { // Simple, flat case
    let parent = $from.parent, content = parent.content
    return close(parent, content.cut(0, $from.parentOffset).append(slice.content).append(content.cut($to.parentOffset)))
  } else {
    let {start, end} = prepareSliceForReplace(slice, $from)
    return close(node, replaceThreeWay($from, start, end, $to, depth))
  }
}

function checkJoin(main, sub) {
  if (!sub.type.compatibleContent(main.type))
    throw new ReplaceError("Cannot join " + sub.type.name + " onto " + main.type.name)
}

function joinable($before, $after, depth) {
  let node = $before.node(depth)
  checkJoin(node, $after.node(depth))
  return node
}

function addNode(child, target) {
  let last = target.length - 1
  if (last >= 0 && child.isText && child.sameMarkup(target[last]))
    target[last] = child.withText(target[last].text + child.text)
  else
    target.push(child)
}

function addRange($start, $end, depth, target) {
  let node = ($end || $start).node(depth)
  let startIndex = 0, endIndex = $end ? $end.index(depth) : node.childCount
  if ($start) {
    startIndex = $start.index(depth)
    if ($start.depth > depth) {
      startIndex++
    } else if ($start.textOffset) {
      addNode($start.nodeAfter, target)
      startIndex++
    }
  }
  for (let i = startIndex; i < endIndex; i++) addNode(node.child(i), target)
  if ($end && $end.depth == depth && $end.textOffset)
    addNode($end.nodeBefore, target)
}

function close(node, content) {
  if (!node.type.validContent(content))
    throw new ReplaceError("Invalid content for node " + node.type.name)
  return node.copy(content)
}

function replaceThreeWay($from, $start, $end, $to, depth) {
  let openStart = $from.depth > depth && joinable($from, $start, depth + 1)
  let openEnd = $to.depth > depth && joinable($end, $to, depth + 1)

  let content = []
  addRange(null, $from, depth, content)
  if (openStart && openEnd && $start.index(depth) == $end.index(depth)) {
    checkJoin(openStart, openEnd)
    addNode(close(openStart, replaceThreeWay($from, $start, $end, $to, depth + 1)), content)
  } else {
    if (openStart)
      addNode(close(openStart, replaceTwoWay($from, $start, depth + 1)), content)
    addRange($start, $end, depth, content)
    if (openEnd)
      addNode(close(openEnd, replaceTwoWay($end, $to, depth + 1)), content)
  }
  addRange($to, null, depth, content)
  return new Fragment(content)
}

function replaceTwoWay($from, $to, depth) {
  let content = []
  addRange(null, $from, depth, content)
  if ($from.depth > depth) {
    let type = joinable($from, $to, depth + 1)
    addNode(close(type, replaceTwoWay($from, $to, depth + 1)), content)
  }
  addRange($to, null, depth, content)
  return new Fragment(content)
}

function prepareSliceForReplace(slice, $along) {
  let extra = $along.depth - slice.openStart, parent = $along.node(extra)
  let node = parent.copy(slice.content)
  for (let i = extra - 1; i >= 0; i--)
    node = $along.node(i).copy(Fragment.from(node))
  return {start: node.resolveNoCache(slice.openStart + extra),
          end: node.resolveNoCache(node.content.size - slice.openEnd - extra)}
}
