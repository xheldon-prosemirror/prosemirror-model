import {findDiffStart, findDiffEnd} from "./diff"
import {Node, TextNode} from "./node"
import {Schema} from "./schema"

/// A fragment represents a node's collection of child nodes.
///
/// @cn 一个 fragment 表示了节点的子节点集合。
///
/// Like nodes, fragments are persistent data structures, and you
/// should not mutate them or their content. Rather, you create new
/// instances whenever needed. The API tries to make this easy.
///
/// @cn 像 nodes 一样，fragment 也是一个持久化数据结构，你不应该直接修改他们或者他们的内容，而应该创建一个新的实例。下面的 API 就是用来试图将这件事变得容易。
export class Fragment {
  /// The size of the fragment, which is the total of the size of
  /// its content nodes.
  /// 
  /// @cn fragment 的大小，也即它的内容节点大小的总和。
  readonly size: number

  /// @internal
  constructor(
    /// @internal
    readonly content: readonly Node[],
    size?: number
  ) {
    this.size = size || 0
    if (size == null) for (let i = 0; i < content.length; i++)
      this.size += content[i].nodeSize
  }

  /// Invoke a callback for all descendant nodes between the given two
  /// positions (relative to start of this fragment). Doesn't descend
  /// into a node when the callback returns `false`.
  /// 
  /// @cn 对相对于 fragment 开始位置的两个位置范围内的节点调用 `f` 回调。如果某个节点的回调返回 `false`，则不会对该节点的内部节点再调用该回调了。
  nodesBetween(from: number, to: number,
               f: (node: Node, start: number, parent: Node | null, index: number) => boolean | void,
               nodeStart = 0,
               parent?: Node) {
    for (let i = 0, pos = 0; pos < to; i++) {
      let child = this.content[i], end = pos + child.nodeSize
      if (end > from && f(child, nodeStart + pos, parent || null, i) !== false && child.content.size) {
        let start = pos + 1
        child.nodesBetween(Math.max(0, from - start),
                           Math.min(child.content.size, to - start),
                           f, nodeStart + start)
      }
      pos = end
    }
  }

  /// Call the given callback for every descendant node. `pos` will be
  /// relative to the start of the fragment. The callback may return
  /// `false` to prevent traversal of a given node's children.
  /// 
  /// @cn 对所有的后代元素递归调用给定的回调。如果某个节点回调返回 `false` 表示阻止再对该节点的子节点调用回调。
  descendants(f: (node: Node, pos: number, parent: Node | null, index: number) => boolean | void) {
    this.nodesBetween(0, this.size, f)
  }

  /// Extract the text between `from` and `to`. See the same method on
  /// [`Node`](#model.Node.textBetween).
  ///
  /// @cn 获取从 `from` 到 `to` 位置的文本. 是 [`Node`](#model.Node.textBetween) 的具体实现
  textBetween(from: number, to: number, blockSeparator?: string | null, leafText?: string | null | ((leafNode: Node) => string)) {
    let text = "", first = true
    this.nodesBetween(from, to, (node, pos) => {
      let nodeText = node.isText ? node.text!.slice(Math.max(from, pos) - pos, to - pos)
        : !node.isLeaf ? ""
        : leafText ? (typeof leafText === "function" ? leafText(node) : leafText)
        : node.type.spec.leafText ? node.type.spec.leafText(node)
        : ""
      if (node.isBlock && (node.isLeaf && nodeText || node.isTextblock) && blockSeparator) {
        if (first) first = false
        else text += blockSeparator
      }
      text += nodeText
    }, 0)
    return text
  }

  /// Create a new fragment containing the combined content of this
  /// fragment and the other.
  ///
  /// @cn 创建一个包含当前 fragment 内容和给定 fragment 内容的新的 fragment。
  append(other: Fragment) {
    if (!other.size) return this
    if (!this.size) return other
    let last = this.lastChild!, first = other.firstChild!, content = this.content.slice(), i = 0
    if (last.isText && last.sameMarkup(first)) {
      content[content.length - 1] = (last as TextNode).withText(last.text! + first.text!)
      i = 1
    }
    for (; i < other.content.length; i++) content.push(other.content[i])
    return new Fragment(content, this.size + other.size)
  }

