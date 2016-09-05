const {Mark} = require("../src")
const {schema, doc, p, em, a} = require("./build")
const assert = require("assert")

let em_ = schema.mark("em")
let strong = schema.mark("strong")
let link = (href, title) => schema.mark("link", {href, title})
let code = schema.mark("code")

describe("Mark", () => {
  describe("sameSet", () => {
    it("returns true for two empty sets", () => assert(Mark.sameSet([], [])))

    it("returns true for simple identical sets", () =>
       assert(Mark.sameSet([em_, strong], [em_, strong])))

    it("returns false for different sets", () =>
       assert(!Mark.sameSet([em_, strong], [em_, code])))

    it("returns false when set size differs", () =>
       assert(!Mark.sameSet([em_, strong], [em_, strong, code])))

    it("recognizes identical links in set", () =>
       assert(Mark.sameSet([link("http://foo"), code], [link("http://foo"), code])))

    it("recognizes different links in set", () =>
       assert(!Mark.sameSet([link("http://foo"), code], [link("http://bar"), code])))
  })

  describe("eq", () => {
    it("considers identical links to be the same", () =>
       assert(link("http://foo").eq(link("http://foo"))))

    it("considers different links to differ", () =>
       assert(!link("http://foo").eq(link("http://bar"))))

    it("considers links with different titles to differ", () =>
       assert(!link("http://foo", "A").eq(link("http://foo", "B"))))
  })

  describe("addToSet", () => {
    it("can add to the empty set", () =>
       assert(Mark.sameSet(em_.addToSet([]), [em_])))

    it("is a no-op when the added thing is in set", () =>
       assert(Mark.sameSet(em_.addToSet([em_]), [em_])))

    it("adds marks with lower rank before others", () =>
       assert(Mark.sameSet(em_.addToSet([strong]), [em_, strong])))

    it("adds marks with higher rank after others", () =>
       assert(Mark.sameSet(strong.addToSet([em_]), [em_, strong])))

    it("replaces different marks with new attributes", () =>
       assert(Mark.sameSet(link("http://bar").addToSet([em_, link("http://foo")]),
                           [em_, link("http://bar")])))

    it("does nothing when adding an existing link", () =>
       assert(Mark.sameSet(link("http://foo").addToSet([em_, link("http://foo")]),
                           [em_, link("http://foo")])))

    it("puts code marks at the end", () =>
       assert(Mark.sameSet(code.addToSet([em_, strong, link("http://foo")]),
                           [em_, strong, link("http://foo"), code])))

    it("puts marks with middle rank in the middle", () =>
       assert(Mark.sameSet(strong.addToSet([em_, code]), [em_, strong, code])))
  })

  describe("removeFromSet", () => {
    it("is a no-op for the empty set", () =>
       assert(Mark.sameSet(em_.removeFromSet([]), [])))

    it("can remove the last mark from a set", () =>
       assert(Mark.sameSet(em_.removeFromSet([em_]), [])))

    it("is a no-op when the mark isn't in the set", () =>
       assert(Mark.sameSet(strong.removeFromSet([em_]), [em_])))

    it("can remove a mark with attributes", () =>
       assert(Mark.sameSet(link("http://foo").removeFromSet([link("http://foo")]), [])))

    it("doesn't remove a mark when its attrs differ", () =>
       assert(Mark.sameSet(link("http://foo", "title").removeFromSet([link("http://foo")]),
                           [link("http://foo")])))
  })

  describe("marksAt", () => {
    function isAt(doc, mark, result) {
      if (mark.isInSet(doc.marksAt(doc.tag.a)) != result)
        assert.fail(!result, result, "hasMark(" + doc + ", " + doc.tag.a + ", " + mark.type.name + ")")
    }

    it("recognizes a mark exists inside marked text", () =>
       isAt(doc(p(em("fo<a>o"))), em_, true))

    it("recognizes a mark doesn't exist in non-marked text", () =>
       isAt(doc(p(em("fo<a>o"))), strong, false))

    it("considers a mark active after the mark", () =>
       isAt(doc(p(em("hi"), "<a> there")), em_, true))

    it("considers a mark inactive before the mark", () =>
       isAt(doc(p("one <a>", em("two"))), em_, false))

    it("considers a mark active at the start of the textblock", () =>
       isAt(doc(p(em("<a>one"))), em_, true))

    it("notices that attributes differ", () =>
       isAt(doc(p(a("li<a>nk"))), link("http://baz"), false))
  })
})
