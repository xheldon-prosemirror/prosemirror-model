import OrderedMap from 'orderedmap'

import {Node, TextNode} from "./node"
import {Fragment} from "./fragment"
import {Mark} from "./mark"
import {ContentMatch} from "./content"
import {DOMOutputSpec} from "./to_dom"
import {ParseRule, TagParseRule} from "./from_dom"

/// An object holding the attributes of a node.
///
/// @cn 保存节点属性的对象。
export type Attrs = {readonly [attr: string]: any}

// For node types where all attrs have a default value (or which don't
// have any attributes), build up a single reusable default attribute
// object, and use it for all nodes that don't specify specific
// attributes.
function defaultAttrs(attrs: {[name: string]: Attribute}) {
  let defaults = Object.create(null)
  for (let attrName in attrs) {
    let attr = attrs[attrName]
    if (!attr.hasDefault) return null
    defaults[attrName] = attr.default
  }
  return defaults
}

function computeAttrs(attrs: {[name: string]: Attribute}, value: Attrs | null) {
  let built = Object.create(null)
  for (let name in attrs) {
    let given = value && value[name]
    if (given === undefined) {
      let attr = attrs[name]
      if (attr.hasDefault) given = attr.default
      else throw new RangeError("No value supplied for attribute " + name)
    }
    built[name] = given
  }
  return built
}

export function checkAttrs(attrs: {[name: string]: Attribute}, values: Attrs, type: string, name: string) {
  for (let name in values)
    if (!(name in attrs)) throw new RangeError(`Unsupported attribute ${name} for ${type} of type ${name}`)
  for (let name in attrs) {
    let attr = attrs[name]
    if (attr.validate) attr.validate(values[name])
  }
}

function initAttrs(typeName: string, attrs?: {[name: string]: AttributeSpec}) {
  let result: {[name: string]: Attribute} = Object.create(null)
  if (attrs) for (let name in attrs) result[name] = new Attribute(typeName, name, attrs[name])
  return result
}

/// Node types are objects allocated once per `Schema` and used to
/// [tag](#model.Node.type) `Node` instances. They contain information
/// about the node type, such as its name and what kind of node it
/// represents.
///
/// @cn 每个 Node Type 只会被 Schema 初始化一次，然后使用它来[tag（归类）](#model.Node.type) `Node` 的实例。
/// 这种对象包含了节点的类型信息，比如名称以及它表示那种节点。
export class NodeType {
  /// @internal
  groups: readonly string[]
  /// @internal
  attrs: { [name: string]: Attribute }
  /// @internal
  defaultAttrs: Attrs

  /// @internal
  constructor(
    /// The name the node type has in this schema.
    ///
    /// @cn 该节点类型在 schema 中的名称。
    readonly name: string,
    /// A link back to the `Schema` the node type belongs to.
    ///
    /// @cn 一个指向节点类型所属 `Schema` 的指针。
    readonly schema: Schema,
    /// The spec that this type is based on
    ///
    /// @cn 当前类型的配置对象。
    readonly spec: NodeSpec
  ) {
    this.groups = spec.group ? spec.group.split(' ') : []
    this.attrs = initAttrs(name, spec.attrs)
    this.defaultAttrs = defaultAttrs(this.attrs)

    // Filled in later
    ;(this as any).contentMatch = null
    ;(this as any).inlineContent = null

    this.isBlock = !(spec.inline || name == 'text')
    this.isText = name == 'text'
  }

  /// True if this node type has inline content.
  ///
  /// @cn 如果当前节点类型有内联内容的话，即为 true。
  inlineContent!: boolean
  /// True if this is a block type
  ///
  /// @cn 如果当前节点类型是块级类型的话，即为 true。
  ///
  /// @comment 判断是否是块级类型是用排除法，如果不是内联类型（即 spec.inline 是 false）且节点类型的名称不是「text」，则该类型是块级类型。
  isBlock: boolean
  /// True if this is the text node type.
  ///
  /// @cn 如果当前节点类型是文本节点类型的话，即为 true。
  ///
  /// @comment 也即节点名字是「text」。
  isText: boolean

  /// True if this is an inline type.
  /// @cn 如果当前节点类型是内联类型的话，即为 true。
  ///
  /// @comment 同样使用排除法，即与 spec.isBlock 互斥。
  get isInline() {
    return !this.isBlock
  }

  /// True if this is a textblock type, a block that contains inline
  /// content.
  ///
  /// @cn 如果当前节点类型是文本块类型，即为 true。
  get isTextblock() {
    return this.isBlock && this.inlineContent
  }

  /// True for node types that allow no content.
  ///
  /// @cn 如果节点不允许内容，则为 true。
  ///
  /// @comment 是否是叶节点使用的是 spec.contentMatch 是否为空判断的。
  get isLeaf() {
    return this.contentMatch == ContentMatch.empty
  }

  /// True when this node is an atom, i.e. when it does not have
  /// directly editable content.
  ///
  /// @cn 如果节点是一个原子节点则为 true，例如，一个没有直接可编辑的内容的节点。
  get isAtom() {
    return this.isLeaf || !!this.spec.atom
  }

