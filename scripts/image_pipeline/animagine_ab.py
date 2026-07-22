import argparse
import hashlib
import html
import io
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw

try:
    from .comfy_client import ComfyClient
except ImportError:
    import importlib.util
    _spec = importlib.util.spec_from_file_location("comfy_client", Path(__file__).with_name("comfy_client.py"))
    _module = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(_module)
    ComfyClient = _module.ComfyClient

CHECKPOINT = "animagine-xl-4.0-opt.safetensors"
MODEL_SHA256 = "6327eca98bfb6538dd7a4edce22484a1bbc57a8cff6b11d075d40da1afb847ac"
WORKFLOW_VERSION = "animagine-xl-4-opt-native-sdxl-ab-v1"
WIDTH, HEIGHT = 832, 1216
TRIPTYCH_BASE = ("premium Japanese fantasy RPG, highly refined anime semi-painterly illustration, intricate clean linework, "
                  "deep indigo, midnight blue, violet, silver-black color palette, pale cyan ghost light, ornate gothic spirit lantern, "
                  "one faceted blue-violet soul crystal, pointed silver filigree, star-speckled spectral fabric, a few translucent violet-blue spirit ribbons, "
                  "solid detailed body with selective incorporeal edges, tier one with only one main lantern, one soul crystal, minimal silver ornaments and spirit ribbons, "
                  "maximum face, hair, fur, material and rendering refinement, full body centered, isolated on simple neutral pale background, ")
BATTLE_BASE = ("premium Japanese fantasy RPG 2D battle character, highly refined anime semi-painterly, intricate clean linework, "
               "semi-chibi exactly 4.5 heads tall, slightly enlarged readable head and hands and key prop, compact body, dynamic ready-for-battle three-quarter pose, "
               "strong separated silhouette, full body, feet visible and aligned, simple neutral isolated background, minimal effects, deep indigo, violet, silver-black, "
               "pale cyan ghost light, one gothic spirit lantern, one blue-violet soul crystal, minimal pointed silver filigree, one spectral ribbon, ")
NEGATIVE = ("lowres, bad anatomy, bad hands, text, error, missing finger, extra digits, fewer digits, cropped, "
            "worst quality, low quality, low score, bad score, average score, signature, watermark, username, blurry, "
            "photorealistic, 3d, chibi, child, weapon, bow, arrow, frame, card, ui, multiple characters, gore, blood, "
            "ice mage, ice magic, wizard, wizard robe, mage robe, modern trench coat, modern fashion, elaborate hand pose, gripping, "
            "wings, horn, horns, antlers, dragon, eastern dragon, feline, cat, dog, fox, flame ears")
MALE_NEGATIVE = NEGATIVE + ", 1girl, woman, female, feminine, breasts, cleavage, dress, skirt, long hair, bridal, gown"
BATTLE_NEGATIVE = ("lowres, worst quality, low quality, bad anatomy, bad hands, extra fingers, missing fingers, extra limbs, duplicate, multiple characters, "
                   "text, letters, watermark, logo, frame, card, ui, photorealistic, 3d, 2 heads tall, super deformed, baby, toddler, realistic adult proportions, "
                   "cropped feet, hidden feet, floating feet, misaligned feet, busy background, excessive effects, gore, blood")
BATTLE_MALE_NEGATIVE = BATTLE_NEGATIVE + ", 1girl, woman, female, feminine, breasts, cleavage, dress, skirt, long hair, bridal, gown"

