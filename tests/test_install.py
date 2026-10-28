"""Exercise the exact Colab cell against a local Git remote, without Colab/GPU."""

from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class InstallerTests(unittest.TestCase):
    def git(self, *args):
        return subprocess.check_output(["git", *map(str, args)], text=True, stderr=subprocess.PIPE)

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        self.remote = self.base / "remote.git"
        self.author = self.base / "author"
        self.comfy = self.base / "ComfyUI"
        self.comfy.mkdir()
        (self.comfy / "main.py").touch()
        self.git("init", "--bare", self.remote)
        self.git("init", "-b", "main", self.author)
        self.git("-C", self.author, "config", "user.name", "Install Test")
        self.git("-C", self.author, "config", "user.email", "test@example.invalid")
        (self.author / "__init__.py").write_text("# test fixture\n", encoding="utf-8")
        self.git("-C", self.author, "add", ".")
        self.git("-C", self.author, "commit", "-m", "Initial test fixture")
        self.git("-C", self.author, "remote", "add", "origin", self.remote)
        self.git("-C", self.author, "push", "origin", "main")
        self.node_dir = self.comfy / "custom_nodes" / "ComfyUI-TextTagSelector"
        self.source = (ROOT / "examples" / "colab_install.py").read_text(encoding="utf-8")
        self.source = self.source.replace(
            '"https://github.com/daneelolivaw2020/ComfyUI-TextTagSelector.git"', repr(str(self.remote)))
        self.source = self.source.replace('Path("/content/ComfyUI")', f"Path({str(self.comfy)!r})")

    def run_cell(self):
        exec(compile(self.source, "colab_install.py", "exec"), {})

    def test_first_install_and_subsequent_update(self):
        self.run_cell()
        self.assertTrue((self.node_dir / "__init__.py").is_file())
        (self.author / "new-file.txt").write_text("updated", encoding="utf-8")
        self.git("-C", self.author, "add", ".")
        self.git("-C", self.author, "commit", "-m", "Update fixture")
        self.git("-C", self.author, "push", "origin", "main")
        self.run_cell()
        self.assertEqual((self.node_dir / "new-file.txt").read_text(), "updated")
        self.assertEqual(self.git("-C", self.node_dir, "rev-parse", "HEAD"),
                         self.git("-C", self.author, "rev-parse", "HEAD"))

    def test_local_changes_are_preserved(self):
        self.run_cell()
        (self.node_dir / "__init__.py").write_text("# personal change\n", encoding="utf-8")
        with self.assertRaisesRegex(RuntimeError, "local changes"):
            self.run_cell()
        self.assertEqual((self.node_dir / "__init__.py").read_text(), "# personal change\n")

    def test_missing_comfyui_and_unmanaged_folder_are_rejected(self):
        (self.comfy / "main.py").unlink()
        with self.assertRaises(FileNotFoundError):
            self.run_cell()
        (self.comfy / "main.py").touch()
        self.node_dir.mkdir(parents=True)
        with self.assertRaisesRegex(RuntimeError, "not a Git repository"):
            self.run_cell()

    def test_other_branch_or_detached_head_is_not_updated(self):
        self.run_cell()
        self.git("-C", self.node_dir, "checkout", "-b", "personal-experiment")
        with self.assertRaisesRegex(RuntimeError, "main"):
            self.run_cell()
        self.assertEqual(self.git("-C", self.node_dir, "branch", "--show-current").strip(), "personal-experiment")
        self.git("-C", self.node_dir, "checkout", "--detach")
        before = self.git("-C", self.node_dir, "rev-parse", "HEAD")
        with self.assertRaisesRegex(RuntimeError, "main"):
            self.run_cell()
        self.assertEqual(self.git("-C", self.node_dir, "rev-parse", "HEAD"), before)