  /// Cut out the sub-fragment between the two given positions.
  ///
  /// @cn 从 fragment 剪切出给定范围的一个子 fragment。
  cut(from: number, to = this.size) {
    if (from == 0 && to == this.size) return this
    let result: Node[] = [], size = 0
    if (to > from) for (let i = 0, pos = 0; pos < to; i++) {
      let child = this.content[i], end = pos + child.nodeSize
      if (end > from) {
        if (pos < from || end > to) {
          if (child.isText)
            child = child.cut(Math.max(0, from - pos), Math.min(child.text!.length, to - pos))
          else
            child = child.cut(Math.max(0, from - pos - 1), Math.min(child.content.size, to - pos - 1))
        }
        result.push(child)
        size += child.nodeSize
      }
      pos = end
    }
    return new Fragment(result, size)
  }

  /// @internal
  cutByIndex(from: number, to: number) {
    if (from == to) return Fragment.empty
    if (from == 0 && to == this.content.length) return this
    return new Fragment(this.content.slice(from, to))
  }

  /// Create a new fragment in which the node at the given index is
  /// replaced by the given node.
  /// 
  /// @cn 将 fragment 中的给定 index 位置的节点用给定节点替换掉后，创建一个新的 fragment。
  replaceChild(index: number, node: Node) {
    let current = this.content[index]
    if (current == node) return this
    let copy = this.content.slice()
    let size = this.size + node.nodeSize - current.nodeSize
    copy[index] = node
    return new Fragment(copy, size)
  }

  /// Create a new fragment by prepending the given node to this
  /// fragment.
  /// 
  /// @cn 将给定的节点添加到 fragment 起始位置后，返回得到的新的 fragment。
  addToStart(node: Node) {
    return new Fragment([node].concat(this.content), this.size + node.nodeSize)
  }

  /// Create a new fragment by appending the given node to this
  /// fragment.
  /// 
  /// @cn 将给定的节点添加到 fragment 的末尾位置后，返回得到的新的 fragment。
  addToEnd(node: Node) {
    return new Fragment(this.content.concat(node), this.size + node.nodeSize)
  }

  /// Compare this fragment to another one.
  /// 
  /// @cn 将当前 fragment 与另一个 fragment 比较，看是否相等。。
  ///
  /// @comment 先比较 fragment 的内容大小，再逐个对内容节点调用节点的 eq 方法进行比较，一旦发现不一样的则返回 false，否则返回 true。
  eq(other: Fragment): boolean {
    if (this.content.length != other.content.length) return false
    for (let i = 0; i < this.content.length; i++)
      if (!this.content[i].eq(other.content[i])) return false
    return true
  }

  /// The first child of the fragment, or `null` if it is empty.
  ///
  /// @cn 返回当前 fragment 的第一个子节点，如果是空则为 `null`。
  get firstChild(): Node | null { return this.content.length ? this.content[0] : null }

  /// The last child of the fragment, or `null` if it is empty.
  ///
  /// @cn 返回当前 fragment 的最后一个节点，如果是空则为 `null`。
  get lastChild(): Node | null { return this.content.length ? this.content[this.content.length - 1] : null }

  /// The number of child nodes in this fragment.
  ///
  /// @cn 当前 fragment 的子节点数量。
  get childCount() { return this.content.length }

  /// Get the child node at the given index. Raise an error when the
  /// index is out of range.
  /// 
  /// @cn 获取 fragment 在给定 index 的子节点。如果 index 超出范围则抛出一个错误。
  child(index: number) {
    let found = this.content[index]
    if (!found) throw new RangeError("Index " + index + " out of range for " + this)
    return found
  }

  /// Get the child node at the given index, if it exists.
  ///
  /// @cn 获取给定 index 的子节点，如果存在的话。
  maybeChild(index: number): Node | null {
    return this.content[index] || null
  }

  /// Call `f` for every child node, passing the node, its offset
  /// into this parent node, and its index.
  /// 
  /// @cn 为每一个子节点调用 `f` 函数，参数是子节点、子节点相对于当前节点的偏移、以及子节点的 index。
  forEach(f: (node: Node, offset: number, index: number) => void) {
    for (let i = 0, p = 0; i < this.content.length; i++) {
      let child = this.content[i]
      f(child, p, i)
      p += child.nodeSize
    }
  }

  /// Find the first position at which this fragment and another
  /// fragment differ, or `null` if they are the same.
  /// 
  /// @cn 寻找当前 fragment 和给定 fragment 的第一个不同的位置，如果它们相同的话返回 `null`。
  findDiffStart(other: Fragment, pos = 0) {
    return findDiffStart(this, other, pos)
  }

