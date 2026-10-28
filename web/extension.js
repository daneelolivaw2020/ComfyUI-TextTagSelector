import { app } from "../../scripts/app.js";
import { attachSelector } from "./selector.js?v=0.1.2";

app.registerExtension({
    name: "Luis.TextTagSelector",
    nodeCreated(node) {
        if (node.comfyClass === "TextTagSelector") attachSelector(node);
    },
});
