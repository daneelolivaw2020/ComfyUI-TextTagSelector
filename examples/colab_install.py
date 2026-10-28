# Paste into one cell AFTER installing ComfyUI and BEFORE starting it.
from pathlib import Path
import subprocess

REPO = "https://github.com/daneelolivaw2020/ComfyUI-TextTagSelector.git"
COMFYUI_DIR = Path("/content/ComfyUI")
NODE_DIR = COMFYUI_DIR / "custom_nodes" / "ComfyUI-TextTagSelector"

if not (COMFYUI_DIR / "main.py").is_file():
    raise FileNotFoundError("Install ComfyUI first or correct COMFYUI_DIR.")

if NODE_DIR.exists():
    if not (NODE_DIR / ".git").is_dir():
        raise RuntimeError(f"Folder exists but is not a Git repository: {NODE_DIR}")
    remote = subprocess.check_output(
        ["git", "-C", str(NODE_DIR), "remote", "get-url", "origin"], text=True
    ).strip()
    if remote.rstrip("/").removesuffix(".git") != REPO.removesuffix(".git"):
        raise RuntimeError("The existing folder belongs to a different repository.")
    branch = subprocess.run(
        ["git", "-C", str(NODE_DIR), "symbolic-ref", "--quiet", "--short", "HEAD"],
        capture_output=True, text=True,
    )
    if branch.returncode != 0 or branch.stdout.strip() != "main":
        raise RuntimeError("The node is not on main. Switch to main explicitly before updating; the current checkout was preserved.")
    changes = subprocess.check_output(
        ["git", "-C", str(NODE_DIR), "status", "--porcelain"], text=True
    )
    if changes.strip():
        raise RuntimeError("The node has local changes. They will not be overwritten.")
    subprocess.run(["git", "-C", str(NODE_DIR), "pull", "--ff-only", "origin", "main"], check=True)
else:
    NODE_DIR.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["git", "clone", "--branch", "main", REPO, str(NODE_DIR)], check=True)

commit = subprocess.check_output(
    ["git", "-C", str(NODE_DIR), "rev-parse", "--short", "HEAD"], text=True
).strip()
print(f"Text Tag Selector installed: {commit}")
print("Start or restart ComfyUI, refresh its iframe, and search for Text Tag Selector (Luis/Text).")
