# FreeBuff Handoff - 2026-07-12

## Current Deployment

- Production is ready at `https://student.catgroup.com.tw` and `https://catarrow.vercel.app`.
- Vercel deployment must run `npm ci` followed by `npm run build`; these are now explicitly configured in `vercel.json`.
- `.vercelignore` excludes local `.deploy-*` staging folders. Do not remove those ignore entries or Vercel uploads exceed the size limit.

## Single-Player Battle

Primary files:

- `src/components/battle/BattleScreen.jsx`
- `src/components/member/MonsterBattle.jsx`

Completed integration work:

- `MonsterBattle` now enters `BattleScreen` directly. The legacy `battle_intro` transition no longer plays alongside the new screen.
- New battle victory goes straight to loot; it does not remount the old knockdown screen.
- New battle defeat returns to selection instead of opening the legacy result panel.
- A per-battle ref guard prevents duplicate callback handling and duplicate rewards.
- BattleScreen returns rounds, total damage, crits, arrows, and final HP values to the parent callback.
- The parent writes these values into `saveMonsterLog` and creates a corresponding practice log when arrows were submitted.
- Existing rewards remain in the parent flow: archer XP, cat XP/bond, materials, coins, chests, and card drops.
- Loot auto-return was disabled; players must manually leave the claim screen.

Follow-up checks:

- Run a real member battle and confirm exactly one `monsterLogs` entry and one `practiceLogs` entry are created.
- Confirm card drops, material drops, coins, archer XP, and cat XP are each granted once.
- Confirm a loss returns to selection after the new BattleScreen result without a legacy overlay.
- Keep the legacy battle rendering removed from the active `phase === "battle"` path. Do not reintroduce old intro/death effects.

## Home and Hub Art

Completed:

- Homepage status hero and share-card entry live in `MemberHome.jsx`.
- Homepage has four generated background assets under `public/ui/home/`.
- `HubTile` supports an `image` property with a dark readability overlay, `background-size: cover`, and right-aligned focus.
- Adventure has six generated assets in `public/ui/adventure/`, and `MemberAdventureHub.jsx` passes them to `HubTile`.

Pending:

- Finish generated images and wiring for training hub and inventory hub. The planned asset behavior is identical: 16:9 WebP, right-side subject, left-side text safe area, `cover` cropping only.

## Working Tree

- The worktree contains changes from multiple contributors. Do not reset or revert unrelated battle, booking, expedition, or asset files.
- Before a future deploy, run `npm.cmd run build` locally, then deploy the project root with `vercel.cmd deploy . --prod -y --no-wait`.
