import argparse
import hashlib
import html
import io
import json
import multiprocessing
import queue
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw

try:
    from .comfy_client import ComfyClient
except ImportError:  # Support ComfyUI's isolated embedded Python executable.
    import importlib.util
    _spec = importlib.util.spec_from_file_location("comfy_client", Path(__file__).with_name("comfy_client.py"))
    _module = importlib.util.module_from_spec(_spec)
    _spec.loader.exec_module(_module)
    ComfyClient = _module.ComfyClient

CHECKPOINT = "DreamShaperXL_Turbo_v2_1.safetensors"
WORKFLOW_VERSION = "comfy-local-pilot-v1"
REPO_ROOT = Path(__file__).resolve().parents[2]
STAGING_ROOT = (REPO_ROOT / ".staging" / "image-generation").resolve()
NEGATIVE = "low quality, blurry, lowres, deformed, duplicate, text, letters, watermark, logo, ui, frame, cropped head, gore"
COMMON = ("Semi-realistic painterly digital illustration of a game boss character, dark fantasy RPG art style, "
          "dramatic atmospheric lighting, detailed character design with clear silhouette, Taiwanese folklore-inspired, "
          "slightly comedic yet eerie mood, archery-gym game aesthetic, vertical portrait composition, high detail, moody color grading, ")
BOSSES = {
 "ghost_boss_small": "a young female ghost with long messy black hair covering half her face, pale translucent skin with indigo-purple glow, tattered traditional dress, floating with no visible feet, melancholy expression, deep indigo night archery range and mist",
 "forest_boss_small": "a mischievous small mountain goblin fox-like forest spirit covered in moss and vines, glowing green eyes, twisted wooden staff, playful grin, misty looping mountain forest path",
 "poison_boss_small": "a chimeric summer insect creature combining centipede segments and hornet wings, glossy dark carapace, yellow warning stripes, many glowing eyes, translucent wings, comically excessive summer pest",
 "office_boss_small": "an exaggerated angry customer demon in business casual clothes holding endless complaint letters, red angry aura, oversized name tag, pointing forward, satirical corporate hell",
 "exam_boss_small": "a sleep-deprived exam demon with purple dark circles, wrinkled school uniform, floating failed exam papers, giant red pen weapon, exhausted yet menacing, swirling equations",
 "western_boss_small": "a lean feral werewolf pack leader mid transformation, grey-brown fur, green eyes, torn clothes, howling under a full moon, smaller and weaker than an alpha, dark forest",
}
TRANSPARENT = {"transparent_spirit_test": "cute stylized Taiwanese lucky cat spirit figurine, single centered full body character, clear silhouette, no platform, simple dark neutral background, painterly mobile game asset"}


def workflow(prompt, seed, width, height, prefix):
    return {
      "3":{"class_type":"KSampler","inputs":{"seed":seed,"steps":8,"cfg":2.0,"sampler_name":"dpmpp_sde","scheduler":"karras","denoise":1.0,"model":["4",0],"positive":["6",0],"negative":["7",0],"latent_image":["5",0]}},
      "4":{"class_type":"CheckpointLoaderSimple","inputs":{"ckpt_name":CHECKPOINT}},
      "5":{"class_type":"EmptyLatentImage","inputs":{"width":width,"height":height,"batch_size":1}},
      "6":{"class_type":"CLIPTextEncode","inputs":{"text":prompt,"clip":["4",1]}},
      "7":{"class_type":"CLIPTextEncode","inputs":{"text":NEGATIVE,"clip":["4",1]}},
      "8":{"class_type":"VAEDecode","inputs":{"samples":["3",0],"vae":["4",2]}},
      "9":{"class_type":"SaveImage","inputs":{"filename_prefix":prefix,"images":["8",0]}},
    }


def workflow_sha256(value):
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def safe_output_root(value):
    """Resolve an output directory without permitting writes to deployable assets."""
    output = Path(value).resolve()
    if output != STAGING_ROOT and STAGING_ROOT not in output.parents:
        raise ValueError(f"Pilot output must remain under {STAGING_ROOT}")
    return output


def record_reproducibility(job):
    value = workflow(
        job["prompt"], job["seed"], job["width"], job["height"],
        f"catarrow_pilot/{job['key']}",
    )
    job["workflow_sha256"] = workflow_sha256(value)
    job["pipeline_sha256"] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    return value