  /// The starting match of the node type's content expression.
  ///
  /// @cn 节点类型内容表达式的起始匹配。
  ///
  /// @comment 源码内部使用的比较多。 一般写 Command 要用的话，可以用此方法来查询可以当前 node 可以进行插入的的默认类型。 `parent.contentMatchAt(index).defaultType`
  contentMatch!: ContentMatch

  /// The set of marks allowed in this node. `null` means all marks
  /// are allowed.
  ///
  /// @cn 该节点允许出现的 marks 集合。`null` 意味着允许所有的 marks。
  markSet: readonly MarkType[] | null = null

  /// The node type's [whitespace](#model.NodeSpec.whitespace) option.
  ///
  /// @cn 该节点类型的 [whitespace](#model.NodeSpec.whitespace) 选项。
  get whitespace(): 'pre' | 'normal' {
    return this.spec.whitespace || (this.spec.code ? 'pre' : 'normal')
  }

  /// Tells you whether this node type has any required attributes.
  hasRequiredAttrs() {
    for (let n in this.attrs) if (this.attrs[n].isRequired) return true
    return false
  }

  /// Indicates whether this node allows some of the same content as
  /// the given node type.
  ///
  /// @cn 该节点是否允许与给定的节点类型相同的内容。
  compatibleContent(other: NodeType) {
    return this == other || this.contentMatch.compatible(other.contentMatch)
  }

  /// @internal
  computeAttrs(attrs: Attrs | null): Attrs {
    if (!attrs && this.defaultAttrs) return this.defaultAttrs
    else return computeAttrs(this.attrs, attrs)
  }

  /// Create a `Node` of this type. The given attributes are
  /// checked and defaulted (you can pass `null` to use the type's
  /// defaults entirely, if no required attributes exist). `content`
  /// may be a `Fragment`, a node, an array of nodes, or
  /// `null`. Similarly `marks` may be `null` to default to the empty
  /// set of marks.
  ///
  /// @cn 新建一个此种类型的节点。将会检查给定的 attributes，未给定的话即为默认值（如果该中类型的节点没有任何必须的 attributes，你可以直接传递 `null` 来使用全部 attributes 的默认值）。
  /// `content` 可能是一个 `Fragment`、一个节点、一个节点数组或者 `null`。`marks` 参数与之类似，默认是 `null`，表示空的 marks 集合。
  create(
    attrs: Attrs | null = null,
    content?: Fragment | Node | readonly Node[] | null,
    marks?: readonly Mark[]
  ) {
    if (this.isText)
      throw new Error("NodeType.create can't construct text nodes")
    return new Node(
      this,
      this.computeAttrs(attrs),
      Fragment.from(content),
      Mark.setFrom(marks)
    )
  }

  /// Like [`create`](#model.NodeType.create), but check the given content
  /// against the node type's content restrictions, and throw an error
  /// if it doesn't match.
  ///
  /// @cn 与 [`create`](#model.NodeType.create) 类似，但是会检查给定的 content 是否符合节点类型的内容限制，如果不符的话会抛出一个错误。
  ///
  /// @comment 该自定义错误类型为 RangeError。
  createChecked(
    attrs: Attrs | null = null,
    content?: Fragment | Node | readonly Node[] | null,
    marks?: readonly Mark[]
  ) {
    content = Fragment.from(content)
    this.checkContent(content)
    return new Node(
      this,
      this.computeAttrs(attrs),
      content,
      Mark.setFrom(marks)
    )
  }

  /// Like [`create`](#model.NodeType.create), but see if it is
  /// necessary to add nodes to the start or end of the given fragment
  /// to make it fit the node. If no fitting wrapping can be found,
  /// return null. Note that, due to the fact that required nodes can
  /// always be created, this will always succeed if you pass null or
  /// `Fragment.empty` as content.
  ///
  /// @cn 和 [`create`](#model.NodeType.create) 类似，不过该方法会查看是否有必要在给定的 fragment 开始和结尾的地方
  /// 添加一些节点，以让该 fragment 适应当前 node。如果没有找到合适的包裹节点，则返回 null。
  // 记住，如果你传递 `null` 或者 `Fragment.empty` 作为内容会导致其一定会适合当前 node，因此该方法一定会成功。
  //
  // @comment 因为 `null` 和 `Fragment.empty` 不用寻找任何「合适的包裹节点」就能适应当前节点。
  createAndFill(
    attrs: Attrs | null = null,
    content?: Fragment | Node | readonly Node[] | null,
    marks?: readonly Mark[]
  ) {
    attrs = this.computeAttrs(attrs)
    content = Fragment.from(content)
    if (content.size) {
      let before = this.contentMatch.fillBefore(content)
      if (!before) return null
      content = before.append(content)
    }
    let matched = this.contentMatch.matchFragment(content)
    let after = matched && matched.fillBefore(Fragment.empty, true)
    if (!after) return null
    return new Node(
      this,
      attrs,
      (content as Fragment).append(after),
      Mark.setFrom(marks)
    )
  }

  /// Returns true if the given fragment is valid content for this node
  /// type.
  ///
  /// @cn 如果给定的 fragment 对当前带有 attributes 的节点是可用的，则返回 true。
  validContent(content: Fragment) {
    let result = this.contentMatch.matchFragment(content)
    if (!result || !result.validEnd) return false
    for (let i = 0; i < content.childCount; i++)
      if (!this.allowsMarks(content.child(i).marks)) return false
    return true
  }

