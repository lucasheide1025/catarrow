# Phase A：鬼怪族 T1 普通角色卡圖 v1

## Execution

- Provider: Codex built-in image generator
- Mode: generate with one local T6 style/quality reference per character
- Generated source directory: `C:\Users\broud\.codex\generated_images\019f9ef7-82cc-7242-84f1-8058fb9f0cf6`
- Workspace staging: `.staging/image-generation/gpt-ghost-t1/cards/`
- Output dimensions: 1086×1448 PNG (3:4)
- Formal `public/` assets were not modified.

## Outputs

| Character | Generated source | Staging file | SHA-256 |
|---|---|---|---|
| 暮燈旅者 | `call_qQcBk2v4u8sIvQ7WAPQKxFxS.png` | `ghost-t1-normal-a-card-gpt-v1.png` | `188BF7705DA10DCE67AEE6AA45A40E6797152AB33309A740C3CC97987A9A1D4A` |
| 鏡幕幽姬 | `call_Efl5iaSIFvxUUOVfanGKmTvu.png` | `ghost-1-card-gpt-v1.png` | `F5C891B61879C6D033E303F1615608D753CE4821174623F302B51B40C1A0D93D` |
| 星霧絨獸 | `call_oeZYlbBWe40qQMFA43MXqvUO.png` | `ghost-t1-normal-b-card-gpt-v1.png` | `8DE77CAB6D37388DA36B8CBFF65CEE87840B6A1944229EBC8A08CAC0F14649B6` |

Contact sheet: `.staging/image-generation/gpt-ghost-t1/cards/ghost-t1-normal-card-contact-sheet-v1.png`

## Prompt Set

All three prompts used:

- `Use case: stylized-concept`
- `Asset type: portrait 3:4 mobile fantasy RPG collectible card scene art`
- The corresponding approved T6 card was labeled as a style/quality reference only.
- Shared style: high-detail Japanese fantasy RPG, 2D anime semi-painterly, polished face/fur/linework/coloring quality.
- Shared T1 rule: 1–2 main colors, simple ordinary materials, one small signature element, faint unstable soul fire or mist.
- Shared exclusions: T6 mythic armor and grandeur, crown, giant artifact, dense crystals, huge aura, dense particles, photorealism, 3D, figurine, chibi, horror, gore, text, card border, UI, stars, watermark.

Character-specific prompt content:

### 暮燈旅者

- Handsome adult male ghost guide, mature 6–7-head proportion, short silver-gray hair, calm lonely expression.
- Simple single-layer old-European traveler clothing in navy and gray-silver: fitted shirt, modest short coat, trousers, worn boots and cloth belt.
- One small floating pale-blue ghost lantern; thin mist near lantern and coat hem.
- Quiet misty stone bridge at dusk with sparse old roadside stones.

### 鏡幕幽姬

- Elegant adult female ghost, mature 6–7-head proportion, long silver-white hair, composed wistful expression.
- Simple single-layer classical spirit dress in mist violet and gray-silver, ordinary soft fabric and minimal trim.
- One small floating mist-silver hand mirror; faint reflection shimmer and thin mist.
- Moonlit mirror corridor connected to a faded abandoned ballroom.

### 星霧絨獸

- Small-to-medium newly formed quadruped ghost beast; original fantasy species explicitly not horse, deer, wolf, fox, dog, cat or human hybrid.
- Compact body, rounded paws, deep navy fur, expressive fin-like spirit tufts, short muzzle, cyan eyes, small mist-tail.
- No clothing, rider, armor, jewelry, carried object, antlers, horns, halo rings or wings.
- Simple night-sky ruins with sparse grass and low broken stones.

## Initial Review

- 暮燈旅者: T1 restraint is clear; simple clothing and signature lantern read well.
- 鏡幕幽姬: character density is T1; environment architecture is the richest of the three and should be judged by the user.
- 星霧絨獸: distinct from T6 horse/deer anatomy, clear quadruped silhouette, slightly cute but not chibi.

## v2 Simplicity Revision

User feedback: v1 was still too ornate for T1. Built-in image edit mode was used with each v1 file as the edit target. Character identity, face/fur quality, palette and 3:4 composition were locked; only scene scale, clothing construction, signature-object scale and magic density were reduced.

| Character | Generated source | Staging file | SHA-256 |
|---|---|---|---|
| 暮燈旅者 | `call_EUkJY14zNehUfimy66sWhCzK.png` | `ghost-t1-normal-a-card-gpt-v2.png` | `F44DD542EF8E4AB30216696D8BEDD4F8537351F48CC4775E6FA9844370434800` |
| 鏡幕幽姬 | `call_SnYj1hGLnEVcfMN9aQsSPWvL.png` | `ghost-1-card-gpt-v2.png` | `A776FB9AD51B02F14B40FE7D9B877AE4E6E191A1E7D8A65E5759CC0285E4C9A4` |
| 星霧絨獸 | `call_odj5qCQP9CMvMm2qdMF33Ad9.png` | `ghost-t1-normal-b-card-gpt-v2.png` | `C76AAC017BA5E8CBA4BB972774FE3181CAB7FEB41C833651E02CB85E939876AB` |

