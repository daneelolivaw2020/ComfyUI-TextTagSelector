/* Real DOM/CSS and Python handoff test in a mock ComfyUI widget host.
 * Does not replace integration testing in the actual ComfyUI frontend.
 * Requires Playwright + Chromium and TTS_PYTHON (or python on PATH).
 */
const { chromium } = require("playwright");
const { createServer } = require("node:http");
const { readFile, mkdir, writeFile } = require("node:fs/promises");
const path = require("node:path");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");

const harness = `<!doctype html><html><head><meta charset="utf-8"><style>
body{background:#141820;color:#fff;font-family:system-ui}.host{width:560px;height:560px;resize:both;overflow:hidden;display:inline-block;margin:12px;vertical-align:top}
</style></head><body><script type="module">
import { attachSelector } from '/web/selector.js';
import { emptyState } from '/web/state.js';
window.makeNode = function(saved) {
    const host = document.createElement('div'); host.className='host'; document.body.append(host);
    const widget = {name:'state_json', value:JSON.stringify(emptyState()), options:{}};
    const node = {widgets:[widget], inputs:[{name:'source',link:null}], properties:{}, size:[560,560],
        graph:{links:{}, beforeChange(){},afterChange(){},change(){}},
        setDirtyCanvas(){},setSize(size){this.size=size},
        addDOMWidget(name,type,element,options){host.append(element);const widget={name,type,options};this.widgets.push(widget);return widget}
    };
    const selector=attachSelector(node);
    if(saved){node.properties=structuredClone(saved.properties); widget.value=saved.state; node.onConfigure()}
    return {node,widget,selector,host,save(){return {state:widget.value, properties:structuredClone(node.properties), size:node.size}}};
};
window.fixture=window.makeNode(); window.ready=true;
</script></body></html>`;