  /// Throws a RangeError if the given fragment is not valid content for this
  /// node type.
  /// @internal
  checkContent(content: Fragment) {
    if (!this.validContent(content))
      throw new RangeError(
        `Invalid content for node ${this.name}: ${content
          .toString()
          .slice(0, 50)}`
      )
  }

  /// @internal
  checkAttrs(attrs: Attrs) {
    checkAttrs(this.attrs, attrs, 'node', this.name)
  }

  /// Check whether the given mark type is allowed in this node.
  ///
  /// @cn 检查当前节点类型是否允许给定的 mark 类型。
  allowsMarkType(markType: MarkType) {
    return this.markSet == null || this.markSet.indexOf(markType) > -1
  }

  /// Test whether the given set of marks are allowed in this node.
  ///
  /// @cn 检查当前节点类型是否允许给定的 marks 集合。
  allowsMarks(marks: readonly Mark[]) {
    if (this.markSet == null) return true
    for (let i = 0; i < marks.length; i++)
      if (!this.allowsMarkType(marks[i].type)) return false
    return true
  }

  /// Removes the marks that are not allowed in this node from the given set.
  ///
  /// @cn 从给定的 marks 集合中移除不允许出现在当前 node 中的 marks。
  allowedMarks(marks: readonly Mark[]): readonly Mark[] {
    if (this.markSet == null) return marks
    let copy
    for (let i = 0; i < marks.length; i++) {
      if (!this.allowsMarkType(marks[i].type)) {
        if (!copy) copy = marks.slice(0, i)
      } else if (copy) {
        copy.push(marks[i])
      }
    }
    return !copy ? marks : copy.length ? copy : Mark.none
  }

  /// @internal
  static compile<Nodes extends string>(
    nodes: OrderedMap<NodeSpec>,
    schema: Schema<Nodes>
  ): { readonly [name in Nodes]: NodeType } {
    let result = Object.create(null)
    nodes.forEach(
      (name, spec) => (result[name] = new NodeType(name, schema, spec))
    )

    let topType = schema.spec.topNode || 'doc'
    if (!result[topType])
      throw new RangeError(
        "Schema is missing its top node type ('" + topType + "')"
      )
    if (!result.text) throw new RangeError("Every schema needs a 'text' type")
    for (let _ in result.text.attrs)
      throw new RangeError('The text node type should not have attributes')

    return result
  }
}

function validateType(typeName: string, attrName: string, type: string) {
  let types = type.split('|')
  return (value: any) => {
    let name = value === null ? 'null' : typeof value
    if (types.indexOf(name) < 0)
      throw new RangeError(
        `Expected value of type ${types} for attribute ${attrName} on type ${typeName}, got ${name}`
      )
  }
}

// Attribute descriptors

class Attribute {
  hasDefault: boolean
  default: any
  validate: undefined | ((value: any) => void)

  constructor(typeName: string, attrName: string, options: AttributeSpec) {
    this.hasDefault = Object.prototype.hasOwnProperty.call(options, 'default')
    this.default = options.default
    this.validate =
      typeof options.validate == 'string'
        ? validateType(typeName, attrName, options.validate)
        : options.validate
  }

  get isRequired() {
    return !this.hasDefault
  }
}

// Marks

/// Like nodes, marks (which are associated with nodes to signify
/// things like emphasis or being part of a link) are
/// [tagged](#model.Mark.type) with type objects, which are
/// instantiated once per `Schema`.
///
/// @cn 和 nodes 类似，marks（与 node 关联的以表示诸如强调、链接等的内容）也被用类型对象进行 [tagged（归类）](#model.Mark.type)，
/// 每个类型只会被 `Schema` 实例化一次。
export class MarkType {
  /// @internal
  attrs: { [name: string]: Attribute }
  /// @internal
  excluded!: readonly MarkType[]
  /// @internal
  instance: Mark | null

  /// @internal
  constructor(
    /// The name of the mark type.
    ///
    /// @cn mark 类型的名称。
    readonly name: string,
    /// @internal
    readonly rank: number,
    /// The schema that this mark type instance is part of.
    ///
    /// @cn 当前 mark 类型所属于的 schema。
    readonly schema: Schema,
    /// The spec on which the type is based.
    ///
    /// @cn 当前 mark 类型的配置对象。
    readonly spec: MarkSpec
  ) {
    this.attrs = initAttrs(name, spec.attrs)
    ;(this as any).excluded = null
    let defaults = defaultAttrs(this.attrs)
    this.instance = defaults ? new Mark(this, defaults) : null
  }

  /// Create a mark of this type. `attrs` may be `null` or an object
  /// containing only some of the mark's attributes. The others, if
  /// they have defaults, will be added.
  ///
  /// @cn 创建一个当前类型的 mark。`attrs` 可能是 `null` 或者是一个仅包含部分 marks attributes 的对象。
  /// 其他未包含的 attributes，会使用它们的默认值添加上去。
  create(attrs: Attrs | null = null) {
    if (!attrs && this.instance) return this.instance
    return new Mark(this, computeAttrs(this.attrs, attrs))
  }

  /// @internal
  static compile(marks: OrderedMap<MarkSpec>, schema: Schema) {
    let result = Object.create(null),
      rank = 0
    marks.forEach(
      (name, spec) => (result[name] = new MarkType(name, rank++, schema, spec))
    )
    return result
  }

