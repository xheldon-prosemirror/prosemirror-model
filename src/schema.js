import OrderedMap from "orderedmap"

import {Node, TextNode} from "./node"
import {Fragment} from "./fragment"
import {Mark} from "./mark"
import {ContentMatch} from "./content"

// For node types where all attrs have a default value (or which don't
// have any attributes), build up a single reusable default attribute
// object, and use it for all nodes that don't specify specific
// attributes.
function defaultAttrs(attrs) {
  let defaults = Object.create(null)
  for (let attrName in attrs) {
    let attr = attrs[attrName]
    if (!attr.hasDefault) return null
    defaults[attrName] = attr.default
  }
  return defaults
}

function computeAttrs(attrs, value) {
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

function initAttrs(attrs) {
  let result = Object.create(null)
  if (attrs) for (let name in attrs) result[name] = new Attribute(attrs[name])
  return result
}

// ::- Node types are objects allocated once per `Schema` and used to
// [tag](#model.Node.type) `Node` instances. They contain information
// about the node type, such as its name and what kind of node it
// represents.
//
// @cn 每个 Node Type 只会被 Schema 初始化一次，然后使用它来[tag（归类）](#model.Node.type) `Node` 的实例。
// 这种对象包含了节点的类型信息，比如名称以及它表示那种节点。
export class NodeType {
  constructor(name, schema, spec) {
    // :: string
    // The name the node type has in this schema.
    //
    // @cn 该节点类型在 schema 中的名称。
    this.name = name

    // :: Schema
    // A link back to the `Schema` the node type belongs to.
    //
    // @cn 一个指向节点类型所属 `Schema` 的指针。
    this.schema = schema

    // :: NodeSpec
    // The spec that this type is based on
    //
    // @cn 当前类型的配置对象。
    this.spec = spec

    this.groups = spec.group ? spec.group.split(" ") : []
    this.attrs = initAttrs(spec.attrs)

    this.defaultAttrs = defaultAttrs(this.attrs)

    // :: ContentMatch
    // The starting match of the node type's content expression.
    //
    // @cn 节点类型内容表达式的起始匹配。
    //
    // @comment sorry，这个 contentMatch 我用的比较少，所以也不知道是什么意思，貌似源码内部使用的比较多。
    this.contentMatch = null

    // : ?[MarkType]
    // The set of marks allowed in this node. `null` means all marks
    // are allowed.
    //
    // @cn 该节点允许出现的 marks 集合。`null` 意味着允许所有的 marks。
    this.markSet = null

    // :: bool
    // True if this node type has inline content.
    //
    // @cn 如果当前节点类型有内联内容的话，即为 true。
    this.inlineContent = null

    // :: bool
    // True if this is a block type
    //
    // @cn 当前节点是块级类型的话，即为 true。
    //
    // @comment 判断是否是块级类型是用排除法，如果不是内联类型（即 spec.inline 是 false）且节点类型的名称不是「text」，则该类型是块级类型。
    this.isBlock = !(spec.inline || name == "text")

    // :: bool
    // True if this is the text node type.
    //
    // @cn 如果是文本类型的节点，即为 true。
    //
    // @comment 也即节点名字是「text」。
    this.isText = name == "text"
  }

  // :: bool
  // True if this is an inline type.
  //
  // @cn 如果是一个内联类型，则为 true。
  //
  // @comment 同样使用排除法，即与 spec.isBlock 互斥。
  get isInline() { return !this.isBlock }

  // :: bool
  // True if this is a textblock type, a block that contains inline
  // content.
  //
  // @cn 如果节点是文本块类型节点则为 true，即一个包含内联内容的块级类型节点。
  //
  // @comment 一个块级类型可能包含另一个块级类型，一个文本块类型则只会包含内联内容，哪些节点是内联元素由 schema 决定。
  //
  // @comment 文本块类型的判断需要同时满足 spec.isBlock 和 spec.inlineContent 同时为 true。
  get isTextblock() { return this.isBlock && this.inlineContent }

  // :: bool
  // True for node types that allow no content.
  //
  // @cn 如果节点不允许内容，则为 true。
  //
  // @comment 是否是叶节点使用的是 spec.contentMatch 是否为空判断的。
  get isLeaf() { return this.contentMatch == ContentMatch.empty }

  // :: bool
  // True when this node is an atom, i.e. when it does not have
  // directly editable content.
  //
  // @cn 如果节点是一个原子节点则为 true，例如，一个没有直接可编辑的内容的节点。
  get isAtom() { return this.isLeaf || this.spec.atom }

  // :: () → bool
  // Tells you whether this node type has any required attributes.
  //
  // @cn 告诉你该节点类型是否有任何必须的 attributes。
  hasRequiredAttrs() {
    for (let n in this.attrs) if (this.attrs[n].isRequired) return true
    return false
  }

  compatibleContent(other) {
    return this == other || this.contentMatch.compatible(other.contentMatch)
  }

  computeAttrs(attrs) {
    if (!attrs && this.defaultAttrs) return this.defaultAttrs
    else return computeAttrs(this.attrs, attrs)
  }

  // :: (?Object, ?union<Fragment, Node, [Node]>, ?[Mark]) → Node
  // Create a `Node` of this type. The given attributes are
  // checked and defaulted (you can pass `null` to use the type's
  // defaults entirely, if no required attributes exist). `content`
  // may be a `Fragment`, a node, an array of nodes, or
  // `null`. Similarly `marks` may be `null` to default to the empty
  // set of marks.
  //
  // @cn 新建一个此种类型的节点。将会检查给定的 attributes，未给定的话即为默认值（如果该中类型的节点没有任何必须的 attributes，你可以直接传递 `null` 来使用全部 attributes 的默认值）。
  // `content` 可能是一个 `Fragment`、一个节点、一个节点数组或者 `null`。`marks` 参数与之类似，默认是 `null`，表示空的 marks 集合。
  create(attrs, content, marks) {
    if (this.isText) throw new Error("NodeType.create can't construct text nodes")
    return new Node(this, this.computeAttrs(attrs), Fragment.from(content), Mark.setFrom(marks))
  }

  // :: (?Object, ?union<Fragment, Node, [Node]>, ?[Mark]) → Node
  // Like [`create`](#model.NodeType.create), but check the given content
  // against the node type's content restrictions, and throw an error
  // if it doesn't match.
  //
  // @cn 与 [`create`](#model.NodeType.create) 类似，但是会检查给定的 content 是否符合节点类型的内容限制，如果不符的话会抛出一个错误。
  //
  // @comment 该自定义错误类型为 RangeError。
  createChecked(attrs, content, marks) {
    content = Fragment.from(content)
    if (!this.validContent(content))
      throw new RangeError("Invalid content for node " + this.name)
    return new Node(this, this.computeAttrs(attrs), content, Mark.setFrom(marks))
  }

  // :: (?Object, ?union<Fragment, Node, [Node]>, ?[Mark]) → ?Node
  // Like [`create`](#model.NodeType.create), but see if it is necessary to
  // add nodes to the start or end of the given fragment to make it
  // fit the node. If no fitting wrapping can be found, return null.
  // Note that, due to the fact that required nodes can always be
  // created, this will always succeed if you pass null or
  // `Fragment.empty` as content.
  //
  // @cn 和 [`create`](#model.NodeType.create) 类似，不过该方法会查看是否有必要在给定的 fragment 开始和结尾的地方
  // 添加一些节点，以让该 fragment 适应当前 node。如果没有找到合适的包裹节点，则返回 null。
  // 记住，如果你传递 `null` 或者 `Fragment.empty` 作为内容会导致其一定会适合当前 node，因此该方法一定会成功。
  //
  // @comment 因为 `null` 和 `Fragment.empty` 不用寻找任何「合适的包裹节点」就能适应当前节点。
  createAndFill(attrs, content, marks) {
    attrs = this.computeAttrs(attrs)
    content = Fragment.from(content)
    if (content.size) {
      let before = this.contentMatch.fillBefore(content)
      if (!before) return null
      content = before.append(content)
    }
    let after = this.contentMatch.matchFragment(content).fillBefore(Fragment.empty, true)
    if (!after) return null
    return new Node(this, attrs, content.append(after), Mark.setFrom(marks))
  }

  // :: (Fragment) → bool
  // Returns true if the given fragment is valid content for this node
  // type with the given attributes.
  //
  // @cn 如果给定的 fragment 对当前带有 attributes 的节点是可用的，则返回 true。
  validContent(content) {
    let result = this.contentMatch.matchFragment(content)
    if (!result || !result.validEnd) return false
    for (let i = 0; i < content.childCount; i++)
      if (!this.allowsMarks(content.child(i).marks)) return false
    return true
  }

  // :: (MarkType) → bool
  // Check whether the given mark type is allowed in this node.
  //
  // @cn 检查当前节点类型是否允许给定的 mark 类型。
  allowsMarkType(markType) {
    return this.markSet == null || this.markSet.indexOf(markType) > -1
  }

  // :: ([Mark]) → bool
  // Test whether the given set of marks are allowed in this node.
  //
  // @cn 检查当前节点类型是否允许给定的 marks 集合。
  allowsMarks(marks) {
    if (this.markSet == null) return true
    for (let i = 0; i < marks.length; i++) if (!this.allowsMarkType(marks[i].type)) return false
    return true
  }

  // :: ([Mark]) → [Mark]
  // Removes the marks that are not allowed in this node from the given set.
  //
  // @cn 从给定的 marks 集合中移除不允许出现在当前 node 中的 marks。
  allowedMarks(marks) {
    if (this.markSet == null) return marks
    let copy
    for (let i = 0; i < marks.length; i++) {
      if (!this.allowsMarkType(marks[i].type)) {
        if (!copy) copy = marks.slice(0, i)
      } else if (copy) {
        copy.push(marks[i])
      }
    }
    return !copy ? marks : copy.length ? copy : Mark.empty
  }

  static compile(nodes, schema) {
    let result = Object.create(null)
    nodes.forEach((name, spec) => result[name] = new NodeType(name, schema, spec))

    let topType = schema.spec.topNode || "doc"
    if (!result[topType]) throw new RangeError("Schema is missing its top node type ('" + topType + "')")
    if (!result.text) throw new RangeError("Every schema needs a 'text' type")
    for (let _ in result.text.attrs) throw new RangeError("The text node type should not have attributes")

    return result
  }
}

// Attribute descriptors

class Attribute {
  constructor(options) {
    this.hasDefault = Object.prototype.hasOwnProperty.call(options, "default")
    this.default = options.default
  }

  get isRequired() {
    return !this.hasDefault
  }
}

// Marks

// ::- Like nodes, marks (which are associated with nodes to signify
// things like emphasis or being part of a link) are
// [tagged](#model.Mark.type) with type objects, which are
// instantiated once per `Schema`.
//
// @cn 和 nodes 类似，marks（与 node 关联的以表示诸如强调、链接等的内容）也被用类型对象进行 [tagged（归类）](#model.Mark.type)，
// 每个类型只会被 `Schema` 实例化一次。
export class MarkType {
  constructor(name, rank, schema, spec) {
    // :: string
    // The name of the mark type.
    //
    // @cn mark 类型的名称。
    this.name = name

    // :: Schema
    // The schema that this mark type instance is part of.
    //
    // @cn 当前 mark 类型所属于的 schema。
    this.schema = schema

    // :: MarkSpec
    // The spec on which the type is based.
    //
    // @cn 当前 mark 类型的配置对象。
    this.spec = spec

    this.attrs = initAttrs(spec.attrs)

    this.rank = rank
    this.excluded = null
    let defaults = defaultAttrs(this.attrs)
    this.instance = defaults && new Mark(this, defaults)
  }

  // :: (?Object) → Mark
  // Create a mark of this type. `attrs` may be `null` or an object
  // containing only some of the mark's attributes. The others, if
  // they have defaults, will be added.
  //
  // @cn 创建一个当前类型的 mark。`attrs` 可能是 `null` 或者是一个仅包含部分 marks attributes 的对象。
  // 其他未包含的 attributes，会使用它们的默认值添加上去。
  create(attrs) {
    if (!attrs && this.instance) return this.instance
    return new Mark(this, computeAttrs(this.attrs, attrs))
  }

  static compile(marks, schema) {
    let result = Object.create(null), rank = 0
    marks.forEach((name, spec) => result[name] = new MarkType(name, rank++, schema, spec))
    return result
  }

  // :: ([Mark]) → [Mark]
  // When there is a mark of this type in the given set, a new set
  // without it is returned. Otherwise, the input set is returned.
  //
  // @cn 如果当前 mark 类型存在与给定的 mark 集合，则将会返回不含有当前 mark 类型的 marks 集合。
  // 否则，直接返回给定的 marks 集合。
  //
  // @comment 看函数名，顾名思义就是在给定 marks 集合中移除当前 mark 类型的 marks。
  removeFromSet(set) {
    for (var i = 0; i < set.length; i++)
      if (set[i].type == this)
        return set.slice(0, i).concat(set.slice(i + 1))
    return set
  }

  // :: ([Mark]) → ?Mark
  // Tests whether there is a mark of this type in the given set.
  //
  // @cn 检查当前类型的 marks 是否存在于给定 marks 集合。
  isInSet(set) {
    for (let i = 0; i < set.length; i++)
      if (set[i].type == this) return set[i]
  }

  // :: (MarkType) → bool
  // Queries whether a given mark type is
  // [excluded](#model.MarkSpec.excludes) by this one.
  //
  // @cn 查询给定的 mark 类型是否与当前 mark 类型 [excluded（互斥）](#model.MarkSpec.excludes)
  excludes(other) {
    return this.excluded.indexOf(other) > -1
  }
}

// SchemaSpec:: interface
// An object describing a schema, as passed to the [`Schema`](#model.Schema)
// constructor.
//
// @cn 一个描述 schema 的对象，用来传递给 [`Schema`](#model.Schema) 构造函数
//
// @comment 就是 schema 的配置对象，ProseMirror 中的 xxxSpec 都是 xxx 的配置对象，如 NodeSpec、MarkSpec 等。
//
//   nodes:: union<Object<NodeSpec>, OrderedMap<NodeSpec>>
//   The node types in this schema. Maps names to
//   [`NodeSpec`](#model.NodeSpec) objects that describe the node type
//   associated with that name. Their order is significant—it
//   determines which [parse rules](#model.NodeSpec.parseDOM) take
//   precedence by default, and which nodes come first in a given
//   [group](#model.NodeSpec.group).
//
//   @cn 当前 schema 中所有的 node 类型的对象。对象中，键是节点名，对象的键是对应的 [`NodeSpec`](#model.NodeSpec)。
//   节点们在该对象中出现的先后顺序是非常重要的，它决定了默认情况下哪个节点的 [parse rules](#model.NodeSpec.parseDOM) 优先进行，
//   以及哪个节点是一个 group 优先考虑的节点。
//
//   marks:: ?union<Object<MarkSpec>, OrderedMap<MarkSpec>>
//   The mark types that exist in this schema. The order in which they
//   are provided determines the order in which [mark
//   sets](#model.Mark.addToSet) are sorted and in which [parse
//   rules](#model.MarkSpec.parseDOM) are tried.
//
//   @cn 当前 schema 中的所有 mark 类型的对象。它们出现的顺序决定了在 [mark
//   sets](#model.Mark.addToSet) 中的存储顺序，以及 [parse rules](#model.MarkSpec.parseDOM) 的处理顺序。
//
//   topNode:: ?string
//   The name of the default top-level node for the schema. Defaults
//   to `"doc"`.
//
//   @cn 当前 schema 顶级节点的名字，默认是 `"doc"`。

// NodeSpec:: interface
//
//   content:: ?string
//   The content expression for this node, as described in the [schema
//   guide](/docs/guide/#schema.content_expressions). When not given,
//   the node does not allow any content.
//
//   @cn 就像在 [schema guide](https://www.xheldon.com/prosemirror-guide-chinese.html) 中描述的一样，为当前节点的内容表达式。
//   如果没有给定，则该节点不允许任何内容。
//
//   @comment schema guide 链接指向中文翻译指南，请搜索 Schema 下的 Content Expressions 一节。
//
//   marks:: ?string
//   The marks that are allowed inside of this node. May be a
//   space-separated string referring to mark names or groups, `"_"`
//   to explicitly allow all marks, or `""` to disallow marks. When
//   not given, nodes with inline content default to allowing all
//   marks, other nodes default to not allowing marks.
//
//   @cn 当前节点允许的 marks 类型。可能是一个空格分隔的字符串，内容是 mark 的名字或者 group 名。
//   `"_"` 表示明确允许所有的 marks，或者 `""` 表示禁止所有的 marks。如果没有设置该字段，则节点含有的内联内容将会默认允许所有的 marks，
//   其他不含内联内容的节点将默认不允许所有的 marks。
//
//   group:: ?string
//   The group or space-separated groups to which this node belongs,
//   which can be referred to in the content expressions for the
//   schema.
//
//   @cn 当前节点所属的 group，可以出现多个，用空格分隔，可以指向当前 schema 的内容表达式（content expressions）。
//
//   inline:: ?bool
//   Should be set to true for inline nodes. (Implied for text nodes.)
//
//   @cn 对于内联节点，应该被设置为 true（文本节点隐式的被设置为 true）。
//
//   atom:: ?bool
//   Can be set to true to indicate that, though this isn't a [leaf
//   node](#model.NodeType.isLeaf), it doesn't have directly editable
//   content and should be treated as a single unit in the view.
//
//   @cn 可以被设置为 true，以表示即使当前节点不是一个 [leaf node](#model.NodeType.isLeaf)，但是其也没有直接可编辑内容，
//   因此在 view 中应该被当成是一个独立的单位对待。
//
//   @comment 「独立单位对待」指的是，如在计数上，应该是 1；在事件上，内部元素触发的事件应该被视作是该节点触发的，等。
//
//   attrs:: ?Object<AttributeSpec>
//   The attributes that nodes of this type get.
//
//   @cn 当前节点拿到的 attributes。
//
//   selectable:: ?bool
//   Controls whether nodes of this type can be selected as a [node
//   selection](#state.NodeSelection). Defaults to true for non-text
//   nodes.
//
//   @cn 控制当前类型的节点是否能够被作为 [node selection](#state.NodeSelection) 所选中。
//   对于非文本节点来说，默认是 true。
//
//   draggable:: ?bool
//   Determines whether nodes of this type can be dragged without
//   being selected. Defaults to false.
//
//   @cn 决定在未选中的情况下，当前类型的节点能否被拖拽。默认是 false。
//
//   code:: ?bool
//   Can be used to indicate that this node contains code, which
//   causes some commands to behave differently.
//
//   @cn 指示当前节点包含 code，其会引起一些命令有特别的行为。
//
//   @comment 「特别的行为」如，在 code 节点中的内容如果是 li 和 文档中的 li 是两个处理逻辑，前者针对 code 块处理；后者针对 li 进行处理。
//
//   defining:: ?bool
//   Determines whether this node is considered an important parent
//   node during replace operations (such as paste). Non-defining (the
//   default) nodes get dropped when their entire content is replaced,
//   whereas defining nodes persist and wrap the inserted content.
//   Likewise, in _inserted_ content the defining parents of the
//   content are preserved when possible. Typically,
//   non-default-paragraph textblock types, and possibly list items,
//   are marked as defining.
//
//   @cn 决定当前节点是否在替换操作中被认为是一个重要的父级节点（如粘贴操作）。当节点的内容被整个替换掉的时候，
//   若该节点的 defining 为 false（默认），则其会被移除，但是 defining 为 true 的节点会保留，然后包裹住替换进来的内容。
//   同样地，对于 _插入的_ 内容，那些有着 defining 为 true 的父级节点会被尽可能的保留。一般来说，非默认段落的文本块节点类型及 li 元素，defining 应该是 true。
//
//   @comment 最有一句话讲的是，例如，默认的 paragraph 中，文本块节点，粘贴的时候应该直接替换掉它的父节点，也即另一个文本块。
//   但是对非默认 paragraph（即你自己定制的 paragraph）的话，在替换内容的时候，就需要保留该 非默认 paragraph 的一些属性，不能直接替换。同理 li 元素，
//   因为首先选中 li 元素内容，然后粘贴内容是一个很常见的操作，用户的预期是将粘贴内容作为 li 的内容，而不是直接替换掉 li 而粘贴成 paragraph（或其他 block）。
//
//   isolating:: ?bool
//   When enabled (default is false), the sides of nodes of this type
//   count as boundaries that regular editing operations, like
//   backspacing or lifting, won't cross. An example of a node that
//   should probably have this enabled is a table cell.
//
//   @cn 当该属性设置为 true 时（默认是 false），当前类型的节点的两侧将会计算作为边界，于是对于正常的编辑操作如删除、或者提升，将不会被跨越过去。
//   举个例子，对于 table 的 cell 节点，该属性应该被设置为 true。
//
//   @comment 「提升」操作指的是，如在一个二级 li 中，一般用户习惯下，按 shift + tab 会将该二级 li 提升到一级 li。
//
//   @comment 「跨越」指的是，操作会跨过当前节点到达下一个（或者上一个）节点。如删除操作，在段落起始位置继续按删除键，光标会跑到上一个节点的尾部；
//   在 li 起始位置按删除键，光标会跑到上一个 li 结尾处或者直接删除整个 ul/ol；但是在 table 的 td 中，在 td 起始位置按删除键跑到上一个 td 结尾，
//   显然不是预期。
//
//   toDOM:: ?(node: Node) → DOMOutputSpec
//   Defines the default way a node of this type should be serialized
//   to DOM/HTML (as used by
//   [`DOMSerializer.fromSchema`](#model.DOMSerializer^fromSchema)).
//   Should return a DOM node or an [array
//   structure](#model.DOMOutputSpec) that describes one, with an
//   optional number zero (“hole”) in it to indicate where the node's
//   content should be inserted.
//
//   @cn 定义当前节点的默认序列化成 DOM/HTML 的方式（被[`DOMSerializer.fromSchema`](#model.DOMSerializer^fromSchema)使用）。
//   应该返回一个 DOM 节点或者一个描述 ODM 节点的 [array structure](#model.DOMOutputSpec)，它带有可选的数字 0 （就是「洞」），
//   表示节点的内容应该被插在哪个位置。
//
//   For text nodes, the default is to create a text DOM node. Though
//   it is possible to create a serializer where text is rendered
//   differently, this is not supported inside the editor, so you
//   shouldn't override that in your text node spec.
//
//   @cn 对于文本节点，默认是创建一个文本 DOM 节点。虽然创建序列化器以将文本节点特殊渲染是可能的，但是当前编辑器并不支持这样做，因此你不应该覆盖文本节点中的该方法。
//
//   parseDOM:: ?[ParseRule]
//   Associates DOM parser information with this node, which can be
//   used by [`DOMParser.fromSchema`](#model.DOMParser^fromSchema) to
//   automatically derive a parser. The `node` field in the rules is
//   implied (the name of this node will be filled in automatically).
//   If you supply your own parser, you do not need to also specify
//   parsing rules in your schema.
//
//   @cn 当前节点相关的 DOM parser 信息，会被 [`DOMParser.fromSchema`](#model.DOMParser^fromSchema)
//   使用以自动的衍生出一个 parser。Rule 中的 `node` 字段是隐式的（节点的名字会自动填充）。如果你在此处提供了自己的 parser，那你就不需要再在 schema 配置的时候提供 parser 了。
//
//  @comment  配置 Editor view 的时候可以配置一个个 Parser 和 Serializer，如果提供，则此处就不用写 parseDOM 了。
//
//   toDebugString:: ?(node: Node) -> string
//   Defines the default way a node of this type should be serialized
//   to a string representation for debugging (e.g. in error messages).
//
//   @cn 定义一个该类型节点被序列化成一个字符串形式的默认方法，以做 debugging 用途。

// MarkSpec:: interface
//
//   attrs:: ?Object<AttributeSpec>
//   The attributes that marks of this type get.
//
//   @cn 当前 mark 类型拿到的 attributes。
//
//   inclusive:: ?bool
//   Whether this mark should be active when the cursor is positioned
//   at its end (or at its start when that is also the start of the
//   parent node). Defaults to true.
//
//   @cn 当光标放到该 mark 的结尾处（或者如果该 mark 开始处同样是父级节点的开始处时，放到 mark 的开始处）时，该 marks 是否应该被激活。默认是 true/
//
//   @comment 「被激活」的意思是，可以通过 API 获取光标所在的 resolvedPos 信息以查到相关的 marks。
//
//   excludes:: ?string
//   Determines which other marks this mark can coexist with. Should
//   be a space-separated strings naming other marks or groups of marks.
//   When a mark is [added](#model.Mark.addToSet) to a set, all marks
//   that it excludes are removed in the process. If the set contains
//   any mark that excludes the new mark but is not, itself, excluded
//   by the new mark, the mark can not be added an the set. You can
//   use the value `"_"` to indicate that the mark excludes all
//   marks in the schema.
//
//   Defaults to only being exclusive with marks of the same type. You
//   can set it to an empty string (or any string not containing the
//   mark's own name) to allow multiple marks of a given type to
//   coexist (as long as they have different attributes).
//
//   group:: ?string
//   The group or space-separated groups to which this mark belongs.
//
//   spanning:: ?bool
//   Determines whether marks of this type can span multiple adjacent
//   nodes when serialized to DOM/HTML. Defaults to true.
//
//   toDOM:: ?(mark: Mark, inline: bool) → DOMOutputSpec
//   Defines the default way marks of this type should be serialized
//   to DOM/HTML. When the resulting spec contains a hole, that is
//   where the marked content is placed. Otherwise, it is appended to
//   the top node.
//
//   parseDOM:: ?[ParseRule]
//   Associates DOM parser information with this mark (see the
//   corresponding [node spec field](#model.NodeSpec.parseDOM)). The
//   `mark` field in the rules is implied.

// AttributeSpec:: interface
//
// Used to [define](#model.NodeSpec.attrs) attributes on nodes or
// marks.
//
//   default:: ?any
//   The default value for this attribute, to use when no explicit
//   value is provided. Attributes that have no default must be
//   provided whenever a node or mark of a type that has them is
//   created.

// ::- A document schema. Holds [node](#model.NodeType) and [mark
// type](#model.MarkType) objects for the nodes and marks that may
// occur in conforming documents, and provides functionality for
// creating and deserializing such documents.
export class Schema {
  // :: (SchemaSpec)
  // Construct a schema from a schema [specification](#model.SchemaSpec).
  constructor(spec) {
    // :: SchemaSpec
    // The [spec](#model.SchemaSpec) on which the schema is based,
    // with the added guarantee that its `nodes` and `marks`
    // properties are
    // [`OrderedMap`](https://github.com/marijnh/orderedmap) instances
    // (not raw objects).
    this.spec = {}
    for (let prop in spec) this.spec[prop] = spec[prop]
    this.spec.nodes = OrderedMap.from(spec.nodes)
    this.spec.marks = OrderedMap.from(spec.marks)

    // :: Object<NodeType>
    // An object mapping the schema's node names to node type objects.
    this.nodes = NodeType.compile(this.spec.nodes, this)

    // :: Object<MarkType>
    // A map from mark names to mark type objects.
    this.marks = MarkType.compile(this.spec.marks, this)

    let contentExprCache = Object.create(null)
    for (let prop in this.nodes) {
      if (prop in this.marks)
        throw new RangeError(prop + " can not be both a node and a mark")
      let type = this.nodes[prop], contentExpr = type.spec.content || "", markExpr = type.spec.marks
      type.contentMatch = contentExprCache[contentExpr] ||
        (contentExprCache[contentExpr] = ContentMatch.parse(contentExpr, this.nodes))
      type.inlineContent = type.contentMatch.inlineContent
      type.markSet = markExpr == "_" ? null :
        markExpr ? gatherMarks(this, markExpr.split(" ")) :
        markExpr == "" || !type.inlineContent ? [] : null
    }
    for (let prop in this.marks) {
      let type = this.marks[prop], excl = type.spec.excludes
      type.excluded = excl == null ? [type] : excl == "" ? [] : gatherMarks(this, excl.split(" "))
    }

    this.nodeFromJSON = this.nodeFromJSON.bind(this)
    this.markFromJSON = this.markFromJSON.bind(this)

    // :: NodeType
    // The type of the [default top node](#model.SchemaSpec.topNode)
    // for this schema.
    this.topNodeType = this.nodes[this.spec.topNode || "doc"]

    // :: Object
    // An object for storing whatever values modules may want to
    // compute and cache per schema. (If you want to store something
    // in it, try to use property names unlikely to clash.)
    this.cached = Object.create(null)
    this.cached.wrappings = Object.create(null)
  }

  // :: (union<string, NodeType>, ?Object, ?union<Fragment, Node, [Node]>, ?[Mark]) → Node
  // Create a node in this schema. The `type` may be a string or a
  // `NodeType` instance. Attributes will be extended
  // with defaults, `content` may be a `Fragment`,
  // `null`, a `Node`, or an array of nodes.
  node(type, attrs, content, marks) {
    if (typeof type == "string")
      type = this.nodeType(type)
    else if (!(type instanceof NodeType))
      throw new RangeError("Invalid node type: " + type)
    else if (type.schema != this)
      throw new RangeError("Node type from different schema used (" + type.name + ")")

    return type.createChecked(attrs, content, marks)
  }

  // :: (string, ?[Mark]) → Node
  // Create a text node in the schema. Empty text nodes are not
  // allowed.
  text(text, marks) {
    let type = this.nodes.text
    return new TextNode(type, type.defaultAttrs, text, Mark.setFrom(marks))
  }

  // :: (union<string, MarkType>, ?Object) → Mark
  // Create a mark with the given type and attributes.
  mark(type, attrs) {
    if (typeof type == "string") type = this.marks[type]
    return type.create(attrs)
  }

  // :: (Object) → Node
  // Deserialize a node from its JSON representation. This method is
  // bound.
  nodeFromJSON(json) {
    return Node.fromJSON(this, json)
  }

  // :: (Object) → Mark
  // Deserialize a mark from its JSON representation. This method is
  // bound.
  markFromJSON(json) {
    return Mark.fromJSON(this, json)
  }

  nodeType(name) {
    let found = this.nodes[name]
    if (!found) throw new RangeError("Unknown node type: " + name)
    return found
  }
}

function gatherMarks(schema, marks) {
  let found = []
  for (let i = 0; i < marks.length; i++) {
    let name = marks[i], mark = schema.marks[name], ok = mark
    if (mark) {
      found.push(mark)
    } else {
      for (let prop in schema.marks) {
        let mark = schema.marks[prop]
        if (name == "_" || (mark.spec.group && mark.spec.group.split(" ").indexOf(name) > -1))
          found.push(ok = mark)
      }
    }
    if (!ok) throw new SyntaxError("Unknown mark type: '" + marks[i] + "'")
  }
  return found
}