SPECS = [
    {"key":"ghost_t1_normal_a_a","subject":"ghost_t1_normal_a","variant":"A","seed":420001,
     "prompt":"1boy, solo, adult man, mature handsome face, full body, 7 heads tall, standing naturally, arms relaxed, hands mostly hidden by cloak folds, silver hair, cool blue layered traveler clothes, long cloak, floating blue spirit lanterns at his side, ghostly translucent cloth edges, twilight ancient road, misty stone bridge, japanese fantasy rpg character illustration, clean lineart, detailed anime shading, blue silver color palette, simple composition, masterpiece, high score, great score, absurdres"},
    {"key":"ghost_t1_normal_a_b","subject":"ghost_t1_normal_a","variant":"B","seed":420001,
     "prompt":"1boy, solo, adult man, mature elegant face, full body, 7 heads tall, three-quarter view, one hand under cloak, other hand resting beside a floating lantern without gripping it, silver hair, navy traveling coat, pale blue scarf, spectral lantern guide, dusk fog, old stone path, japanese rpg concept art, 2d anime illustration, refined linework, cel painterly shading, cool blue and warm lantern gold, clear silhouette, masterpiece, high score, great score, absurdres"},
    {"key":"ghost_t1_normal_b_a","subject":"ghost_t1_normal_b","variant":"A","seed":420002,
     "prompt":"no humans, solo creature, quadruped ghost beast, elegant medium-sized fantasy animal, deep navy soft fur, glowing star mist woven through fur, long flowing tail, luminous pale blue eyes, four clearly separated legs, standing naturally, night sky ruins, japanese fantasy rpg monster illustration, clean silhouette, detailed anime shading, blue silver palette, mysterious but friendly, not cute mascot, masterpiece, high score, great score, absurdres"},
    {"key":"ghost_t1_normal_b_b","subject":"ghost_t1_normal_b","variant":"B","seed":420002,
     "prompt":"no humans, solo creature, quadruped spectral beast, graceful wolf-cat fantasy anatomy, dark blue velvet fur, constellation markings, starry vapor mane and tail, four visible paws, calm side-facing pose, ancient ruins beneath stars, japanese rpg bestiary art, 2d anime illustration, refined lineart, painterly cel shading, cool blue moonlight, approachable and mysterious, clear silhouette, masterpiece, high score, great score, absurdres"},
    {"key":"ghost_t1_normal_a_v2_a","subject":"ghost_t1_normal_a","variant":"v2-A","seed":420101,
     "prompt":"1boy, solo, adult man, handsome mature face, calm guide expression, full body, 6.5 heads tall, silver hair, elegant old european fantasy travel coat, fitted short coat with waistcoat and capelet, historical fantasy traveler, blue-gray and silver color palette, one floating ghost lantern clearly beside his shoulder, lantern hovering without being held, arms resting naturally, hands relaxed and mostly obscured by coat, subtle translucent ghost hem, simple tier one character design, isolated character, simple pale warm gray studio background, japanese fantasy rpg 2d character illustration, refined clean lineart, detailed anime shading, balanced silhouette, masterpiece, high score, great score, absurdres"},
    {"key":"ghost_t1_normal_a_v2_b","subject":"ghost_t1_normal_a","variant":"v2-B","seed":420101,
     "prompt":"1boy, solo, mature handsome silver-haired male spirit guide, full body, 7 heads tall, gentle three-quarter standing pose, elegant old european fantasy traveling coat, tailored blue-gray coat, silver clasps, layered waistcoat, short shoulder mantle, one pale blue spectral lantern floating clearly near his open relaxed hand without contact, simple natural hands, faint transparent cloth at lower coat hem, calm dependable guide, modest tier one details, isolated on plain light neutral background, japanese rpg character concept art, 2d anime illustration, crisp linework, painterly cel shading, masterpiece, high score, great score, absurdres"},
    {"key":"ghost_t1_normal_b_v2_a","subject":"ghost_t1_normal_b","variant":"v2-A","seed":420102,
     "prompt":"no humans, solo creature, original quadruped mammalian spirit beast, compact elegant body, four grounded legs, gentle unfamiliar face, rounded short muzzle, deep navy soft fur, sparse tiny star-like markings, pale blue mist tail, subtle spectral paws, no recognizable real animal species, simple tier one silhouette, isolated creature, plain pale neutral studio background, japanese fantasy rpg 2d monster design, clean refined lineart, detailed anime shading, mysterious and gentle, masterpiece, high score, great score, absurdres"},
    {"key":"ghost_t1_normal_b_v2_b","subject":"ghost_t1_normal_b","variant":"v2-B","seed":420102,
     "prompt":"no humans, solo creature, unique four-legged mammalian ghost beast, compact graceful torso, soft deep navy plush fur, calm gentle face with small rounded ears, subtle constellation speckles, one flowing translucent mist tail, simple paws and clean silhouette, fantasy species without cat dog fox or dragon traits, understated tier one design, isolated on simple warm light gray background, japanese rpg bestiary concept art, 2d anime illustration, precise lineart, soft cel painterly lighting, masterpiece, high score, great score, absurdres"},
    {"key":"ghost_1_v1_a","subject":"ghost_1","variant":"female-A","seed":420201,
     "prompt":"1girl, solo, adult woman, beautiful mature noble face, calm expression, full body, 6.5 heads tall, long silver-white hair, elegant classical ballroom-inspired spirit dress, refined layered blue-gray and silver gown, moonlight accents, one floating silver hand mirror clearly beside her shoulder without being held, relaxed arms, hands mostly concealed by dress folds, subtle translucent ghost dress hem, simple tier one character design, isolated character, simple pale neutral studio background, japanese fantasy rpg 2d character illustration, refined clean lineart, detailed anime shading, clear silhouette, masterpiece, high score, great score, absurdres"},
    {"key":"ghost_1_v1_b","subject":"ghost_1","variant":"female-B","seed":420201,
     "prompt":"1girl, solo, mature beautiful silver-white-haired female spirit, calm noble expression, full body, 7 heads tall, elegant old european ballroom-inspired spectral dress, blue-gray silk and silver moonlit embroidery, modest tier one ornament, a small silver hand mirror floating independently beside her open relaxed hand with no grip, simple natural pose, faint transparent skirt hem, isolated on plain pale warm gray background, japanese rpg character concept art, 2d anime illustration, crisp linework, painterly cel shading, masterpiece, high score, great score, absurdres"},
    {"key":"ghost_t1_triptych_male_v1","subject":"ghost_t1_normal_a","variant":"triptych-male","seed":421001,
     "prompt":TRIPTYCH_BASE + "1boy, solo, adult handsome mature male spirit guide, silver hair, calm noble face, 7 heads tall, tailored silver-black fantasy armor panels over an elegant midnight-blue travel coat, short starry cape, one gothic cyan spirit lantern floating beside shoulder without hand grip, simple relaxed pose, Dusk-Lantern Traveler, masterpiece, high score, great score, absurdres"},
    {"key":"ghost_t1_triptych_female_v1","subject":"ghost_1","variant":"triptych-female","seed":421001,
     "prompt":TRIPTYCH_BASE + "1girl, solo, adult beautiful mature female ghost noble, long silver-white hair, calm elegant face, 7 heads tall, refined ballroom-inspired deep indigo spirit dress with precise silver filigree and star-speckled fabric, one small silver hand mirror floating independently beside shoulder, one gothic cyan spirit lantern, simple relaxed hands, Mirror-Veil Princess, masterpiece, high score, great score, absurdres"},
    {"key":"ghost_t1_triptych_beast_v1","subject":"ghost_t1_normal_b","variant":"triptych-beast","seed":421001,
     "prompt":TRIPTYCH_BASE + "no humans, solo creature, elegant original eastern-inspired quadruped spirit beast silhouette, solid graceful mammalian body, luxurious white and deep navy fur rendered strand by strand, calm intelligent face, blue-violet crystal armor accents, pale cyan soul flame, one gothic lantern floating beside body, selective spectral ribbon tail, four clear legs, Star-Mist Fur Beast, masterpiece, high score, great score, absurdres"},
    {"key":"ghost_t1_triptych_male_fix_a","subject":"ghost_t1_normal_a","variant":"triptych-male-fix-A","seed":421101,"negative_prompt":MALE_NEGATIVE,
     "prompt":"1boy, solo, male focus, adult man, masculine, handsome mature male face, broad shoulders, flat chest, narrow hips, short silver hair, " + TRIPTYCH_BASE + "Dusk-Lantern Traveler, complete tailored masculine travel coat with light silver-black armor, deep indigo fitted trousers, sturdy boots, one ornate gothic ghost lantern floating beside shoulder without hand grip, one blue-violet soul crystal at chest, minimal pointed silver filigree, a few spectral ribbons, calm male guide, masterpiece, high score, great score, absurdres"},
    {"key":"ghost_t1_triptych_male_fix_b","subject":"ghost_t1_normal_a","variant":"triptych-male-fix-B","seed":421102,"negative_prompt":MALE_NEGATIVE,
     "prompt":"1boy, solo, male focus, adult man, masculine, handsome mature male face, broad shoulders, flat chest, narrow hips, short silver hair, " + TRIPTYCH_BASE + "Dusk-Lantern Traveler, masculine old-european fantasy traveling coat, silver-black light cuirass and shoulder guard, midnight-blue trousers and boots, one cyan gothic spirit lantern hovering beside him, one faceted violet soul crystal, restrained silver ornaments and translucent spirit ribbons, composed male wayfinder stance, masterpiece, high score, great score, absurdres"},
    {"key":"ghost_t1_battle_male_v1","subject":"ghost_t1_normal_a","variant":"battle-semi-chibi-male","profile":"battle-semi-chibi","seed":422001,"width":1024,"height":1024,"negative_prompt":BATTLE_MALE_NEGATIVE,
     "identity_lineage":{"basis_key":"ghost_t1_triptych_male_fix_b","basis_prompt_id":"13d2cf0f-2452-4e8e-9087-2a30b95ece37"},
     "prompt":"1boy, solo, male focus, adult man, masculine, handsome masculine face, flat chest, short silver hair, " + BATTLE_BASE + "Dusk-Lantern Traveler, dark indigo and silver armor-coat, one cyan gothic lantern floating beside him, one chest soul crystal, one translucent ribbon, alert casting stance with simple open hand, mature male semi-chibi proportions, masterpiece, high score, great score, absurdres"},
    {"key":"ghost_t1_battle_female_v1","subject":"ghost_1","variant":"battle-semi-chibi-female","profile":"battle-semi-chibi","seed":422001,"width":1024,"height":1024,"negative_prompt":BATTLE_NEGATIVE + ", child, little girl, loli, juvenile, baby face",
     "identity_lineage":{"basis_key":"ghost_t1_triptych_female_v1","basis_prompt_id":"26e2791c-7d60-4472-8f21-71b0858ad5d0"},
     "prompt":"1girl, solo, adult woman, mature recognizable elegant attractive female face, long silver-white hair, " + BATTLE_BASE + "Mirror-Veil Princess, dark indigo layered spirit dress with tasteful sensual silhouette, minimal silver ornament, one silver mirror and cyan lantern floating together as one key prop, one soul crystal, one spectral ribbon, graceful casting stance, mature woman semi-chibi proportions, masterpiece, high score, great score, absurdres"},
    {"key":"ghost_t1_battle_beast_v1","subject":"ghost_t1_normal_b","variant":"battle-semi-chibi-beast","profile":"battle-semi-chibi","seed":422001,"width":1024,"height":1024,"negative_prompt":BATTLE_NEGATIVE + ", human, humanoid, cute pet, puppy, pony, plush toy, wings, horns, dragon",
     "identity_lineage":{"basis_key":"ghost_t1_triptych_beast_v1","basis_prompt_id":"aad37028-d730-40c9-82b1-e034a6ced886"},
     "prompt":"no humans, solo creature, horse-like ghost beast species and head silhouette, dark indigo spectral horse body, cyan glowing mane, " + BATTLE_BASE + "Star-Mist Fur Beast, horse head enlarged about twenty percent, compact strong equine body but not a baby pet, four aligned horse legs, one floating gothic lantern, one chest soul crystal, one spectral ribbon tail, alert stepping battle pose, masterpiece, high score, great score, absurdres"},
]

