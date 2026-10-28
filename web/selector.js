import { readState, readUiSettings, reloadState, labelFor, readSourceInfo } from "./state.js?v=0.1.2";

export function attachSelector(node) {
    const stateWidget = node.widgets?.find(widget => widget.name === "state_json");
    if (!stateWidget) throw new Error("Text Tag Selector: state_json widget is missing.");
    // Keep the declared STRING in workflow/prompt serialization, but render the
    // editor ourselves. Do not push unregistered widget objects into node.widgets.
    stateWidget.hidden = true;
    stateWidget.type = "hidden";
    stateWidget.computeSize = () => [0, -4];
    stateWidget.draw = () => {};

    const root = document.createElement("div");
    const shadow = root.attachShadow({ mode: "open" });
    shadow.innerHTML = `
        <style>
        :host{display:block;height:100%;min-width:0;color:#e9edf2;color-scheme:dark;font:12px system-ui,sans-serif}
        *{box-sizing:border-box} .panel{display:flex;flex-direction:column;gap:8px;height:100%;min-height:0;padding:9px;background:#20242b;border:1px solid #454c58;border-radius:8px;overflow:hidden}
        header{display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none}.source{color:#b9c4d3;font-size:11px}
        button,input,textarea{font:inherit;color:inherit;background:#2e3440;border:1px solid #5b6575;border-radius:5px;padding:5px 7px}
        button,summary{cursor:pointer}button:hover{border-color:#adbed5}button:focus-visible,input:focus-visible,textarea:focus-visible,summary:focus-visible{outline:2px solid #8dc6ff;outline-offset:2px}
        .editor{flex:none}.editor summary{color:#c4cfde}.editor textarea{display:block;width:100%;height:96px;min-height:48px;max-height:180px;resize:vertical;margin-top:6px;white-space:pre-wrap;overflow-wrap:anywhere}
        .wall{flex:1;min-height:70px;overflow:auto;overscroll-behavior:contain;padding:2px 3px 2px 0}.section{margin-bottom:9px}.section summary{font-weight:600;color:#bacbdf;margin-bottom:6px;overflow-wrap:anywhere}
        .tags{display:flex;flex-wrap:wrap;align-items:flex-start;gap:5px;min-width:0}.tag{display:block;flex:0 1 auto;max-width:100%;min-width:0;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.4;border-radius:12px;padding:4px 9px;background:#292e37;color:#d0d7e2;border:1px solid #5b6575}
        .tag[aria-pressed=true]{background:#234b69;border-color:#8acbff;color:#fff;box-shadow:inset 0 0 0 1px #8acbff}.empty{color:#aeb8c5;line-height:1.5;padding:12px 2px}
        footer{display:flex;flex-direction:column;gap:6px;flex:none;border-top:1px solid #414957;padding-top:7px}.row{display:flex;align-items:center;gap:9px;flex-wrap:wrap}label{display:flex;align-items:center;gap:6px}input[type=number]{width:66px}input[type=checkbox]{margin:0}.field{flex:1;min-width:120px}.field input{width:100%;min-width:0}.status{font-size:11px;color:#bcc8d7;flex:none;overflow-wrap:anywhere}.status:empty{display:none}.status.error{color:#ffb5ad}
        </style>
        <div class="panel">
            <header><span class="source"></span><button class="reload" type="button">Reload</button></header>
            <details class="editor"><summary>Edit text</summary><textarea aria-label="Source text" spellcheck="false" placeholder="One fragment per line. Use --- Title for sections."></textarea></details>
            <div class="wall" aria-label="Selectable text fragments"></div>
            <footer>
                <div class="row"><label>Maximum characters <input class="maximum" type="number" min="0" step="1" value="100"></label><label><input class="newlines" type="checkbox"> Use new lines</label></div>
                <div class="row"><label class="field">Separator <input class="separator" type="text" spellcheck="false"></label><label class="field">Suffix <input class="suffix" type="text" spellcheck="false"></label></div>
            </footer>
            <div class="status" role="status" aria-live="polite"></div>
        </div>`;
    const $ = selector => shadow.querySelector(selector);
    const wall = $(".wall"), editor = $(".editor"), textarea = $("textarea");
    let restoring = false, removed = false;
    node.properties ??= {};
    function ui() {
        if (!node.properties || typeof node.properties !== "object" || Array.isArray(node.properties)) node.properties = {};
        const settings = node.properties.tts_ui;
        if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
            node.properties.tts_ui = readUiSettings(settings);
        }
        return node.properties.tts_ui;
    }
    function status(message = "", error = false) {
        $(".status").textContent = message;
        $(".status").classList.toggle("error", error);
    }
    function change(action) {
        node.graph?.beforeChange?.();
        try { action(); }
        finally {
            node.graph?.afterChange?.();
            node.graph?.change?.();
            node.setDirtyCanvas?.(true, true);
        }
    }
    function write(state) {
        stateWidget.value = JSON.stringify(state);
        stateWidget.callback?.(stateWidget.value);
    }
    function mutate(action) {
        const state = readState(stateWidget.value);
        change(() => { action(state); write(state); });
    }
    function sourceLabel() {
        const connected = node.inputs?.some(input => input.name === "source" && input.link != null);
        $(".source").textContent = connected ? "Connected text · click Reload to update" :
            (ui().draft !== ui().loadedText ? "Internal text · pending Reload" : "Internal text");
        textarea.disabled = connected;
    }
    function render() {
        const scroll = wall.scrollTop;
        wall.replaceChildren();
        try {
            const state = readState(stateWidget.value);
            $(".newlines").checked = state.options.use_new_lines;
            $(".separator").value = state.options.separator;
            $(".suffix").value = state.options.suffix;
            const titles = new Map();
            state.sections.forEach((section, sectionIndex) => {
                const occurrence = titles.get(section.title) ?? 0;
                titles.set(section.title, occurrence + 1);
                const key = JSON.stringify([section.title, occurrence]);
                const details = document.createElement("details");
                details.className = "section";
                details.open = ui().sections?.[key] !== false;
                const summary = document.createElement("summary");
                summary.textContent = section.title;
                const tags = document.createElement("div");
                tags.className = "tags";
                section.fragments.forEach((item, itemIndex) => {
                    const button = document.createElement("button");
                    button.type = "button";
                    button.className = "tag";
                    button.title = item.text;
                    button.textContent = labelFor(item.text, ui().maximum);
                    button.setAttribute("aria-pressed", String(item.enabled));
                    button.addEventListener("click", () => {
                        mutate(current => {
                            const fragment = current.sections[sectionIndex].fragments[itemIndex];
                            fragment.enabled = !fragment.enabled;
                            button.setAttribute("aria-pressed", String(fragment.enabled));
                        });
                        status();
                    });
                    tags.append(button);
                });
                details.append(summary, tags);
                // Initial toggle events are asynchronous: compare before writing
                // so rendering/restoration does not create phantom undo entries.
                details.addEventListener("toggle", () => {
                    if (restoring || removed || !details.isConnected) return;
                    if ((ui().sections?.[key] !== false) === details.open) return;
                    change(() => { ui().sections ??= {}; ui().sections[key] = details.open; });
                });
                wall.append(details);
            });
            if (!state.sections.some(section => section.fragments.length)) {
                const empty = document.createElement("div");
                empty.className = "empty";
                empty.textContent = "Edit text or connect a text node, then click Reload.";
                wall.append(empty);
            }
        } catch (error) { status(error.message, true); }
        wall.scrollTop = scroll;
        sourceLabel();
    }
    function restore() {
        restoring = true;
        try {
            // Copy objects so clones/configure never share mutable UI properties.
            node.properties.tts_ui = readUiSettings(ui());
            const settings = ui();
            textarea.value = settings.draft;
            editor.open = settings.editorOpen !== false;
            $(".maximum").value = settings.maximum;
            status();
            render();
        } finally { restoring = false; }
    }
    function reload() {
        try {
            const { text, warning } = readSourceInfo(node, ui().draft);
            const next = reloadState(text, readState(stateWidget.value));
            change(() => { write(next); ui().loadedText = text; });
            status(warning);
            render();
        } catch (error) { status(error.message, true); }
    }
    $(".reload").addEventListener("click", reload);
    $(".separator").title = "Inserted literally between fragments. If your fragments already end with commas, use a single space here to avoid doubled commas.";
    textarea.addEventListener("input", () => {
        change(() => { ui().draft = textarea.value; });
        sourceLabel();
    });
    editor.addEventListener("toggle", () => {
        if (!restoring && !removed && ui().editorOpen !== editor.open) change(() => { ui().editorOpen = editor.open; });
    });
    $(".maximum").addEventListener("change", event => {
        const value = Number(event.target.value);
        if (!Number.isSafeInteger(value) || value < 0) { event.target.value = ui().maximum; return; }
        change(() => { ui().maximum = value; });
        render();
    });
    for (const [selector, key, property] of [[".separator", "separator", "value"], [".suffix", "suffix", "value"], [".newlines", "use_new_lines", "checked"]]) {
        $(selector).addEventListener(property === "checked" ? "change" : "input", event => {
            try { mutate(state => { state.options[key] = event.target[property]; }); status(); }
            catch (error) { status(error.message, true); }
        });
    }
    for (const event of ["pointerdown", "mousedown", "dblclick", "wheel", "keydown"]) {
        root.addEventListener(event, message => message.stopPropagation());
    }
    const widget = node.addDOMWidget("text_tag_wall", "text_tag_wall", root, {
        serialize: false, hideOnZoom: false, getMinHeight: () => 290,
    });
    widget.serialize = false;
    const chain = (name, callback) => {
        const previous = node[name];
        node[name] = function (...args) {
            const result = previous?.apply(this, args);
            callback(...args);
            return result;
        };
    };
    chain("onConfigure", restore);
    chain("onConnectionsChange", sourceLabel);
    chain("onRemoved", () => { removed = true; root.remove(); });
    node.setSize?.([560, 560]);
    restore();
    return { root, reload, restore };
}