  /// Find the first position, searching from the end, at which this
  /// fragment and the given fragment differ, or `null` if they are
  /// the same. Since this position will not be the same in both
  /// nodes, an object with two separate positions is returned.
  /// 
  /// @cn 从后往前搜索，寻找当前 fragment 和给定 fragment 的第一个不同的位置，如果相同则返回 `null`。
  /// 因为该位置在两个节点中可能是不同的，因此该函数返回的是一个对象，带有两个不同的位置。
  /// 
  /// @comment 对象是 {a: number, b: number}。
  findDiffEnd(other: Fragment, pos = this.size, otherPos = other.size) {
    return findDiffEnd(this, other, pos, otherPos)
  }

  /// Find the index and inner offset corresponding to a given relative
  /// position in this fragment. The result object will be reused
  /// (overwritten) the next time the function is called. @internal
  findIndex(pos: number, round = -1): {index: number, offset: number} {
    if (pos == 0) return retIndex(0, pos)
    if (pos == this.size) return retIndex(this.content.length, pos)
    if (pos > this.size || pos < 0) throw new RangeError(`Position ${pos} outside of fragment (${this})`)
    for (let i = 0, curPos = 0;; i++) {
      let cur = this.child(i), end = curPos + cur.nodeSize
      if (end >= pos) {
        if (end == pos || round > 0) return retIndex(i + 1, end)
        return retIndex(i, curPos)
      }
      curPos = end
    }
  }

  /// Return a debugging string that describes this fragment.
  ///
  /// @cn 返回一个用来 debug 的 string 以描述该 fragment。
  toString(): string { return "<" + this.toStringInner() + ">" }

  /// @internal
  toStringInner() { return this.content.join(", ") }

  /// Create a JSON-serializeable representation of this fragment.
  ///
  /// @cn 返回该 fragment 序列化后的 JSON 表示。
  toJSON(): any {
    return this.content.length ? this.content.map(n => n.toJSON()) : null
  }

  /// Deserialize a fragment from its JSON representation.
  /// 
  /// 从该 fragment 的 JSON 表示中反序列化（parse）一个 fragment。
  static fromJSON(schema: Schema, value: any) {
    if (!value) return Fragment.empty
    if (!Array.isArray(value)) throw new RangeError("Invalid input for Fragment.fromJSON")
    return new Fragment(value.map(schema.nodeFromJSON))
  }

  /// Build a fragment from an array of nodes. Ensures that adjacent
  /// text nodes with the same marks are joined together.
  /// 
  /// @cn 用一个节点数组构建一个 fragment。带有相同 marks 的相邻文本节点会被合并到一起。
  static fromArray(array: readonly Node[]) {
    if (!array.length) return Fragment.empty
    let joined: Node[] | undefined, size = 0
    for (let i = 0; i < array.length; i++) {
      let node = array[i]
      size += node.nodeSize
      if (i && node.isText && array[i - 1].sameMarkup(node)) {
        if (!joined) joined = array.slice(0, i)
        joined[joined.length - 1] = (node as TextNode)
                                      .withText((joined[joined.length - 1] as TextNode).text + (node as TextNode).text)
      } else if (joined) {
        joined.push(node)
      }
    }
    return new Fragment(joined || array, size)
  }

  /// Create a fragment from something that can be interpreted as a
  /// set of nodes. For `null`, it returns the empty fragment. For a
  /// fragment, the fragment itself. For a node or array of nodes, a
  /// fragment containing those nodes.
  ///
  /// @cn 用给定的类节点集合的对象中创建一个 fragment。如果是 `null` 则返回空 fragment。
  /// 如果是 fragment 则返回该 fragment 自身。如果是一个节点或者一个节点数组，则返回一个包含这些节点的 fragment。
  static from(nodes?: Fragment | Node | readonly Node[] | null) {
    if (!nodes) return Fragment.empty
    if (nodes instanceof Fragment) return nodes
    if (Array.isArray(nodes)) return this.fromArray(nodes)
    if ((nodes as Node).attrs) return new Fragment([nodes as Node], (nodes as Node).nodeSize)
    throw new RangeError("Can not convert " + nodes + " to a Fragment" +
      ((nodes as any).nodesBetween ? " (looks like multiple versions of prosemirror-model were loaded)" : ""))
  }

  /// An empty fragment. Intended to be reused whenever a node doesn't
  /// contain anything (rather than allocating a new empty fragment for
  /// each leaf node).
  /// 
  /// @cn 一个空的 fragment。没有包含任何节点的 fragment 都指向该对象（而不是为每个 fragment 都创建一个空的 fragment）。
  static empty: Fragment = new Fragment([], 0)
}

const found = {index: 0, offset: 0}
function retIndex(index: number, offset: number) {
  found.index = index
  found.offset = offset
  return found
}