V1_KEYS = {"ghost_t1_normal_a_a", "ghost_t1_normal_a_b", "ghost_t1_normal_b_a", "ghost_t1_normal_b_b"}
CANONICAL_CANDIDATES = {
    "ghost_t1_normal_b_a": "User approved Star-Mist Fur Beast V1-A as the beast canonical candidate.",
    "ghost_t1_normal_a_v2_b": "User approved Dusk-Lantern Traveler V2-B as the male canonical candidate.",
}
TRIPTYCH_KEYS = {"ghost_t1_triptych_male_v1", "ghost_t1_triptych_female_v1", "ghost_t1_triptych_beast_v1"}
MALE_FIX_KEYS = {"ghost_t1_triptych_male_fix_a", "ghost_t1_triptych_male_fix_b"}
BATTLE_KEYS = {"ghost_t1_battle_male_v1", "ghost_t1_battle_female_v1", "ghost_t1_battle_beast_v1"}


def workflow(prompt, seed, prefix, negative=NEGATIVE, width=WIDTH, height=HEIGHT):
    return {
      "3":{"class_type":"KSampler","inputs":{"seed":seed,"steps":28,"cfg":5.0,"sampler_name":"euler_ancestral","scheduler":"normal","denoise":1.0,"model":["4",0],"positive":["6",0],"negative":["7",0],"latent_image":["5",0]}},
      "4":{"class_type":"CheckpointLoaderSimple","inputs":{"ckpt_name":CHECKPOINT}},
      "5":{"class_type":"EmptyLatentImage","inputs":{"width":width,"height":height,"batch_size":1}},
      "6":{"class_type":"CLIPTextEncode","inputs":{"text":prompt,"clip":["4",1]}},
      "7":{"class_type":"CLIPTextEncode","inputs":{"text":negative,"clip":["4",1]}},
      "8":{"class_type":"VAEDecode","inputs":{"samples":["3",0],"vae":["4",2]}},
      "9":{"class_type":"SaveImage","inputs":{"filename_prefix":prefix,"images":["8",0]}},
    }