  /// When there is a mark of this type in the given set, a new set
  /// without it is returned. Otherwise, the input set is returned.
  ///
  /// @cn 如果当前 mark 类型存在与给定的 mark 集合，则将会返回不含有当前 mark 类型的 marks 集合。
  /// 否则，直接返回给定的 marks 集合。
  ///
  /// @comment 看函数名，顾名思义就是在给定 marks 集合中移除当前 mark 类型的 marks。
  removeFromSet(set: readonly Mark[]): readonly Mark[] {
    for (var i = 0; i < set.length; i++)
      if (set[i].type == this) {
        set = set.slice(0, i).concat(set.slice(i + 1))
        i--
      }
    return set
  }

  /// Tests whether there is a mark of this type in the given set.
  ///
  /// @cn 检查当前类型的 marks 是否存在于给定 marks 集合。
  isInSet(set: readonly Mark[]): Mark | undefined {
    for (let i = 0; i < set.length; i++) if (set[i].type == this) return set[i]
  }

  /// @internal
  checkAttrs(attrs: Attrs) {
    checkAttrs(this.attrs, attrs, 'mark', this.name)
  }

  /// Queries whether a given mark type is
  /// [excluded](#model.MarkSpec.excludes) by this one.
  ///
  /// @cn 查询给定的 mark 类型是否与当前 mark 类型 [excluded（互斥）](#model.MarkSpec.excludes)
  excludes(other: MarkType) {
    return this.excluded.indexOf(other) > -1
  }
}

/// An object describing a schema, as passed to the [`Schema`](#model.Schema)
/// constructor.
///
/// @cn 一个描述 schema 的对象，用来传递给 [`Schema`](#model.Schema) 构造函数
///
/// @comment 就是 schema 的配置对象，ProseMirror 中的 xxxSpec 都是 xxx 的配置对象，如 NodeSpec、MarkSpec 等。
export interface SchemaSpec<
  Nodes extends string = any,
  Marks extends string = any
> {
  /// The node types in this schema. Maps names to
  /// [`NodeSpec`](#model.NodeSpec) objects that describe the node type
  /// associated with that name. Their order is significant—it
  /// determines which [parse rules](#model.NodeSpec.parseDOM) take
  /// precedence by default, and which nodes come first in a given
  /// [group](#model.NodeSpec.group).
  //
  //   @cn 当前 schema 中所有的 node 类型的对象。对象中，键是节点名，对象的键是对应的 [`NodeSpec`](#model.NodeSpec)。
  //   节点们在该对象中出现的先后顺序是非常重要的，它决定了默认情况下哪个节点的 [parse rules](#model.NodeSpec.parseDOM) 优先进行，
  //   以及哪个节点是一个 [group](#model.NodeSpec.group) 优先考虑的节点。
  nodes: { [name in Nodes]: NodeSpec } | OrderedMap<NodeSpec>

  /// The mark types that exist in this schema. The order in which they
  /// are provided determines the order in which [mark
  /// sets](#model.Mark.addToSet) are sorted and in which [parse
  /// rules](#model.MarkSpec.parseDOM) are tried.
  ///
  ///  @cn 当前 schema 中的所有 mark 类型的对象。它们出现的顺序决定了在 [mark
  ///  sets](#model.Mark.addToSet) 中的存储顺序，以及 [parse rules](#model.MarkSpec.parseDOM) 的处理顺序。
  marks?: { [name in Marks]: MarkSpec } | OrderedMap<MarkSpec>

  /// The name of the default top-level node for the schema. Defaults
  /// to `"doc"`.
  ///
  /// @cn 当前 schema 顶级节点的名字，默认是 `"doc"`。
  topNode?: string
}

/// A description of a node type, used when defining a schema.
///
/// @cn 一个描述 node 类型的对象，在创建 schema 时使用。
export interface NodeSpec {
  /// The content expression for this node, as described in the [schema
  /// guide](/docs/guide/#schema.content_expressions). When not given,
  /// the node does not allow any content.
  ///
  /// @cn 就像在 [schema guide](https://xheldon.com/prosemirror-guide-chinese.html#content-expressions) 中描述的一样，为当前节点的内容表达式。
  /// 如果没有给定，则该节点不允许任何内容。
  ///
  /// @comment schema guide 链接指向中文翻译指南，请搜索 Schema 下的 Content Expressions 一节。
  content?: string

  /// The marks that are allowed inside of this node. May be a
  /// space-separated string referring to mark names or groups, `"_"`
  /// to explicitly allow all marks, or `""` to disallow marks. When
  /// not given, nodes with inline content default to allowing all
  /// marks, other nodes default to not allowing marks.
  ///
  /// @cn 当前节点允许的 marks 类型。可能是一个空格分隔的字符串，内容是 mark 的名字或者 group 名。
  /// `"_"` 表示明确允许所有的 marks，或者 `""` 表示禁止所有的 marks。如果没有设置该字段，则节点含有的内联内容将会默认允许所有的 marks，
  /// 其他不含内联内容的节点将默认不允许所有的 marks。
  marks?: string

