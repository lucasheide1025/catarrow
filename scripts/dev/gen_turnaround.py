# -*- coding: utf-8 -*-
"""Generate 8-direction turnaround: each direction uses that direction's own
reference view (cropped from the GPT reference sheet) as IPAdapter reference."""
import json, time, urllib.request, urllib.error, os, shutil, sys

API = "http://127.0.0.1:8188"
INPUT_DIR = r"E:\AI\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable\ComfyUI\input"
OUTPUT_DIR = r"E:\AI\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable\ComfyUI\output"
VIEWS = os.path.abspath("public/assets/shop/dev/views2")

# 2.5D 俯視八方位（上/右上/右/右下/下/左下/左/左上 = n/ne/e/se/s/sw/w/nw）
DIRECTIONS = [
    ("nw",  "facing up-left (northwest), seen from behind-left angle"),
    ("n",   "facing up (north), seen from behind at an angle, showing the back"),
    ("ne",  "facing up-right (northeast), seen from behind-right angle"),
    ("w",   "facing left (west), side view"),
    ("e",   "facing right (east), side view"),
    ("sw",  "facing down-left (southwest), seen from front-left angle"),
    ("s",   "facing down (south), front view"),
    ("se",  "facing down-right (southeast), seen from front-right angle"),
]

POS = ("orange tabby cat shopkeeper character, full body, standing upright on two legs, "
       "straight posture, feet planted on the ground, 2.5D top-down game sprite, "
       "cute chibi style, soft 3D render, polished game asset, warm colors, "
       "plain clean background, no floor, no platform, {dir}, centered, high quality")
NEG = ("multiple views, character sheet, grid, labels, text, watermark, deformed, "
       "extra limbs, blurry, low quality, cropped, sitting, crouching, squatting, "
       "lying down, floating in air, bent legs, contorted pose, no feet")

def post_prompt(workflow):
    data = json.dumps({"prompt": workflow}).encode()
    req = urllib.request.Request(API + "/prompt", data=data,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)

def history(pid):
    with urllib.request.urlopen(API + "/history/" + pid, timeout=30) as r:
        return json.load(r)

def make_workflow(name, dir_desc):
    wf = {}
    n = 0
    def add(node_type, inputs):
        nonlocal n
        n += 1
        wf[str(n)] = {"class_type": node_type, "inputs": inputs}
        return str(n)
    ckpt = add("CheckpointLoaderSimple", {"ckpt_name": "DreamShaper_8_pruned.safetensors"})
    pos = add("CLIPTextEncode", {"text": POS.replace("{dir}", dir_desc),
                                 "clip": [ckpt, 1]})
    neg = add("CLIPTextEncode", {"text": NEG, "clip": [ckpt, 1]})
    latent = add("EmptyLatentImage", {"width": 512, "height": 512, "batch_size": 1})
    ip_mod = add("IPAdapterModelLoader", {"ipadapter_file": "ip-adapter-plus_sd15.safetensors"})
    clipv = add("CLIPVisionLoader", {"clip_name": "CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors"})
    img = add("LoadImage", {"image": f"ref_{name}.png"})
    ipa = add("IPAdapterAdvanced", {
        "model": [ckpt, 0], "ipadapter": [ip_mod, 0], "image": [img, 0],
        "weight": 0.85, "weight_type": "linear", "combine_embeds": "concat",
        "embeds_scaling": "V only",
        "start_at": 0.0, "end_at": 1.0, "clip_vision": [clipv, 0]})
    ksam = add("KSampler", {
        "model": [ipa, 0], "seed": 42, "steps": 28, "cfg": 7.0,
        "sampler_name": "dpmpp_2m", "scheduler": "karras", "denoise": 1.0,
        "positive": [pos, 0], "negative": [neg, 0], "latent_image": [latent, 0]})
    vae = add("VAEDecode", {"samples": [ksam, 0], "vae": [ckpt, 2]})
    add("SaveImage", {"images": [vae, 0], "filename_prefix": f"turn_{name}"})
    return wf

def main():
    # 1. copy reference crops into ComfyUI input dir
    for name, _ in DIRECTIONS:
        src = os.path.join(VIEWS, f"ref_{name}.png")
        dst = os.path.join(INPUT_DIR, f"ref_{name}.png")
        if os.path.exists(src):
            shutil.copy(src, dst)
        else:
            print("MISSING REF:", src); sys.exit(1)
    print("references copied:", len(DIRECTIONS))

    # 2. submit all 8
    ids = {}
    for name, desc in DIRECTIONS:
        wf = make_workflow(name, desc)
        try:
            r = post_prompt(wf)
            ids[name] = r["prompt_id"]
            print(f"submitted {name} -> {r['prompt_id'][:8]}")
        except urllib.error.HTTPError as e:
            print(f"FAIL submit {name}: {e.read().decode()[:300]}")
            return
        time.sleep(0.5)

    # 3. poll until all done
    deadline = time.time() + 420
    done = {}
    while time.time() < deadline and len(done) < len(ids):
        time.sleep(4)
        for name, pid in ids.items():
            if name in done:
                continue
            h = history(pid)
            if pid in h and h[pid].get("status", {}).get("completed"):
                outs = []
                for oid, o in h[pid]["outputs"].items():
                    if "images" in o:
                        outs += [im["filename"] for im in o["images"]]
                done[name] = outs
                print(f"DONE {name}: {outs}")
        if len(done) < len(ids):
            print(f"  ... {len(done)}/{len(ids)} done")

    if len(done) < len(ids):
        print("TIMEOUT, missing:", [n for n in ids if n not in done])
    else:
        print("ALL DONE")
        # copy outputs to project
        dest = os.path.abspath("public/assets/shop/dev/turnaround_2d5d")
        os.makedirs(dest, exist_ok=True)
        for name, files in done.items():
            for f in files:
                src = os.path.join(OUTPUT_DIR, f)
                if os.path.exists(src):
                    shutil.copy(src, os.path.join(dest, f))
                    print("copied", f)

if __name__ == "__main__":
    main()
