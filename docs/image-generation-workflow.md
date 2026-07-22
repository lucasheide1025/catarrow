# Character image generation workflow

Character artwork is an explicitly approved, manual GPT escalation workflow. It is not a product runtime API and is not an automatic fallback from local generation.

## Boundary

- A user approves the exact character or batch before GPT image generation.
- Codex's built-in image generator is an interactive authoring tool. Browser code, Firebase Functions, build scripts, and maintenance scripts must not claim they can call it.
- Every generated image remains under `.staging/image-generation/` until visual approval. Staging is excluded from Git and Vercel.
- Promotion into `public/` is a separate, explicit action with reference and regression validation.
- Existing images are never removed merely because their generator was retired.

## Per-batch manifest

Store `manifest.json` beside the staged images. Each asset record must contain:

- stable asset/monster ID and profile (`card`, `battle`, or another approved profile);
- provider boundary (`manual-codex-built-in-imagegen`) and tool mode (`interactive`, never `runtime`);
- final prompt and reference-image lineage;
- generated source path and staged relative output path;
- byte size, SHA-256, pixel dimensions, format, and alpha/chroma-key state;
- review decision and timestamp;
- identity-consistency notes for card/battle pairs.

The manifest records provenance; it does not grant permission to promote an image. Run the staging validator before review:

```powershell
node scripts/validate-gpt-image-staging.mjs .staging/image-generation/<batch>/manifest.json
```

## Safety invariants

- Output paths must resolve inside `.staging/image-generation/`.
- The validator is read-only and never calls OpenAI, Gemini, ComfyUI, Firebase, or Vercel.
- Prompts, manifests, and validation do not expose a hidden runtime provider or API key.
- Card images contain no frame, text, or UI. Battle variants preserve the approved card identity and remain staged until separately reviewed.
