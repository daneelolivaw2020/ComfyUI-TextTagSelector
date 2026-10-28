// Reload-only readers. Never enqueue work or substitute a stale runtime output.
const NATIVE_TEXT = new Set(["PrimitiveString", "PrimitiveStringMultiline"]);
const CRYSTOOLS_TEXT = new Set(["Primitive string [Crystools]", "Primitive string multiline [Crystools]"]);
const TEXT_NAMES = new Set(["value", "text", "string", "prompt", "positive", "negative"]);

export function readSourceInfo(node, draft) {
    const warnings = new Set();
    const active = new Map();

    function linkedInput(target, index, depth) {
        const input = target.inputs?.[index];
        const graph = target.graph ?? node.graph;
        const link = graph?.links?.get?.(input?.link) ?? graph?.links?.[input?.link];
        const origin = target.getInputNode?.(index) ?? graph?.getNodeById?.(link?.origin_id);
        const rawSlot = link?.origin_slot;
        const slot = typeof rawSlot === "number" || (typeof rawSlot === "string" && /^\d+$/.test(rawSlot))
            ? Number(rawSlot) : NaN;
        if (!origin || !link || !Number.isSafeInteger(slot) || slot < 0) {
            throw new Error(`Cannot read the connection to ${input?.name ?? "source"}.`);
        }
        return output(origin, slot, depth + 1);
    }

    function inputValue(target, name, depth, missing) {
        const index = target.inputs?.findIndex(input => input.name === name) ?? -1;
        if (target.inputs?.[index]?.link != null) return linkedInput(target, index, depth);
        const widget = target.widgets?.find(item => item.name === name);
        if (!widget && missing !== undefined) return missing;
        if (typeof widget?.value !== "string") {
            throw new Error(`Cannot read text field "${name}" on ${target.title ?? target.comfyClass ?? "the source node"}.`);
        }
        return widget.value;
    }

    function genericText(target, slot, depth) {
        const selectedOutput = target.outputs?.[slot];
        const widgets = (target.widgets ?? []).filter(widget =>
            typeof widget.value === "string" && widget.type !== "combo" &&
            widget.options?.values == null && widget.options?.serialize !== false &&
            widget.serialize !== false &&
            (TEXT_NAMES.has(widget.name?.toLowerCase()) ||
                ["text", "string", "customtext"].includes(widget.type) || widget.options?.multiline === true));
        const candidates = new Set(widgets.map(widget => widget.name));
        for (const input of target.inputs ?? []) {
            if (input.type === "STRING" && TEXT_NAMES.has(input.name?.toLowerCase())) candidates.add(input.name);
        }
        // A matching output/input name can disambiguate nodes with several fields.
        // Otherwise only try a single text field on a single STRING output.
        const matching = [...candidates].filter(name => name === selectedOutput?.name);
        const textOutputs = (target.outputs ?? []).filter(item => item.type === "STRING");
        let name;
        if (matching.length === 1) name = matching[0];
        else if (candidates.size === 1 && (textOutputs.length === 1 || (!target.outputs?.length && slot === 0))) {
            name = [...candidates][0];
        } else {
            throw new Error(`Cannot identify a single readable text field on ${target.title ?? target.comfyClass ?? "the source node"}. Its output may require execution.`);
        }
        const text = inputValue(target, name, depth);
        warnings.add(`Experimental: imported field "${name}" from ${target.title ?? target.comfyClass ?? "source"}; Python transformations are not evaluated.`);
        return text;
    }

    function output(target, slot, depth) {
        if (depth > 64) throw new Error("The source connection chain is too deep.");
        let slots = active.get(target);
        if (slots?.has(slot)) throw new Error("A cycle was found in the source connections.");
        if (!slots) active.set(target, slots = new Set());
        slots.add(slot);
        try {
            if (target.outputs && !target.outputs[slot]) throw new Error("The connected output no longer exists.");
            const type = target.comfyClass ?? target.type;
            if (type === "Reroute") {
                if (slot !== 0 || target.inputs?.[0]?.link == null) throw new Error("The reroute has no readable source.");
                return linkedInput(target, 0, depth);
            }
            const selectedOutput = target.outputs?.[slot];
            if (selectedOutput?.type && selectedOutput.type !== "STRING") {
                throw new Error("Use a STRING output. For Crystools List of strings, connect the concatenated output.");
            }
            if (NATIVE_TEXT.has(type) || CRYSTOOLS_TEXT.has(type)) {
                if (slot !== 0) throw new Error("Cannot read this output as a text value.");
                return inputValue(target, NATIVE_TEXT.has(type) ? "value" : "string", depth);
            }
            if (type === "List of strings [Crystools]") {
                if (slot !== 0) throw new Error("Connect the Crystools concatenated output, not list_string.");
                const values = [];
                for (let index = 1; index <= 8; index++) {
                    const value = inputValue(target, `string_${index}`, depth, "");
                    if (value !== "") values.push(value);
                }
                // Match Crystools CListString.execute: ignore empty strings and
                // join literally. In particular, do not decode backslash escapes.
                return values.join(inputValue(target, "delimiter", depth, ""));
            }
            return genericText(target, slot, depth);
        } finally {
            slots.delete(slot);
        }
    }

    try {
        const index = node.inputs?.findIndex(input => input.name === "source") ?? -1;
        const text = node.inputs?.[index]?.link != null ? linkedInput(node, index, 0) : draft;
        if (typeof text !== "string") throw new Error("The source did not provide text.");
        return { text, warning: [...warnings].join(" ") };
    } catch (error) {
        throw new Error(`${error.message} Existing tags were preserved.`);
    }
}

export function readSource(node, draft) {
    return readSourceInfo(node, draft).text;
}
