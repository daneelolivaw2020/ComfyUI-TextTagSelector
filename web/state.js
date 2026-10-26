// Pure state helpers shared by the extension and tests; no ComfyUI globals.
export function emptyState() {
    return { version: 1, sections: [], options: { use_new_lines: false, separator: ", ", suffix: "" } };
}

export function readState(raw) {
    let state;
    try { state = JSON.parse(raw); }
    catch { throw new Error("Invalid saved state JSON. Restore a valid workflow before editing."); }
    if (state?.version !== 1) throw new Error("Unsupported saved state version (expected 1).");
    if (!Array.isArray(state.sections) || !state.options ||
        typeof state.options.use_new_lines !== "boolean" ||
        typeof state.options.separator !== "string" || typeof state.options.suffix !== "string") {
        throw new Error("Invalid saved sections or options.");
    }
    for (const section of state.sections) {
        if (!section || typeof section.title !== "string" || !Array.isArray(section.fragments)) {
            throw new Error("Invalid saved section.");
        }
        for (const item of section.fragments) {
            if (!item || typeof item.text !== "string" || typeof item.enabled !== "boolean") {
                throw new Error("Invalid saved fragment or selection.");
            }
        }
    }
    return state;
}

export function reloadState(text, previous) {
    if (typeof text !== "string") throw new Error("The source did not provide text.");
    const previousStates = new Map();
    for (const section of previous.sections) {
        for (const item of section.fragments) {
            if (!previousStates.has(item.text)) previousStates.set(item.text, []);
            previousStates.get(item.text).push(item.enabled);
        }
    }
    const occurrences = new Map();
    const sections = [];
    let current = null;
    for (const line of text.split(/\r\n|\n|\r/)) {
        if (!line.trim()) continue;
        const heading = /^---[ \t]+(\S.*)$/.exec(line);
        if (heading) {
            current = { title: heading[1].trim(), fragments: [] };
            sections.push(current);
            continue;
        }
        if (!current) {
            current = { title: "General", fragments: [] };
            sections.push(current);
        }
        const index = occurrences.get(line) ?? 0;
        occurrences.set(line, index + 1);
        current.fragments.push({ text: line, enabled: previousStates.get(line)?.[index] ?? false });
    }
    return { version: 1, sections, options: { ...previous.options } };
}

const segmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
export function labelFor(text, maximum) {
    if (!maximum) return text;
    const parts = segmenter ? Array.from(segmenter.segment(text), part => part.segment) : Array.from(text);
    return parts.length > maximum ? parts.slice(0, maximum).join("") + "…" : text;
}

export function readSource(node, draft) {
    const slotIndex = node.inputs?.findIndex(input => input.name === "source") ?? -1;
    const input = node.inputs?.[slotIndex];
    if (input?.link == null) return draft;
    const link = node.graph?.links?.get?.(input.link) ?? node.graph?.links?.[input.link];
    const origin = node.getInputNode?.(slotIndex) ?? node.graph?.getNodeById?.(link?.origin_id);
    if (!origin || origin.comfyClass !== "PrimitiveStringMultiline" || link?.origin_slot !== 0) {
        throw new Error("Reload supports a direct connection from native Text (Multiline). Existing tags were preserved.");
    }
    if (origin.inputs?.some(item => item.name === "value" && item.link != null)) {
        throw new Error("The source value is connected to another node. Use editable native Text (Multiline).");
    }
    const value = origin.widgets?.find(widget => widget.name === "value")?.value;
    if (typeof value !== "string") throw new Error("Cannot read the source value. Existing tags were preserved.");
    return value;
}