  /// The group or space-separated groups to which this node belongs,
  /// which can be referred to in the content expressions for the
  /// schema.
  ///
  /// @cn 当前节点所属的 group，可以出现多个，用空格分隔，可以指向当前 schema 的内容表达式（content expressions）。
  group?: string

  /// Should be set to true for inline nodes. (Implied for text nodes.)
  ///
  /// @cn 对于内联节点，应该被设置为 true（文本节点隐式的被设置为 true）。
  inline?: boolean

  /// Can be set to true to indicate that, though this isn't a [leaf
  /// node](#model.NodeType.isLeaf), it doesn't have directly editable
  /// content and should be treated as a single unit in the view.
  ///
  /// @cn 可以被设置为 true，以表示即使当前节点不是一个 [leaf node](#model.NodeType.isLeaf)，但是其也没有直接可编辑内容，
  /// 因此在 view 中应该被当成是一个独立的单位对待。
  ///
  /// @comment 「独立单位对待」指的是，如在计数上，应该是 1；在事件上，内部元素触发的事件应该被视作是该节点触发的，等。
  atom?: boolean

  /// The attributes that nodes of this type get.
  ///
  /// @cn 当前节点拿到的 attributes。
  attrs?: { [name: string]: AttributeSpec }

  /// Controls whether nodes of this type can be selected as a [node
  /// selection](#state.NodeSelection). Defaults to true for non-text
  /// nodes.
  ///
  /// @cn 控制当前类型的节点是否能够被作为 [node selection](#state.NodeSelection) 所选中。
  /// 对于非文本节点来说，默认是 true。
  selectable?: boolean

  /// Determines whether nodes of this type can be dragged without
  /// being selected. Defaults to false.
  ///
  /// @cn 决定在未选中的情况下，当前类型的节点能否被拖拽。默认是 false。
  draggable?: boolean

  /// Can be used to indicate that this node contains code, which
  /// causes some commands to behave differently.
  ///
  /// @cn 指示当前节点包含 code，其会引起一些命令有特别的行为。
  ///
  /// @comment 「特别的行为」如，在 code 节点中的内容如果是 li 和 文档中的 li 是两个处理逻辑，前者针对 code 块处理；后者针对 li 进行处理。
  code?: boolean

  /// Controls way whitespace in this a node is parsed. The default is
  /// `"normal"`, which causes the [DOM parser](#model.DOMParser) to
  /// collapse whitespace in normal mode, and normalize it (replacing
  /// newlines and such with spaces) otherwise. `"pre"` causes the
  /// parser to preserve spaces inside the node. When this option isn't
  /// given, but [`code`](#model.NodeSpec.code) is true, `whitespace`
  /// will default to `"pre"`. Note that this option doesn't influence
  /// the way the node is rendered—that should be handled by `toDOM`
  /// and/or styling.
  ///
  /// @cn 控制当前节点在解析时，空格的处理方式。默认是 `"normal"`，
  /// 这使得 [DOM parser](#model.DOMParser) 在正常模式下会折叠空格，
  /// 否则会将其规范化（将新行和空格等替换为空格）。`"pre"` 会使解析器在节点内保留空格。
  /// 当没有给出该选项时，但是 [`code`](#model.NodeSpec.code) 为 true，
  /// `whitespace` 将默认设置为 `"pre"`。注意，这个选项不会影响节点渲染的方式，
  /// 这应该由 `toDOM` 和/或样式来处理。
  whitespace?: 'pre' | 'normal'

  /// Determines whether this node is considered an important parent
  /// node during replace operations (such as paste). Non-defining (the
  /// default) nodes get dropped when their entire content is replaced,
  /// whereas defining nodes persist and wrap the inserted content.
  ///
  /// @cn 决定当前节点是否在替换操作中被认为是一个重要的父级节点（如粘贴操作）。当节点的内容被整个替换掉的时候，
  /// 若该节点的 defining 为 false（默认），则其会被移除，但是 defining 为 true 的节点会保留，然后包裹住替换进来的内容。
  ///
  /// @comment 例如，默认的 paragraph 中，文本块节点，粘贴的时候应该直接替换掉它的父节点，也即另一个文本块。
  /// 但是对非默认 paragraph（即你自己定制的 paragraph）的话，在替换内容的时候，就需要保留该 非默认 paragraph 的一些属性，不能直接替换。同理 li 元素，
  /// 因为首先选中 li 元素内容，然后粘贴内容是一个很常见的操作，用户的预期是将粘贴内容作为 li 的内容，而不是直接替换掉 li 而粘贴成 paragraph（或其他 block）。
  definingAsContext?: boolean

  /// In inserted content the defining parents of the content are
  /// preserved when possible. Typically, non-default-paragraph
  /// textblock types, and possibly list items, are marked as defining.
  ///
  /// @cn 在插入内容中，定义的父节点会被尽可能的保留。通常，非默认段落类型的 textblock 节点，以及可能的 list item 节点，
  definingForContent?: boolean

  /// When enabled, enables both
  /// [`definingAsContext`](#model.NodeSpec.definingAsContext) and
  /// [`definingForContent`](#model.NodeSpec.definingForContent).
  ///
  /// @cn 当启用时，会同时启用 [`definingAsContext`](#model.NodeSpec.definingAsContext) 和 [`definingForContent`](#model.NodeSpec.definingForContent)。
  defining?: boolean

