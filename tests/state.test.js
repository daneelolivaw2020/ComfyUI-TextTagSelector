import test from "node:test";
import assert from "node:assert/strict";
import { emptyState, labelFor, readSource, readSourceInfo, readState, reloadState } from "../web/state.js";

const fragments = state => state.sections.flatMap(section => section.fragments);

test("real lines, CRLF, significant spaces, punctuation and Unicode", () => {
    const state = reloadState("  café, 👩🏽‍🚀  \r\n\t \r\nSecond\nThird\rFourth", emptyState());
    assert.deepEqual(fragments(state).map(item => item.text), ["  café, 👩🏽‍🚀  ", "Second", "Third", "Fourth"]);
    assert.ok(fragments(state).every(item => !item.enabled));
});

test("headers, preamble, empty and repeated sections do not become fragments", () => {
    const state = reloadState("First\n--- Hair\nBlonde\n--- Hair\nRedhead\n--- Empty", emptyState());
    assert.deepEqual(state.sections.map(section => section.title), ["General", "Hair", "Hair", "Empty"]);
    assert.deepEqual(fragments(state).map(item => item.text), ["First", "Blonde", "Redhead"]);
    assert.equal(state.sections[3].fragments.length, 0);
});

test("reordering preserves selection, changed/new/removed lines behave deterministically", () => {
    const before = reloadState("A\nB\nC", emptyState());
    fragments(before)[0].enabled = true;
    fragments(before)[2].enabled = true;
    const after = reloadState("C\nnew\nA changed\nB", before);
    assert.deepEqual(fragments(after).map(item => [item.text, item.enabled]),
        [["C", true], ["new", false], ["A changed", false], ["B", false]]);
    assert.equal(fragments(before).length, 3);
});

test("identical duplicates match globally by occurrence across sections", () => {
    const before = reloadState("--- One\nA\nA\n--- Two\nA", emptyState());
    fragments(before)[0].enabled = true;
    fragments(before)[2].enabled = true;
    const after = reloadState("--- Two\nA\n--- One\nA\nA\nA", before);
    assert.deepEqual(fragments(after).map(item => item.enabled), [true, false, true, false]);
    assert.deepEqual(fragments(reloadState("A", before)).map(item => item.enabled), [true]);
});

test("repeated Reload never accumulates tags and valid empty input clears them", () => {
    let state = emptyState();
    for (let iteration = 0; iteration < 10; iteration++) state = reloadState("A\nA\nB", state);
    assert.equal(fragments(state).length, 3);
    assert.deepEqual(reloadState("", state).sections, []);
});

test("display truncation preserves graphemes and never mutates content", () => {
    const text = "👩🏽‍🚀e\u0301ABC";
    assert.equal(labelFor(text, 2), "👩🏽‍🚀e\u0301…");
    assert.equal(labelFor(text, 0), text);
    assert.equal(labelFor("ab", 2), "ab");
});

test("saved JSON restores independent state and rejects malformed data", () => {
    const state = reloadState("A", emptyState());
    const restored = readState(JSON.stringify(state));
    restored.sections[0].fragments[0].enabled = true;
    assert.equal(fragments(state)[0].enabled, false);
    for (const raw of ["null", "garbage", '{"version":2}', '{"version":1,"sections":[]}']) {
        assert.throws(() => readState(raw));
    }
});

function sourceFixture(value = "live text") {
    const origin = { comfyClass: "PrimitiveStringMultiline", inputs: [], widgets: [{ name: "value", value }] };
    const node = { inputs: [{ name: "source", link: 7 }], graph: {
        links: new Map([[7, { origin_id: 1, origin_slot: 0 }]]), getNodeById: () => origin,
    } };
    return { node, origin };
}

test("source reads the current native value, including empty text, without running anything", () => {
    const { node, origin } = sourceFixture();
    assert.equal(readSource(node, "draft"), "live text");
    origin.widgets[0].value = "";
    assert.equal(readSource(node, "draft"), "");
    node.inputs[0].link = null;
    assert.equal(readSource(node, "draft"), "draft");
});

test("other node types with one readable text field are tried, with an experimental notice", () => {
    const { node, origin } = sourceFixture();
    origin.comfyClass = "SomethingElse";
    const result = readSourceInfo(node, "fallback");
    assert.equal(result.text, "live text");
    assert.match(result.warning, /Experimental.*field "value"/);
    origin.widgets = [];
    assert.throws(() => readSource(node, "fallback"), /Cannot identify.*Existing tags were preserved/);
});

test("Reload retains options without sharing a mutable object", () => {
    const before = emptyState();
    before.options.separator = "!";
    const after = reloadState("A", before);
    after.options.separator = "?";
    assert.equal(before.options.separator, "!");
});

