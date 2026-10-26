"""ComfyUI Text Tag Selector extension."""

from .node import TextTagSelector

NODE_CLASS_MAPPINGS = {"TextTagSelector": TextTagSelector}
NODE_DISPLAY_NAME_MAPPINGS = {"TextTagSelector": "Text Tag Selector"}
WEB_DIRECTORY = "./web"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
