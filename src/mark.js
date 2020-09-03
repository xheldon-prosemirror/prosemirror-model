import {compareDeep} from "./comparedeep"

// ::- A mark is a piece of information that can be attached to a node,
// such as it being emphasized, in code font, or a link. It has a type
// and optionally a set of attributes that provide further information
// (such as the target of the link). Marks are created through a
// `Schema`, which controls which types exist and which
// attributes they have.
// 
// @cn Mark 是可以被附加到节点上的一小段信息，比如加粗行内代码或者加粗链接字体。它有一个可选的 attributes 集合以提供更多信息
// （比如链接的 target 信息等）。Marks 通过 `Schema` 创建，它控制哪些 marks 存在于哪些节点以及拥有哪些 attributes。
export class Mark {
  constructor(type, attrs) {
    // :: MarkType
    // The type of this mark.
    // 
    // @cn 当前 mark 的 type。
    this.type = type
    // :: Object
    // The attributes associated with this mark.
    // 
    // @cn 与此 mark 相关的 attributes。
    this.attrs = attrs
  }

  // :: ([Mark]) → [Mark]
  // Given a set of marks, create a new set which contains this one as
  // well, in the right position. If this mark is already in the set,
  // the set itself is returned. If any marks that are set to be
  // [exclusive](#model.MarkSpec.excludes) with this mark are present,
  // those are replaced by this one.
  // 
  // @cn 将当前 marks 加入到给定 marks 集合的右侧（后面）后返回新的 marks 集合。如果当前 marks 已经存在于给定集合当中
  // 那么给定集合自身会被返回。如果给定集合中有任何 marsk 配置对象的 [exclusive](#model.MarkSpec.excludes) 属性值中有当前 mark，那么它会被用当前 mark 替换掉。
  addToSet(set) {
    let copy, placed = false
    for (let i = 0; i < set.length; i++) {
      let other = set[i]
      if (this.eq(other)) return set
      if (this.type.excludes(other.type)) {
        if (!copy) copy = set.slice(0, i)
      } else if (other.type.excludes(this.type)) {
        return set
      } else {
        if (!placed && other.type.rank > this.type.rank) {
          if (!copy) copy = set.slice(0, i)
          copy.push(this)
          placed = true
        }
        if (copy) copy.push(other)
      }
    }
    if (!copy) copy = set.slice()
    if (!placed) copy.push(this)
    return copy
  }

  // :: ([Mark]) → [Mark]
  // Remove this mark from the given set, returning a new set. If this
  // mark is not in the set, the set itself is returned.
  // 
  // @cn 从给定的 marks 集合中移除当前 mark。如果当前 mark 不在集合中，那么给定集合本身会被返回。
  removeFromSet(set) {
    for (let i = 0; i < set.length; i++)
      if (this.eq(set[i]))
        return set.slice(0, i).concat(set.slice(i + 1))
    return set
  }

  // :: ([Mark]) → bool
  // Test whether this mark is in the given set of marks.
  // 
  // @cn 测试是否当前 mark 在给定 marks 集合中。
  isInSet(set) {
    for (let i = 0; i < set.length; i++)
      if (this.eq(set[i])) return true
    return false
  }

  // :: (Mark) → bool
  // Test whether this mark has the same type and attributes as
  // another mark.
  //
  // @cn 测试当前 mark 与给定 mark 是否有相同的类型和 attributes。
  eq(other) {
    return this == other ||
      (this.type == other.type && compareDeep(this.attrs, other.attrs))
  }

  // :: () → Object
  // Convert this mark to a JSON-serializeable representation.
  // 
  // @cn 返回当前 mark 的 JSON 序列化的表示。
  toJSON() {
    let obj = {type: this.type.name}
    for (let _ in this.attrs) {
      obj.attrs = this.attrs
      break
    }
    return obj
  }

  // :: (Schema, Object) → Mark
  static fromJSON(schema, json) {
    if (!json) throw new RangeError("Invalid input for Mark.fromJSON")
    let type = schema.marks[json.type]
    if (!type) throw new RangeError(`There is no mark type ${json.type} in this schema`)
    return type.create(json.attrs)
  }

  // :: ([Mark], [Mark]) → bool
  // Test whether two sets of marks are identical.
  // 
  // @cn 测试两个 marks 集合是否一样。
  // 
  // @comment marks 集合是否相同的比较是是先测试 marks 集合中的 mark 数量，然后逐个调用 mark 的 eq 进行比较。
  static sameSet(a, b) {
    if (a == b) return true
    if (a.length != b.length) return false
    for (let i = 0; i < a.length; i++)
      if (!a[i].eq(b[i])) return false
    return true
  }

  // :: (?union<Mark, [Mark]>) → [Mark]
  // Create a properly sorted mark set from null, a single mark, or an
  // unsorted array of marks.
  // 
  // @cn 用给定的参数，新建一个 stored marks 集合，该参数可能是 null、单独一个 mark或者一个未排序的 marks 数组。
  static setFrom(marks) {
    if (!marks || marks.length == 0) return Mark.none
    if (marks instanceof Mark) return [marks]
    let copy = marks.slice()
    copy.sort((a, b) => a.type.rank - b.type.rank)
    return copy
  }
}

// :: [Mark] The empty set of marks.
// 
// @cn marks 的空集合。
Mark.none = []
