import tempfile
import unittest
from pathlib import Path
from PIL import Image
from .comfy_client import ComfyClient
from .pilot import STAGING_ROOT, safe_output_root, validate, workflow, workflow_sha256


class PilotTests(unittest.TestCase):
    def test_rejects_non_local_endpoint(self):
        with self.assertRaises(ValueError): ComfyClient("https://example.com")

    def test_transparent_validation(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/"asset.webp"; image=Image.new("RGBA",(512,512),(0,0,0,0)); image.putpixel((256,256),(255,0,0,255)); image.save(path,"WEBP",lossless=True)
            result=validate(path,(512,512),True)
            self.assertTrue(result["passed"]); self.assertEqual(len(result["sha256"]),64)

    def test_dimension_failure(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/"bad.webp"; Image.new("RGB",(10,10)).save(path,"WEBP")
            self.assertFalse(validate(path,(768,1024))["passed"])

    def test_output_must_remain_in_ignored_staging(self):
        self.assertEqual(safe_output_root(STAGING_ROOT / "pilot-test"), STAGING_ROOT / "pilot-test")
        with self.assertRaises(ValueError):
            safe_output_root(Path("public") / "assets" / "pilot-test")

    def test_workflow_hash_is_deterministic_and_sensitive(self):
        first = workflow("prompt", 42, 768, 1024, "pilot/key")
        same = workflow("prompt", 42, 768, 1024, "pilot/key")
        changed = workflow("prompt", 43, 768, 1024, "pilot/key")
        self.assertEqual(workflow_sha256(first), workflow_sha256(same))
        self.assertNotEqual(workflow_sha256(first), workflow_sha256(changed))
        self.assertEqual(len(workflow_sha256(first)), 64)


if __name__ == "__main__": unittest.main()