  /// When enabled (default is false), the sides of nodes of this type
  /// count as boundaries that regular editing operations, like
  /// backspacing or lifting, won't cross. An example of a node that
  /// should probably have this enabled is a table cell.
  ///
  /// @cn 当该属性设置为 true 时（默认是 false），当前类型的节点的两侧将会计算作为边界，于是对于正常的编辑操作如删除、或者提升，将不会被跨越过去。
  /// 举个例子，对于 table 的 cell 节点，该属性应该被设置为 true。
  ///
  /// @comment 「提升」操作指的是，如在一个二级 li 中，一般用户习惯下，按 shift + tab 会将该二级 li 提升到一级 li。
  ///
  ///   @comment 「跨越」指的是，操作会跨过当前节点到达下一个（或者上一个）节点。如删除操作，在段落起始位置继续按删除键，光标会跑到上一个节点的尾部；
  ///   在 li 起始位置按删除键，光标会跑到上一个 li 结尾处或者直接删除整个 ul/ol；但是在 table 的 td 中，在 td 起始位置按删除键跑到上一个 td 结尾，
  ///   显然不是预期。
  isolating?: boolean

  /// Defines the default way a node of this type should be serialized
  /// to DOM/HTML (as used by
  /// [`DOMSerializer.fromSchema`](#model.DOMSerializer^fromSchema)).
  /// Should return a DOM node or an [array
  /// structure](#model.DOMOutputSpec) that describes one, with an
  /// optional number zero (“hole”) in it to indicate where the node's
  /// content should be inserted.
  ///
  /// @cn 定义当前节点的默认序列化成 DOM/HTML 的方式（被[`DOMSerializer.fromSchema`](#model.DOMSerializer^fromSchema)使用）。
  /// 应该返回一个 DOM 节点或者一个描述 ODM 节点的 [array structure](#model.DOMOutputSpec)，它带有可选的数字 0 （就是「洞」），
  /// 表示节点的内容应该被插在哪个位置。
  /// For text nodes, the default is to create a text DOM node. Though
  /// it is possible to create a serializer where text is rendered
  /// differently, this is not supported inside the editor, so you
  /// shouldn't override that in your text node spec.
  ///
  /// @cn 对于文本节点，默认是创建一个文本 DOM 节点。虽然创建序列化器以将文本节点特殊渲染是可能的，但是当前编辑器并不支持这样做，因此你不应该覆盖文本节点中的该方法。
  toDOM?: (node: Node) => DOMOutputSpec

  /// Associates DOM parser information with this node, which can be
  /// used by [`DOMParser.fromSchema`](#model.DOMParser^fromSchema) to
  /// automatically derive a parser. The `node` field in the rules is
  /// implied (the name of this node will be filled in automatically).
  /// If you supply your own parser, you do not need to also specify
  /// parsing rules in your schema.
  ///
  /// @cn 当前节点相关的 DOM parser 信息，会被 [`DOMParser.fromSchema`](#model.DOMParser^fromSchema)
  /// 使用以自动的衍生出一个 parser。Rule 中的 `node` 字段是隐式的（节点的名字会自动填充）。如果你在此处提供了自己的 parser，那你就不需要再在 schema 配置的时候提供 parser 了。
  ///
  /// @comment 配置 Editor view 的时候可以配置一个 Parser 和 Serializer，如果提供，则此处就不用写 parseDOM 了。
  parseDOM?: readonly TagParseRule[]

  /// Defines the default way a node of this type should be serialized
  /// to a string representation for debugging (e.g. in error messages).
  ///
  /// @cn 定义一个该类型节点被序列化成一个字符串形式的默认方法，以做 debugging 用途。
  toDebugString?: (node: Node) => string

  /// Defines the default way a [leaf node](#model.NodeType.isLeaf) of
  /// this type should be serialized to a string (as used by
  /// [`Node.textBetween`](#model.Node^textBetween) and
  /// [`Node.textContent`](#model.Node^textContent)).
  ///
  /// @cn 定义一个该类型[叶子节点](#model.NodeType.isLeaf)被序列化成一个字符串形式的默认方法（被 [`Node.textBetween`](#model.Node^textBetween) 和 [`Node.textContent`](#model.Node^textContent) 使用）。
  leafText?: (node: Node) => string

  /// A single inline node in a schema can be set to be a linebreak
  /// equivalent. When converting between block types that support the
  /// node and block types that don't but have
  /// [`whitespace`](#model.NodeSpec.whitespace) set to `"pre"`,
  /// [`setBlockType`](#transform.Transform.setBlockType) will convert
  /// between newline characters to or from linebreak nodes as
  /// appropriate.
  ///
  /// @cn 在 schema 中，一个单独的内联节点可以被设置为换行符的等效物。当在支持该节点的块类型和不支持该节点但具有 whitespace 设置为 "pre" 的块类型之间进行转换时，setBlockType 将根据需要在换行符和换行节点之间进行转换。
  ///
  /// @comment 译者注：这个属性是 2024年5月份新加的属性，目前译者还没使用过。具体由来可以查看这个 [issue](https://github.com/ProseMirror/prosemirror/issues/1460)
  linebreakReplacement?: boolean

