import test from "node:test";
import assert from "node:assert/strict";
import { emptyState, labelFor, readSource, readState, reloadState } from "../web/state.js";

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

test("unsupported, indirect or unreadable source fails instead of using internal text", () => {
    const { node, origin } = sourceFixture();
    origin.comfyClass = "SomethingElse";
    assert.throws(() => readSource(node, "fallback"), /direct connection/);
    origin.comfyClass = "PrimitiveStringMultiline";
    origin.inputs = [{ name: "value", link: 3 }];
    assert.throws(() => readSource(node, "fallback"), /connected to another/);
    origin.inputs = [];
    origin.widgets = [];
    assert.throws(() => readSource(node, "fallback"), /Cannot read/);
});

test("Reload retains options without sharing a mutable object", () => {
    const before = emptyState();
    before.options.separator = "!";
    const after = reloadState("A", before);
    after.options.separator = "?";
    assert.equal(before.options.separator, "!");
});