def atomic_json(path, value):
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    temp.replace(path)


def validate(path, expected, alpha_required=False):
    with Image.open(path) as image:
        image.load()
        result = {"format": image.format, "width": image.width, "height": image.height,
                  "mode": image.mode, "bytes": path.stat().st_size,
                  "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
        result["valid_dimensions"] = image.size == expected
        result["valid_format"] = image.format == "WEBP"
        alpha = image.convert("RGBA").getchannel("A")
        extrema = alpha.getextrema()
        result["alpha_range"] = list(extrema)
        result["valid_alpha"] = (extrema[0] < 255) if alpha_required else True
        result["valid_name"] = path.name.endswith(".webp")
        result["valid_size"] = 0 < result["bytes"] <= 8 * 1024 * 1024
        result["passed"] = all(result[k] for k in ("valid_dimensions","valid_format","valid_alpha","valid_name","valid_size"))
        return result


def _transparent_webp_worker(data, result_queue):
    from rembg import remove
    try:
        source = Image.open(io.BytesIO(data)).convert("RGBA")
        cut = remove(source).convert("RGBA")
        bbox = cut.getbbox()
        if not bbox:
            raise RuntimeError("rembg produced an empty image")
        cut = cut.crop(bbox)
        cut.thumbnail((460, 460), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
        canvas.alpha_composite(cut, ((512-cut.width)//2, (512-cut.height)//2))
        encoded = io.BytesIO()
        canvas.save(encoded, "WEBP", quality=90, method=6)
        result_queue.put(("ok", encoded.getvalue()))
    except Exception as error:
        result_queue.put(("error", type(error).__name__, str(error)))


def transparent_webp(data, output, timeout=180):
    context = multiprocessing.get_context("spawn")
    result_queue = context.Queue(maxsize=1)
    process = context.Process(target=_transparent_webp_worker, args=(data, result_queue))
    process.start()
    try:
        result = result_queue.get(timeout=timeout)
    except queue.Empty as error:
        process.terminate()
        process.join(timeout=5)
        raise TimeoutError(f"rembg post-processing exceeded {timeout} seconds") from error
    finally:
        if process.is_alive():
            process.terminate()
        process.join(timeout=5)
        result_queue.close()
    if result[0] == "error":
        raise RuntimeError(f"rembg failed ({result[1]}): {result[2]}")
    temp = output.with_suffix(output.suffix + ".tmp")
    temp.write_bytes(result[1])
    temp.replace(output)


def build_review(root, manifest):
    completed = [j for j in manifest["jobs"] if j.get("output")]
    thumbs = []
    for job in completed:
        image = Image.open(root / job["output"]).convert("RGB")
        image.thumbnail((240, 240))
        thumbs.append((job["key"], image.copy()))
    sheet = Image.new("RGB", (750, max(300, ((len(thumbs)+2)//3)*290)), "#171721")
    draw = ImageDraw.Draw(sheet)
    for index, (key, image) in enumerate(thumbs):
        x, y = (index % 3)*250+5, (index//3)*290+5
        sheet.paste(image, (x+(240-image.width)//2, y))
        job = next(item for item in completed if item["key"] == key)
        decision = job.get("review", {}).get("decision", "pending")
        draw.text((x+5, y+245), f"{key} [{decision.upper()}]", fill="#ff7373" if decision == "rejected" else "white")
    sheet.save(root / "contact-sheet.webp", "WEBP", quality=88)
    rows = "".join(f'<article><img src="{html.escape(j["output"])}"><h2>{html.escape(j["key"])}</h2><p>Review: {html.escape(j.get("review",{}).get("decision","pending"))}</p><pre>{html.escape(json.dumps({"review":j.get("review",{}),"checks":j.get("checks",{})}, indent=2))}</pre></article>' for j in completed)
    (root / "review.html").write_text(f'<!doctype html><meta charset="utf-8"><title>ComfyUI pilot review</title><style>body{{background:#111;color:#eee;font-family:sans-serif}}main{{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px}}img{{max-width:100%}}pre{{white-space:pre-wrap}}</style><h1>ComfyUI pilot review</h1><main>{rows}</main>', encoding="utf-8")


def summarize_review(manifest):
    decisions = {}
    for job in manifest["jobs"]:
        decision = job.get("review", {}).get("decision", "pending")
        decisions[decision] = decisions.get(decision, 0) + 1
    manifest["review_summary"] = {
        "total": len(manifest["jobs"]),
        "decisions": decisions,
        "accepted_for_publication": sum(
            1 for job in manifest["jobs"]
            if job.get("review", {}).get("decision") == "accepted"
        ),
    }


def run(root, timeout, retries):
    root = safe_output_root(root)
    root.mkdir(parents=True, exist_ok=True)
    client = ComfyClient()
    manifest_path = root / "manifest.json"
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    else:
        manifest = {"schema_version":1,"workflow_version":WORKFLOW_VERSION,"created_at":datetime.now(timezone.utc).isoformat(),"endpoint":"http://127.0.0.1:8188","checkpoint":CHECKPOINT,"jobs":[]}
    manifest["preflight"] = client.preflight(CHECKPOINT)
    existing = {j["key"]:j for j in manifest["jobs"]}
    specs = [(k, COMMON+v, "portrait", 768, 1024) for k,v in BOSSES.items()] + [(k,v,"transparent",1024,1024) for k,v in TRANSPARENT.items()]
    for key, prompt, profile, width, height in specs:
        job = existing.get(key) or {"key":key,"profile":profile,"prompt":prompt,"negative_prompt":NEGATIVE,"seed":random.SystemRandom().randint(1,2**31-1),"checkpoint":CHECKPOINT,"sampler":"dpmpp_sde","scheduler":"karras","steps":8,"cfg":2.0,"width":width,"height":height,"workflow_version":WORKFLOW_VERSION,"attempts":[]}
        if key not in existing: manifest["jobs"].append(job)
        job_workflow = record_reproducibility(job)
        if job.get("status") == "completed" and (root / job["output"]).exists(): continue
        for attempt in range(retries+1):
            try:
                job["status"]="queued"; job["attempts"].append({"started_at":datetime.now(timezone.utc).isoformat()}); atomic_json(manifest_path, manifest)
                prompt_id = client.submit(job_workflow); job["prompt_id"]=prompt_id; job["status"]="running"; atomic_json(manifest_path, manifest)
                history, diagnostics = client.wait(prompt_id, timeout=timeout); descriptor=history["outputs"]["9"]["images"][0]; data=client.image(descriptor)
                output = root / f"{key}.webp"
                if profile == "transparent": transparent_webp(data, output)
                else: Image.open(io.BytesIO(data)).convert("RGB").save(output,"WEBP",quality=90,method=6)
                job["source_descriptor"]=descriptor; job["diagnostics"]=diagnostics; job["output"]=output.name; job["checks"]=validate(output,(512,512) if profile=="transparent" else (width,height),profile=="transparent")
                if not job["checks"]["passed"]: raise RuntimeError(f"Automated checks failed: {job['checks']}")
                job["status"]="completed"; job["completed_at"]=datetime.now(timezone.utc).isoformat(); atomic_json(manifest_path, manifest); break
            except Exception as error:
                job["status"]="failed"; job["error"]={"type":type(error).__name__,"message":str(error)}; job["attempts"][-1]["failed_at"]=datetime.now(timezone.utc).isoformat(); atomic_json(manifest_path, manifest)
                if attempt >= retries: break
        build_review(root, manifest)
    manifest["finished_at"]=datetime.now(timezone.utc).isoformat(); summarize_review(manifest); atomic_json(manifest_path, manifest); build_review(root,manifest)
    return 0 if all(j["status"]=="completed" for j in manifest["jobs"]) else 2


if __name__ == "__main__":
    parser=argparse.ArgumentParser(); parser.add_argument("--output",default=".staging/image-generation/comfyui-pilot"); parser.add_argument("--timeout",type=int,default=600); parser.add_argument("--retries",type=int,default=1); parser.add_argument("--review-only",action="store_true"); args=parser.parse_args()
    output = safe_output_root(args.output)
    if args.review_only:
        manifest_path = output / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        for job in manifest["jobs"]:
            record_reproducibility(job)
        summarize_review(manifest)
        atomic_json(manifest_path, manifest)
        build_review(output, manifest)
        sys.exit(0)
    sys.exit(run(output,args.timeout,args.retries))