Contact sheet: `.staging/image-generation/gpt-ghost-t1/cards/ghost-t1-normal-card-contact-sheet-v2.png`

Revision prompt set:

- 暮燈旅者: grand cemetery → empty rural stone footbridge; ordinary intact short coat; smaller common iron lantern; magic reduced about 60%.
- 鏡幕幽姬: gothic palace → neglected plain room; single-layer ordinary-cloth ankle dress; plain small mirror; magic and reflections reduced about 65%.
- 星霧絨獸: cosmic ruins → small broken-stone patch; far fewer stars; smaller weak spirit tail; simpler two-to-three fur fins; magic reduced about 70%.

User approved all three v2 normal-character cards as the T1 male/female/beast visual baseline.

## T1 Leader Card Candidates v1

Built-in image generation used two references per character: the approved same-type T1 v2 card for simplicity/density and the corresponding T6 identity image for series/identity guidance only.

| Character | Generated source | Staging file | SHA-256 |
|---|---|---|---|
| 蒼焰巡獵者 | `call_HJdtdppTskAhy5AWlq648Jpx.png` | `ghost-t1-mini-a-card-gpt-v1.png` | `934A5A3888C70765D0D5212A3E7BA1ED948F4D319253B63BA10F4F7E17FCB54C` |
| 霧紗影舞者 | `call_wSFRnpLdbC2ViaCzaoMY9eui.png` | `ghost-t1-mini-b-card-gpt-v1.png` | `D34BE905E501BE433489D31D82185091416A53799B954E9B5375EB99C7F6379A` |
| 星環冥鹿 | `call_uYDzruofwo2Z9Gua44Wjc85t.png` | `ghost-t1-boss-card-gpt-v1.png` | `A7BE4E5921B54F107AFA6CB14381F255531C28804E68312D2B3B513CC3B29A60` |

Leader contact sheet: `.staging/image-generation/gpt-ghost-t1/cards/ghost-t1-leader-card-contact-sheet-v1.png`

Full six-card contact sheet: `.staging/image-generation/gpt-ghost-t1/cards/ghost-t1-all-card-contact-sheet-v1.png`

Prompt set:

- 蒼焰巡獵者: ordinary field coat, cloth satchel, one small brass compass, one weak blue trail flame, sparse moor path; about 15% denser than the normal male.
- 霧紗影舞者: plain practice dress, small ankle bells, one or two faint footprints, neglected rehearsal room; about 15% denser than the normal female.
- 星環冥鹿: young lean deer, small budding translucent antlers, one thin imperfect ring, small clearing; about 25% denser than the normal beast.

User approved the complete six-card T1 set.

## T1 Battle Candidates v1

Each approved card was used as the sole identity reference for one built-in image-generation call. Sources were generated on a flat green chroma background, copied to staging, then processed with the installed imagegen helper:

```text
remove_chroma_key.py --auto-key border --soft-matte
  --transparent-threshold 12 --opaque-threshold 220 --despill
```

Green-screen masters:

```text
.staging/image-generation/gpt-ghost-t1/battle/chroma/
```

Transparent candidates:

```text
.staging/image-generation/gpt-ghost-t1/battle/alpha/
```

| Stable ID | Generated source | Transparent SHA-256 |
|---|---|---|
| `ghost_t1_normal_a` | `call_EpE1AwMzZQrs7VhtzmMBk951.png` | `630BED10FA3C9908DC11857ABE95657518352377BBCCCE375C663F4DDA5EC34D` |
| `ghost_1` | `call_iKCEltAItDNuFx2q18VJHBvJ.png` | `67A3BEE407176EFC4F7BD0883E443ED3FFD468524F8EFA7132EAA177A913A7A8` |
| `ghost_t1_normal_b` | `call_IRnYq0fAU0ZbuJbBeAVswHbm.png` | `B563E717330878AC5D0E2BC54CA7DFD2D718D681F2BACA0AF512CED980B1B6D8` |
| `ghost_t1_mini_a` | `call_rOTiMIObhXwKAmqBaLxrY8Lt.png` | `319A7EB278793EE6027175C979605BC6D436652746DA6E51EE3D571ED44A92A1` |
| `ghost_t1_mini_b` | `call_BSLAKXub2ztrxfcIlhNeGHsg.png` | `07E84F485E9F265FEA9FA8B8CF32E65B8A296AEA835EA1A6055F1FB5D8DC5FE4` |
| `ghost_t1_boss` | `call_yUdM665qFshvV1H0ju6MnZso.png` | `A064FBCEC2D5CFE947F21836152A74522EA75184DA3902ED48823AE3EE4F1F40` |

Contact sheet:

```text
.staging/image-generation/gpt-ghost-t1/battle/ghost-t1-battle-alpha-contact-sheet-v1.png
```

Validation:

- all six outputs have alpha;
- all four corners are fully transparent;
- full bodies, limbs, props, antlers and effects remain inside the canvas;
- no solid chroma background remains;
- identity, clothing/species, palette and T1 simplicity match the approved card references.
