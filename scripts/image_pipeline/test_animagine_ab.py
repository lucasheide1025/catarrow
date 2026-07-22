import tempfile
import unittest
from pathlib import Path
from PIL import Image
from .animagine_ab import BATTLE_BASE, BATTLE_MALE_NEGATIVE, MALE_NEGATIVE, SPECS, TRIPTYCH_BASE, WIDTH, HEIGHT, apply_review_decisions, inspect_image, workflow


class AnimagineABTests(unittest.TestCase):
    def test_fixed_seed_pairs(self):
        grouped={}
        for spec in SPECS:
            if spec["variant"].startswith("v2-") or spec["variant"].startswith("female-"):
                grouped.setdefault(spec["subject"],set()).add(spec["seed"])
        self.assertEqual({len(seeds) for seeds in grouped.values()},{1})

    def test_native_workflow_settings(self):
        result=workflow("test",123,"test")
        self.assertEqual(result["3"]["inputs"]["steps"],28)
        self.assertEqual(result["5"]["inputs"]["width"],WIDTH)
        self.assertNotIn("IPAdapter",json_types(result))

    def test_triptych_shares_seed_and_style_base(self):
        triptych=[spec for spec in SPECS if spec["variant"] in {"triptych-male","triptych-female","triptych-beast"}]
        self.assertEqual(len(triptych),3)
        self.assertEqual(len({spec["seed"] for spec in triptych}),1)
        self.assertTrue(all(spec["prompt"].startswith(TRIPTYCH_BASE) for spec in triptych))

    def test_male_fixes_force_gender_tags_and_negative(self):
        fixes=[spec for spec in SPECS if spec["variant"].startswith("triptych-male-fix-")]
        required="1boy, solo, male focus, adult man, masculine, handsome mature male face, broad shoulders, flat chest, narrow hips, short silver hair"
        self.assertEqual(len(fixes),2)
        self.assertTrue(all(spec["prompt"].startswith(required) for spec in fixes))
        self.assertTrue(all(spec["negative_prompt"]==MALE_NEGATIVE for spec in fixes))
        self.assertEqual(len({spec["seed"] for spec in fixes}),2)

    def test_battle_triptych_profile_contract(self):
        battle=[spec for spec in SPECS if spec.get("profile")=="battle-semi-chibi"]
        self.assertEqual(len(battle),3)
        self.assertEqual({(spec["width"],spec["height"]) for spec in battle},{(1024,1024)})
        self.assertEqual(len({spec["seed"] for spec in battle}),1)
        self.assertTrue(all(BATTLE_BASE in spec["prompt"] for spec in battle))
        male=next(spec for spec in battle if spec["subject"]=="ghost_t1_normal_a")
        self.assertEqual(male["negative_prompt"],BATTLE_MALE_NEGATIVE)
        self.assertTrue(all("identity_lineage" in spec for spec in battle))

    def test_image_check(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/"test.webp"; Image.new("RGB",(WIDTH,HEIGHT)).save(path,"WEBP")
            self.assertTrue(inspect_image(path,(WIDTH,HEIGHT))["passed"])

    def test_canonical_review_preserves_lineage(self):
        manifest={"checkpoint":"model.safetensors","checkpoint_sha256":"abc","workflow_version":"v1","jobs":[{"key":"ghost_t1_normal_b_a","prompt_id":"pid","raw_output":"raw.webp","raw_checks":{"sha256":"hash"}}]}
        apply_review_decisions(manifest)
        job=manifest["jobs"][0]
        self.assertEqual(job["review"]["classification"],"prior-direction-test")
        self.assertEqual(job["source_lineage"]["raw_sha256"],"hash")


def json_types(value):
    if isinstance(value,dict): return " ".join([str(value.get("class_type",""))]+[json_types(v) for v in value.values()])
    if isinstance(value,list): return " ".join(json_types(v) for v in value)
    return ""


if __name__=="__main__": unittest.main()
