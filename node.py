"""Stateless concatenation of the exact snapshot selected in the browser."""

import json


DEFAULT_STATE = json.dumps({
    "version": 1,
    "sections": [],
    "options": {"use_new_lines": False, "separator": ", ", "suffix": ""},
}, ensure_ascii=False, separators=(",", ":"))


def decode_escapes(value):
    """Decode only the three documented escapes, once; preserve everything else."""
    result = []
    escapes = {"n": "\n", "t": "\t", "\\": "\\"}
    index = 0
    while index < len(value):
        if value[index] == "\\" and index + 1 < len(value):
            following = value[index + 1]
            if following in escapes:
                result.append(escapes[following])
                index += 2
                continue
        result.append(value[index])
        index += 1
    return "".join(result)


def validate_state(state_json):
    try:
        state = json.loads(state_json)
    except (ValueError, TypeError) as error:
        raise ValueError("Text Tag Selector: invalid state JSON.") from error
    if not isinstance(state, dict) or type(state.get("version")) is not int or state["version"] != 1:
        raise ValueError("Text Tag Selector: unsupported state version (expected 1).")
    sections, options = state.get("sections"), state.get("options")
    if not isinstance(sections, list) or not isinstance(options, dict):
        raise ValueError("Text Tag Selector: sections and options are required.")
    if type(options.get("use_new_lines")) is not bool:
        raise ValueError("Text Tag Selector: use_new_lines must be a boolean.")
    if not all(isinstance(options.get(key), str) for key in ("separator", "suffix")):
        raise ValueError("Text Tag Selector: separator and suffix must be strings.")
    for section in sections:
        if not isinstance(section, dict) or not isinstance(section.get("title"), str):
            raise ValueError("Text Tag Selector: invalid section.")
        if not isinstance(section.get("fragments"), list):
            raise ValueError("Text Tag Selector: section fragments must be a list.")
        for fragment in section["fragments"]:
            if (not isinstance(fragment, dict)
                    or not isinstance(fragment.get("text"), str)
                    or type(fragment.get("enabled")) is not bool):
                raise ValueError("Text Tag Selector: invalid fragment or selection.")
    return state


class TextTagSelector:
    CATEGORY = "Luis/Text"
    FUNCTION = "concatenate"
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    DESCRIPTION = "Select text fragments. Reload imports text; execution uses the saved selection."

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "state_json": ("STRING", {
                    "default": DEFAULT_STATE, "multiline": False,
                    "dynamicPrompts": False,
                }),
            },
            "optional": {
                "source": ("STRING", {
                    "forceInput": True, "lazy": True,
                    "tooltip": "Connect a text source and click Reload. Readable widgets and Crystools concatenation are supported; execution uses the loaded snapshot.",
                }),
            },
        }

    def check_lazy_status(self, state_json, source=None):
        # This link is only read by Reload in the browser. Never request its
        # runtime value, which could differ from the snapshot shown to the user.
        return []

    def concatenate(self, state_json, source=None):
        state = validate_state(state_json)
        selected = [fragment["text"] for section in state["sections"]
                    for fragment in section["fragments"] if fragment["enabled"]]
        if not selected:
            return ("",)
        options = state["options"]
        joiner = decode_escapes(options["separator"]) + ("\n" if options["use_new_lines"] else "")
        return (joiner.join(selected) + decode_escapes(options["suffix"]),)