(async () => {
    const server = createServer(async (req, res) => {
        try {
            const pathname = new URL(req.url, "http://localhost").pathname;
            if (pathname === "/") { res.setHeader("Content-Type", "text/html"); res.end(harness); return; }
            if (!/^\/web\/[a-z_]+\.js$/.test(pathname)) { res.writeHead(404); res.end(); return; }
            res.setHeader("Content-Type", "application/javascript");
            res.end(await readFile(path.join(root, pathname)));
        } catch (error) { res.writeHead(500); res.end(String(error)); }
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    let browser;
    try {
        browser = await chromium.launch({ headless: true, ...(process.env.TTS_CHROMIUM ? {executablePath:process.env.TTS_CHROMIUM} : {}) });
        const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.goto(`http://127.0.0.1:${server.address().port}/`);
        await page.waitForFunction(() => window.ready);
        const first = page.locator(".host").first();
        await first.getByRole("textbox", {name:"Source text"}).fill("--- Hair\nBlonde\nBlue hair\n--- Scene\n" + "Long detailed description ".repeat(15));
        await first.getByRole("button", {name:"Reload",exact:true}).click();
        assert.equal(await first.locator(".tag").count(), 3);
        const sizes = await first.locator(".tag").evaluateAll(tags => tags.map(tag => ({width:tag.getBoundingClientRect().width, top:tag.getBoundingClientRect().top, parent:tag.parentElement.getBoundingClientRect().width})));
        assert.ok(sizes[0].width < 120, "short tag keeps its natural width");
        assert.equal(sizes[0].top, sizes[1].top, "short tags share a horizontal row");
        assert.ok(sizes.every(size => size.width <= size.parent + 1), "tags fit available width");
        await first.getByRole("button", {name:"Blonde",exact:true}).click();
        await first.getByRole("button", {name:"Blue hair",exact:true}).click();
        await first.getByLabel("Separator", {exact:true}).fill(",");
        await first.getByLabel("Suffix", {exact:true}).fill(".");
        await first.getByLabel("Use new lines", {exact:true}).check();
        // Blur text fields to commit the same change event as the live controls.
        await first.getByLabel("Maximum characters").click();
        const snapshot = await page.evaluate(() => fixture.widget.value);
        const python = spawnSync(process.env.TTS_PYTHON || "python", ["-c",
            "import sys; from node import TextTagSelector; print(TextTagSelector().concatenate(sys.stdin.read())[0], end='')"],
            {cwd:root,input:snapshot,encoding:"utf8"});
        assert.equal(python.status, 0, python.stderr);
        assert.equal(python.stdout.replace(/\r\n/g,"\n"), "Blonde,\nBlue hair.");

        await first.getByRole("textbox", {name:"Source text"}).fill("new draft");
        assert.equal(await page.evaluate(() => fixture.widget.value), snapshot, "draft editing cannot change loaded execution state");
        await first.locator(".editor summary").click();
        await page.waitForFunction(() => fixture.node.properties.tts_ui.editorOpen === false);
        await page.evaluate(() => { window.saved=fixture.save(); window.clone=makeNode(saved); });
        const clone = page.locator(".host").nth(1);
        assert.equal(await clone.locator('.tag[aria-pressed="true"]').count(), 2);
        assert.equal(await clone.locator(".editor").evaluate(el => el.open), false);
        await clone.getByRole("button", {name:"Blonde",exact:true}).click();
        assert.equal(await page.evaluate(() => fixture.widget.value), snapshot, "clone does not share state with original");

        await page.evaluate(() => {
            fixture.node.inputs[0].link=9;
            fixture.node.graph.links[9]={origin_id:1,origin_slot:0};
            window.originNode={comfyClass:'PrimitiveStringMultiline',inputs:[],widgets:[{name:'value',value:'--- External\\nA\\nA\\nB'.replaceAll('\\n','\n')}]};
            fixture.node.graph.getNodeById=()=>originNode;
            fixture.node.onConnectionsChange();
        });
        await first.getByRole("button", {name:"Reload",exact:true}).click();
        assert.equal(await first.locator(".tag").count(), 3);
        await first.getByRole("button", {name:"A",exact:true}).first().click();
        const connectedSnapshot = await page.evaluate(() => fixture.widget.value);
        await page.evaluate(() => { originNode.widgets[0].value='Unloaded replacement'; });
        assert.equal(await page.evaluate(() => fixture.widget.value), connectedSnapshot);
        await page.evaluate(() => { originNode.comfyClass='UnsupportedNode'; });
        await first.getByRole("button", {name:"Reload",exact:true}).click();
        assert.equal(await page.evaluate(() => fixture.widget.value), connectedSnapshot, "failed Reload preserves state");
        assert.match(await first.getByRole("status").textContent(), /direct connection/);

        await page.evaluate(() => {
            originNode.comfyClass='PrimitiveStringMultiline';
            originNode.widgets[0].value=Array.from({length:200},(_,i)=>'Tag '+i+' '+('x'.repeat(i%5*24))).join('\n');
        });
        await first.getByRole("button", {name:"Reload",exact:true}).click();
        assert.equal(await first.locator(".tag").count(), 200);
        await first.evaluate(host => {host.style.width='340px';host.style.height='400px'});
        const layout = await first.locator(".wall").evaluate(wall => ({scroll:wall.scrollHeight,height:wall.clientHeight,overflows:[...wall.querySelectorAll('.tag')].some(tag=>tag.getBoundingClientRect().width>tag.parentElement.getBoundingClientRect().width+1)}));
        assert.ok(layout.scroll > layout.height, "many tags scroll inside fixed available height");
        assert.equal(layout.overflows, false);
        await mkdir(path.join(root,".test-runtime"), {recursive:true});
        await page.screenshot({path:path.join(root,".test-runtime","selector-smoke.png")});
        await writeFile(path.join(root,".test-runtime","browser-snapshot.json"), snapshot);
        assert.deepEqual(errors, []);
        console.log("Browser smoke passed: horizontal wrap, truncation, Python handoff, restore/clone, native Reload/error retention, 200-tag scroll.");
    } finally {
        await browser?.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => {console.error(error);process.exitCode=1});