function graphFixture() {
    const nodes = new Map(), links = new Map();
    const graph = { links, getNodeById: id => nodes.get(id) };
    function add(id, type, widgets = [], outputs = [{ name: "STRING", type: "STRING" }]) {
        const node = { id, comfyClass: type, widgets, outputs, inputs: [], graph };
        nodes.set(id, node);
        return node;
    }
    function connect(origin, target, inputName, slot = 0) {
        const id = links.size + 1;
        links.set(id, { origin_id: origin.id, origin_slot: slot });
        target.inputs.push({ name: inputName, type: "STRING", link: id });
    }
    const selector = add(0, "TextTagSelector");
    return { add, connect, selector };
}

test("Crystools concatenated output resolves connected inputs and literal delimiter", () => {
    const { add, connect, selector } = graphFixture();
    const text = add(1, "PrimitiveStringMultiline", [{ name: "value", value: "--- Clothing\nwearing a hat," }]);
    const list = add(2, "List of strings [Crystools]", [
        { name: "string_1", value: "stale widget must not win" },
        { name: "string_2", value: "" },
        { name: "string_3", value: "with a skirt," },
        { name: "string_4", value: " " },
        { name: "delimiter", value: "\n" },
    ], [{ name: "concatenated", type: "STRING" }, { name: "list_string", type: "ListString" }]);
    connect(text, list, "string_1");
    connect(list, selector, "source");
    const result = readSourceInfo(selector, "unused");
    assert.equal(result.text, "--- Clothing\nwearing a hat,\nwith a skirt,\n ");
    assert.equal(result.warning, "");
    assert.deepEqual(fragments(reloadState(result.text, emptyState())).map(item => item.text),
        ["wearing a hat,", "with a skirt,"]);
    list.widgets.find(widget => widget.name === "delimiter").value = "\\n";
    assert.equal(readSource(selector), "--- Clothing\nwearing a hat,\\nwith a skirt,\\n ");
    selector.graph.links.get(selector.inputs[0].link).origin_slot = 1;
    assert.throws(() => readSource(selector), /concatenated/);
});

test("Crystools primitives, connected native inputs, nested lists and shared sources", () => {
    const { add, connect, selector } = graphFixture();
    const text = add(1, "Primitive string multiline [Crystools]", [{ name: "string", value: "A\nB" }]);
    const native = add(2, "PrimitiveString", [{ name: "value", value: "old" }]);
    connect(text, native, "value");
    const inner = add(3, "List of strings [Crystools]", [{ name: "delimiter", value: "|" }]);
    connect(native, inner, "string_1");
    connect(native, inner, "string_2");
    const outer = add(4, "List of strings [Crystools]", [{ name: "string_2", value: "C" }, { name: "delimiter", value: "!" }]);
    connect(inner, outer, "string_1");
    connect(outer, selector, "source");
    assert.equal(readSource(selector), "A\nB|A\nB!C");
    text.widgets[0].value = "";
    assert.equal(readSource(selector), "C");
});

test("legacy reroutes resolve their text source without evaluating a workflow", () => {
    const { add, connect, selector } = graphFixture();
    const text = add(1, "PrimitiveString", [{ name: "value", value: "through reroute" }]);
    const reroute = add(2, "Reroute", [], [{ name: "", type: "*" }]);
    connect(text, reroute, "");
    connect(reroute, selector, "source");
    assert.equal(readSource(selector), "through reroute");
});

test("ambiguous generic nodes fail while output-matching fields can disambiguate", () => {
    const { add, connect, selector } = graphFixture();
    const custom = add(1, "OtherTextNode", [
        { name: "text", type: "text", value: "first" },
        { name: "prompt", type: "text", value: "second" },
    ]);
    connect(custom, selector, "source");
    assert.throws(() => readSource(selector), /single readable text field/);
    custom.outputs[0].name = "prompt";
    assert.equal(readSource(selector), "second");
    custom.outputs.push({ name: "other", type: "STRING" });
    selector.graph.links.get(selector.inputs[0].link).origin_slot = 1;
    assert.throws(() => readSource(selector), /single readable text field/);
});

test("experimental reads ignore combo/control widgets and follow text connections", () => {
    const { add, connect, selector } = graphFixture();
    const literal = add(1, "PrimitiveString", [{ name: "value", value: "connected text" }]);
    const custom = add(2, "CustomText", [
        { name: "prompt", type: "text", value: "stale" },
        { name: "mode", type: "combo", value: "random", options: { values: ["random"] } },
        { name: "preview", type: "text", value: "display only", serialize: false },
    ]);
    connect(literal, custom, "prompt");
    connect(custom, selector, "source");
    assert.equal(readSource(selector), "connected text");
    assert.match(readSourceInfo(selector).warning, /Python transformations are not evaluated/);
});

test("cycles and missing linked inputs fail instead of using stale widget defaults", () => {
    const { add, connect, selector } = graphFixture();
    const one = add(1, "PrimitiveString", [{ name: "value", value: "old one" }]);
    const two = add(2, "PrimitiveString", [{ name: "value", value: "old two" }]);
    connect(one, two, "value");
    connect(two, one, "value");
    connect(one, selector, "source");
    assert.throws(() => readSource(selector), /cycle.*Existing tags were preserved/);
    selector.graph.links.delete(one.inputs[0].link);
    assert.throws(() => readSource(selector), /Cannot read the connection/);
});