def save_json(path, value):
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)


def inspect_image(path, expected_size, alpha_required=False):
    with Image.open(path) as image:
        image.load(); rgba=image.convert("RGBA"); alpha=rgba.getchannel("A").getextrema()
        result={"format":image.format,"mode":image.mode,"width":image.width,"height":image.height,"bytes":path.stat().st_size,
                "sha256":hashlib.sha256(path.read_bytes()).hexdigest(),"alpha_range":list(alpha)}
        result["passed"]=(image.format=="WEBP" and image.size==expected_size and (not alpha_required or alpha[0]<255))
        return result


def postprocess(raw_path, output_path):
    from rembg import remove
    with Image.open(raw_path) as source: cut=remove(source.convert("RGBA")).convert("RGBA")
    bbox=cut.getbbox()
    if not bbox: raise RuntimeError("rembg produced an empty image")
    cut=cut.crop(bbox); cut.thumbnail((768,1152),Image.Resampling.LANCZOS)
    canvas=Image.new("RGBA",(WIDTH,HEIGHT),(0,0,0,0)); canvas.alpha_composite(cut,((WIDTH-cut.width)//2,(HEIGHT-cut.height)//2))
    canvas.save(output_path,"WEBP",quality=92,method=6)


def apply_review_decisions(manifest):
    for job in manifest["jobs"]:
        if job["key"] == "ghost_t1_triptych_female_v1":
            job["review"]={"decision":"approved","classification":"triptych-style-baseline","reason":"User approved the refined female ghost-family base style; mildly sensual presentation is acceptable."}
        elif job["key"] == "ghost_t1_triptych_beast_v1":
            job["review"]={"decision":"approved","classification":"triptych-style-baseline","reason":"User approved the beast base style and accepts ghost-horse/non-humanoid family variation."}
        elif job["key"] == "ghost_t1_triptych_male_v1":
            job["review"]={"decision":"rejected","classification":"gender-drift","reason":"Rejected because the male prompt generated a female-presenting character."}
        elif job["key"] not in MALE_FIX_KEYS | BATTLE_KEYS:
            if job["key"] in CANONICAL_CANDIDATES and not job.get("source_lineage"):
                job["source_lineage"]={"prompt_id":job.get("prompt_id"),"raw_output":job.get("raw_output"),"raw_sha256":job.get("raw_checks",{}).get("sha256"),"checkpoint":manifest.get("checkpoint"),"checkpoint_sha256":manifest.get("checkpoint_sha256"),"workflow_version":manifest.get("workflow_version")}
            if job.get("review",{}).get("decision") != "superseded": job["previous_review"]=job.get("review")
            job["review"]={"decision":"superseded","classification":"prior-direction-test","reason":"Superseded by the approved refined ghost-family style-DNA triptych direction; retained as staging evidence and lineage only."}
        if job["key"] in TRIPTYCH_KEYS and not job.get("source_lineage"):
            job["source_lineage"]={"prompt_id":job.get("prompt_id"),"raw_output":job.get("raw_output"),"raw_sha256":job.get("raw_checks",{}).get("sha256"),"checkpoint":manifest.get("checkpoint"),"checkpoint_sha256":manifest.get("checkpoint_sha256"),"workflow_version":manifest.get("workflow_version")}


def review(root, manifest):
    jobs=[job for job in manifest["jobs"] if job.get("raw_output")]
    sheet=Image.new("RGB",(900,max(500,len(jobs)*340)),"#151522"); draw=ImageDraw.Draw(sheet)
    rows=[]
    for index,job in enumerate(jobs):
        shown=job.get("transparent_output") or job["raw_output"]
        image=Image.open(root/shown).convert("RGB"); image.thumbnail((300,320)); y=index*340+5
        decision=job.get("review",{}).get("decision","pending")
        sheet.paste(image,(10+(300-image.width)//2,y)); draw.text((330,y+10),f'{job["key"]} | seed {job["seed"]} | {decision.upper()}',fill="#ff7373" if decision=="rejected" else "white")
        rows.append(f'<article><img src="{html.escape(shown)}"><h2>{html.escape(job["key"])}</h2><pre>{html.escape(json.dumps(job,ensure_ascii=False,indent=2))}</pre></article>')
    sheet.save(root/"contact-sheet.webp","WEBP",quality=90)
    (root/"review.html").write_text('<!doctype html><meta charset="utf-8"><title>Animagine A/B</title><style>body{background:#111;color:#eee;font-family:sans-serif}main{display:grid;grid-template-columns:repeat(2,minmax(320px,1fr));gap:20px}img{max-width:100%;max-height:700px}pre{white-space:pre-wrap}</style><h1>Animagine XL 4.0 Opt — A/B review</h1><main>'+"".join(rows)+"</main>",encoding="utf-8")


def generate(root, timeout):
    root.mkdir(parents=True,exist_ok=True); manifest_path=root/"manifest.json"; client=ComfyClient()
    manifest=json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {"schema_version":1,"workflow_version":WORKFLOW_VERSION,"checkpoint":CHECKPOINT,"checkpoint_sha256":MODEL_SHA256,"license":"CreativeML Open RAIL++-M","endpoint":"http://127.0.0.1:8188","created_at":datetime.now(timezone.utc).isoformat(),"jobs":[]}
    manifest["preflight"]=client.preflight(CHECKPOINT)
    manifest["generation_mode"]={"kind":"prompt-only-baseline","ip_adapter_used":False,"reference_images_sent_to_model":False,"reason":"No approved and compatibility-verified IP-Adapter is available; references were inspected locally and translated into a shared prompt style DNA without installing or upgrading nodes.","human_inspected_references":["build/cards/monsters/ghost_t2_mini_a.webp","build/cards/monsters/ghost_t2_normal_b.webp","build/cards/monsters/ghost_t5_normal_a.webp"]}
    apply_review_decisions(manifest)
    by_key={job["key"]:job for job in manifest["jobs"]}; save_json(manifest_path,manifest); review(root,manifest)
    for spec in SPECS:
        job=by_key.get(spec["key"]) or {**spec,"negative_prompt":spec.get("negative_prompt",NEGATIVE),"sampler":"euler_ancestral","scheduler":"normal","steps":28,"cfg":5.0,"width":spec.get("width",WIDTH),"height":spec.get("height",HEIGHT),"status":"pending"}
        if spec["key"] not in by_key: manifest["jobs"].append(job)
        if job.get("raw_output") and (root/job["raw_output"]).exists(): continue
        started=time.monotonic(); job["submitted_at"]=datetime.now(timezone.utc).isoformat(); job["status"]="queued"; save_json(manifest_path,manifest)
        try:
            job["prompt_id"]=client.submit(workflow(job["prompt"],job["seed"],f"catarrow_animagine_ab/{job['key']}",job["negative_prompt"],job["width"],job["height"])); job["status"]="running"; save_json(manifest_path,manifest)
            history,diagnostics=client.wait(job["prompt_id"],timeout=timeout,diagnostics_every=15); descriptor=history["outputs"]["9"]["images"][0]
            raw=root/f'{job["key"]}.raw.webp'; raw.write_bytes(client.image(descriptor)); Image.open(raw).convert("RGB").save(raw,"WEBP",quality=92,method=6)
            job["source_descriptor"]=descriptor; job["raw_output"]=raw.name; job["raw_checks"]=inspect_image(raw,(job["width"],job["height"])); job["diagnostics"]=diagnostics; job["status"]="generated"
        except Exception as error: job["status"]="failed"; job["error"]={"type":type(error).__name__,"message":str(error)}
        job["diffusion_seconds"]=round(time.monotonic()-started,2); save_json(manifest_path,manifest); review(root,manifest)
    manifest["generation_finished_at"]=datetime.now(timezone.utc).isoformat(); save_json(manifest_path,manifest); review(root,manifest)


def process(root, selected_keys=None, timeout=300):
    manifest_path=root/"manifest.json"; manifest=json.loads(manifest_path.read_text(encoding="utf-8"))
    apply_review_decisions(manifest); save_json(manifest_path,manifest); review(root,manifest)
    for job in manifest["jobs"]:
        if selected_keys and job["key"] not in selected_keys: continue
        if not job.get("raw_output") or job.get("transparent_output"): continue
        output=root/f'{job["key"]}.transparent.webp'; started=time.monotonic(); job["postprocess_status"]="running"; save_json(manifest_path,manifest)
        try:
            subprocess.run([sys.executable,str(Path(__file__).resolve()),"--rembg-worker",str(root/job["raw_output"]),str(output)],check=True,timeout=timeout)
            job["transparent_output"]=output.name; job["transparent_checks"]=inspect_image(output,(WIDTH,HEIGHT),True); job["postprocess_status"]="completed"
            if not job["transparent_checks"]["passed"]: raise RuntimeError("Transparent output validation failed")
        except subprocess.TimeoutExpired as error:
            job["postprocess_status"]="failed"; job["postprocess_error"]={"type":"TimeoutExpired","message":f"rembg exceeded strict {timeout}s timeout; diffusion was not rerun"}
        except Exception as error: job["postprocess_status"]="failed"; job["postprocess_error"]={"type":type(error).__name__,"message":str(error)}
        job["postprocess_seconds"]=round(time.monotonic()-started,2); save_json(manifest_path,manifest); review(root,manifest)
    manifest["postprocess_finished_at"]=datetime.now(timezone.utc).isoformat(); save_json(manifest_path,manifest); review(root,manifest)


if __name__=="__main__":
    parser=argparse.ArgumentParser(); parser.add_argument("--output",default=".staging/image-generation/animagine-xl-4-opt-ab"); parser.add_argument("--timeout",type=int,default=900); parser.add_argument("--postprocess-only",action="store_true"); parser.add_argument("--postprocess-key",action="append"); parser.add_argument("--postprocess-timeout",type=int,default=300); parser.add_argument("--skip-postprocess",action="store_true"); parser.add_argument("--rembg-worker",nargs=2,metavar=("RAW","OUTPUT")); args=parser.parse_args(); root=Path(args.output).resolve()
    if args.rembg_worker:
        postprocess(Path(args.rembg_worker[0]),Path(args.rembg_worker[1])); sys.exit(0)
    if not args.postprocess_only: generate(root,args.timeout)
    if not args.skip_postprocess: process(root,set(args.postprocess_key or []),args.postprocess_timeout)