  /// Node specs may include arbitrary properties that can be read by
  /// other code via [`NodeType.spec`](#model.NodeType.spec).
  ///
  /// @cn 节点类型可以包含任意属性，这些属性可以通过 [`NodeType.spec`](#model.NodeType.spec) 访问。
  [key: string]: any
}

/// Used to define marks when creating a schema.
///
/// @cn 用来在创建 schema 的时候定义 marks。
export interface MarkSpec {
  /// The attributes that marks of this type get.
  ///
  /// @cn 当前 mark 类型拿到的 attributes。
  attrs?: { [name: string]: AttributeSpec }

  /// Whether this mark should be active when the cursor is positioned
  /// at its end (or at its start when that is also the start of the
  /// parent node). Defaults to true.
  ///
  /// @cn 当光标放到该 mark 的结尾处（或者如果该 mark 开始处同样是父级节点的开始处时，放到 mark 的开始处）时，该 marks 是否应该被激活。默认是 true/
  ///
  /// @comment 「被激活」的意思是，可以通过 API 获取光标所在的 resolvedPos 信息以查到相关的 marks，对用户来说被激活意味着在该地方输入内容会带上相应的 marks。
  inclusive?: boolean

  /// Determines which other marks this mark can coexist with. Should
  /// be a space-separated strings naming other marks or groups of marks.
  /// When a mark is [added](#model.Mark.addToSet) to a set, all marks
  /// that it excludes are removed in the process. If the set contains
  /// any mark that excludes the new mark but is not, itself, excluded
  /// by the new mark, the mark can not be added an the set. You can
  /// use the value `"_"` to indicate that the mark excludes all
  /// marks in the schema.
  ///
  /// Defaults to only being exclusive with marks of the same type. You
  /// can set it to an empty string (or any string not containing the
  /// mark's own name) to allow multiple marks of a given type to
  /// coexist (as long as they have different attributes).
  //
//   @cn 决定当前 mark 是否能和其他 marks 共存。应该是由其他 marks 名或者 marks group 组成的以空格分隔的字符串。
  /// 当一个 marks 被 [added](#model.Mark.addToSet) 到一个集合中时，所有的与此 marks 排斥（excludes）的 marks 将会被在添加过程中移除。
  /// 如果当前集合包含任何排斥当前的新 mark 的 mark，但是该新 mark 却不排斥它，则当前新的 mark 不会被添加到集合中。你可以使用 `"_"` 来表明当前 marks
  /// 排斥所有的 schema 中的其他 marks。
  ///
  /// @comment 该段的主要意思是，第一：假设 A 、B 互斥，则 无论 A 添加到包含 B 的集合，还是 B 添加到 包含 A 的集合，已经在集合中的一方会被移除以添加新的 mark；
  /// 第二：若假设 A 排斥 B，B 却不排斥 A，则将 B 添加到包含 A 的集合中去的时候，将不会被添加进去。
  excludes?: string

  /// The group or space-separated groups to which this mark belongs.
  group?: string

  /// Determines whether marks of this type can span multiple adjacent
  /// nodes when serialized to DOM/HTML. Defaults to true.
  spanning?: boolean

  /// Defines the default way marks of this type should be serialized
  /// to DOM/HTML. When the resulting spec contains a hole, that is
  /// where the marked content is placed. Otherwise, it is appended to
  /// the top node.
  toDOM?: (mark: Mark, inline: boolean) => DOMOutputSpec

  /// Associates DOM parser information with this mark (see the
  /// corresponding [node spec field](#model.NodeSpec.parseDOM)). The
  /// `mark` field in the rules is implied.
  parseDOM?: readonly ParseRule[]

  /// Mark specs can include additional properties that can be
  /// inspected through [`MarkType.spec`](#model.MarkType.spec) when
  /// working with the mark.
  [key: string]: any
}

/// Used to [define](#model.NodeSpec.attrs) attributes on nodes or
/// marks.
export interface AttributeSpec {
  /// The default value for this attribute, to use when no explicit
  /// value is provided. Attributes that have no default must be
  /// provided whenever a node or mark of a type that has them is
  /// created.
  default?: any
  /// A function or type name used to validate values of this
  /// attribute. This will be used when deserializing the attribute
  /// from JSON, and when running [`Node.check`](#model.Node.check).
  /// When a function, it should raise an exception if the value isn't
  /// of the expected type or shape. When a string, it should be a
  /// `|`-separated string of primitive types (`"number"`, `"string"`,
  /// `"boolean"`, `"null"`, and `"undefined"`), and the library will
  /// raise an error when the value is not one of those types.
  validate?: string | ((value: any) => void)
}

/// A document schema. Holds [node](#model.NodeType) and [mark
/// type](#model.MarkType) objects for the nodes and marks that may
/// occur in conforming documents, and provides functionality for
/// creating and deserializing such documents.
///
/// When given, the type parameters provide the names of the nodes and
/// marks in this schema.
export class Schema<Nodes extends string = any, Marks extends string = any> {
  /// The [spec](#model.SchemaSpec) on which the schema is based,
  /// with the added guarantee that its `nodes` and `marks`
  /// properties are
  /// [`OrderedMap`](https://github.com/marijnh/orderedmap) instances
  /// (not raw objects).
  spec: {
    nodes: OrderedMap<NodeSpec>
    marks: OrderedMap<MarkSpec>
    topNode?: string
  }

