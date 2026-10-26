import copy
import importlib.util
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("tag_selector_node", ROOT / "node.py")
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


def snapshot(texts=("Blonde", "Blue hair", "Smiling"), **options):
    state = json.loads(module.DEFAULT_STATE)
    state["sections"] = [{"title": "General", "fragments": [
        {"text": text, "enabled": True} for text in texts
    ]}]
    state["options"].update(options)
    return state


class ConcatenationTests(unittest.TestCase):
    def output(self, state, **kwargs):
        return module.TextTagSelector().concatenate(json.dumps(state), **kwargs)[0]

    def test_documented_examples(self):
        self.assertEqual(self.output(snapshot(suffix=".")), "Blonde, Blue hair, Smiling.")
        self.assertEqual(self.output(snapshot(separator=",", use_new_lines=True, suffix=".")),
                         "Blonde,\nBlue hair,\nSmiling.")
        self.assertEqual(self.output(snapshot(separator="")), "BlondeBlue hairSmiling")

    def test_unselected_and_empty_suppress_suffix(self):
        state = snapshot(suffix=".")
        for item in state["sections"][0]["fragments"]:
            item["enabled"] = False
        self.assertEqual(self.output(state), "")
        self.assertEqual(self.output(snapshot(texts=(), suffix="!")), "")

    def test_unicode_whitespace_and_duplicates_are_literal(self):
        self.assertEqual(self.output(snapshot(("  café, 👩🏽‍🚀  ", "é", "é"), separator="|")),
                         "  café, 👩🏽‍🚀  |é|é")

    def test_escapes_are_decoded_once_and_only_in_options(self):
        state = snapshot((r"literal\ntext", "next"), separator=r"\n\t", suffix=r"\\n\q" + "\\")
        self.assertEqual(self.output(state), "literal\\ntext\n\tnext\\n\\q\\")

    def test_suffix_once_and_no_trailing_separator(self):
        self.assertEqual(self.output(snapshot(("one",), separator=",", suffix=".")), "one.")

    def test_fragments_with_commas_use_literal_separator_without_emitting_titles(self):
        state = snapshot(("20 years old,",))
        state["sections"][0]["title"] = "Age"
        state["sections"].append({"title": "Gender", "fragments": [{"text": "woman,", "enabled": True}]})
        self.assertEqual(self.output(state), "20 years old,, woman,")
        state["options"]["separator"] = " "
        self.assertEqual(self.output(state), "20 years old, woman,")

    def test_external_runtime_value_never_overrides_snapshot(self):
        self.assertEqual(self.output(snapshot(("loaded",)), source="new external text"), "loaded")
        node = module.TextTagSelector()
        self.assertEqual(node.check_lazy_status(module.DEFAULT_STATE, None), [])
        self.assertTrue(node.INPUT_TYPES()["optional"]["source"][1]["lazy"])

    def test_selection_changes_change_execution_payload_and_output(self):
        first = snapshot(("A", "B"))
        first["sections"][0]["fragments"][1]["enabled"] = False
        second = copy.deepcopy(first)
        second["sections"][0]["fragments"][0]["enabled"] = False
        second["sections"][0]["fragments"][1]["enabled"] = True
        self.assertNotEqual(json.dumps(first), json.dumps(second))
        self.assertEqual(self.output(first), "A")
        self.assertEqual(self.output(second), "B")

    def test_section_order_and_independent_json_roundtrip(self):
        original = snapshot(("first",))
        original["sections"].append({"title": "Other", "fragments": [{"text": "last", "enabled": True}]})
        restored = json.loads(json.dumps(original))
        self.assertEqual(self.output(restored), "first, last")
        restored["sections"][0]["fragments"][0]["enabled"] = False
        self.assertEqual(self.output(original), "first, last")
        self.assertEqual(self.output(restored), "last")

    def test_corrupt_state_and_unsupported_versions_fail(self):
        for raw in ("not json", "null", "[]", '{"version":2}', '{"version":true}'):
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                module.TextTagSelector().concatenate(raw)
        for mutate in (
            lambda state: state.update(sections=None),
            lambda state: state["options"].update(use_new_lines="false"),
            lambda state: state["options"].update(separator=None),
            lambda state: state["sections"][0]["fragments"][0].update(enabled=1),
            lambda state: state["sections"][0].update(title=None),
        ):
            state = snapshot()
            mutate(state)
            with self.assertRaises(ValueError):
                self.output(state)

    def test_comfyui_extension_import_without_extra_dependencies(self):
        spec = importlib.util.spec_from_file_location("tag_selector_extension", ROOT / "__init__.py",
                                                     submodule_search_locations=[str(ROOT)])
        extension = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = extension
        spec.loader.exec_module(extension)
        self.assertIn("TextTagSelector", extension.NODE_CLASS_MAPPINGS)
        self.assertTrue((ROOT / extension.WEB_DIRECTORY / "extension.js").is_file())


if __name__ == "__main__":
    unittest.main()