  /// An object mapping the schema's node names to node type objects.
  nodes: { readonly [name in Nodes]: NodeType } & {
    readonly [key: string]: NodeType
  }

  /// A map from mark names to mark type objects.
  marks: { readonly [name in Marks]: MarkType } & {
    readonly [key: string]: MarkType
  }

  /// The [linebreak
  /// replacement](#model.NodeSpec.linebreakReplacement) node defined
  /// in this schema, if any.
  linebreakReplacement: NodeType | null = null

  /// Construct a schema from a schema [specification](#model.SchemaSpec).
  constructor(spec: SchemaSpec<Nodes, Marks>) {
    let instanceSpec = (this.spec = {} as any)
    for (let prop in spec) instanceSpec[prop] = (spec as any)[prop]
    ;(instanceSpec.nodes = OrderedMap.from(spec.nodes)),
      (instanceSpec.marks = OrderedMap.from(spec.marks || {})),
      (this.nodes = NodeType.compile(this.spec.nodes, this))
    this.marks = MarkType.compile(this.spec.marks, this)

    let contentExprCache = Object.create(null)
    for (let prop in this.nodes) {
      if (prop in this.marks)
        throw new RangeError(prop + ' can not be both a node and a mark')
      let type = this.nodes[prop],
        contentExpr = type.spec.content || '',
        markExpr = type.spec.marks
      type.contentMatch =
        contentExprCache[contentExpr] ||
        (contentExprCache[contentExpr] = ContentMatch.parse(
          contentExpr,
          this.nodes
        ))
      ;(type as any).inlineContent = type.contentMatch.inlineContent
      if (type.spec.linebreakReplacement) {
        if (this.linebreakReplacement)
          throw new RangeError('Multiple linebreak nodes defined')
        if (!type.isInline || !type.isLeaf)
          throw new RangeError(
            'Linebreak replacement nodes must be inline leaf nodes'
          )
        this.linebreakReplacement = type
      }
      type.markSet =
        markExpr == '_'
          ? null
          : markExpr
          ? gatherMarks(this, markExpr.split(' '))
          : markExpr == '' || !type.inlineContent
          ? []
          : null
    }
    for (let prop in this.marks) {
      let type = this.marks[prop],
        excl = type.spec.excludes
      type.excluded =
        excl == null
          ? [type]
          : excl == ''
          ? []
          : gatherMarks(this, excl.split(' '))
    }

    this.nodeFromJSON = this.nodeFromJSON.bind(this)
    this.markFromJSON = this.markFromJSON.bind(this)
    this.topNodeType = this.nodes[this.spec.topNode || 'doc']
    this.cached.wrappings = Object.create(null)
  }

  /// The type of the [default top node](#model.SchemaSpec.topNode)
  /// for this schema.
  topNodeType: NodeType

  /// An object for storing whatever values modules may want to
  /// compute and cache per schema. (If you want to store something
  /// in it, try to use property names unlikely to clash.)
  cached: { [key: string]: any } = Object.create(null)

  /// Create a node in this schema. The `type` may be a string or a
  /// `NodeType` instance. Attributes will be extended with defaults,
  /// `content` may be a `Fragment`, `null`, a `Node`, or an array of
  /// nodes.
  node(
    type: string | NodeType,
    attrs: Attrs | null = null,
    content?: Fragment | Node | readonly Node[],
    marks?: readonly Mark[]
  ) {
    if (typeof type == 'string') type = this.nodeType(type)
    else if (!(type instanceof NodeType))
      throw new RangeError('Invalid node type: ' + type)
    else if (type.schema != this)
      throw new RangeError(
        'Node type from different schema used (' + type.name + ')'
      )

    return type.createChecked(attrs, content, marks)
  }

  /// Create a text node in the schema. Empty text nodes are not
  /// allowed.
  text(text: string, marks?: readonly Mark[] | null): Node {
    let type = this.nodes.text
    return new TextNode(type, type.defaultAttrs, text, Mark.setFrom(marks))
  }

  /// Create a mark with the given type and attributes.
  mark(type: string | MarkType, attrs?: Attrs | null) {
    if (typeof type == 'string') type = this.marks[type]
    return type.create(attrs)
  }

  /// Deserialize a node from its JSON representation. This method is
  /// bound.
  nodeFromJSON(json: any): Node {
    return Node.fromJSON(this, json)
  }

  /// Deserialize a mark from its JSON representation. This method is
  /// bound.
  markFromJSON(json: any): Mark {
    return Mark.fromJSON(this, json)
  }

  /// @internal
  nodeType(name: string) {
    let found = this.nodes[name]
    if (!found) throw new RangeError('Unknown node type: ' + name)
    return found
  }
}

function gatherMarks(schema: Schema, marks: readonly string[]) {
  let found: MarkType[] = []
  for (let i = 0; i < marks.length; i++) {
    let name = marks[i],
      mark = schema.marks[name],
      ok = mark
    if (mark) {
      found.push(mark)
    } else {
      for (let prop in schema.marks) {
        let mark = schema.marks[prop]
        if (
          name == '_' ||
          (mark.spec.group && mark.spec.group.split(' ').indexOf(name) > -1)
        )
          found.push((ok = mark))
      }
    }
    if (!ok) throw new SyntaxError("Unknown mark type: '" + marks[i] + "'")
  }
  return found
}
