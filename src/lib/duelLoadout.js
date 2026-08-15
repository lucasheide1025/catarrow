// src/lib/duelLoadout.js — 決鬥玩家負載：卡片天賦＋裝備專精 → mods（進房時快照）
// 快照後存進房間成員資料，host 結算回合時直接用快照的 mods，
// 不需要在 host 端重讀每個玩家的 Firestore。
import { buildCombatModifiers, describeModifiers } from "./combatModifiers";
import { calcCardCombatEffectsFromCollection } from "./cardTalents";
import { getEquipSpecializations, toEquipSpecSlots } from "./equipSpecializationDb";
import { refreshCardCollection } from "./db";
import { SPECIALIZATION_TRACKS } from "./equipmentSpecializationCatalog";

const TRACK_NAMES = Object.fromEntries(SPECIALIZATION_TRACKS.map(t => [t.id, t.name]));

/**
 * 讀取玩家當下的卡片收藏＋裝備專精，組出決鬥要用的 mods 與顯示摘要。
 * @returns {{ mods: object|null, loadout: {cards, specLabels, rows, hasAnything}|null }}
 */
export async function buildDuelLoadout(memberId) {
  if (!memberId) return { mods: null, loadout: null };
  try {
    let collection = { cards: {}, wbCards: {}, equipped: [] };
    await refreshCardCollection(memberId, coll => { collection = coll; });
    const spec = await getEquipSpecializations(memberId);
    const equipSpec = toEquipSpecSlots(spec);
    const cardFx = calcCardCombatEffectsFromCollection(collection, { enemyClass: "player" });
    const mods = buildCombatModifiers({ cardFx, equipSpec });
    const specLabels = Object.entries(equipSpec)
      .filter(([, s]) => s && s.trackId)
      .map(([slot, s]) => ({
        trackId: s.trackId, slot,
        label: TRACK_NAMES[s.trackId] || s.trackId,
        level: s.level,
      }));
    const rows = describeModifiers(mods);
    const cards = (collection.equipped || []).length;
    return {
      mods,
      loadout: { cards, specLabels, rows, hasAnything: cards > 0 || specLabels.length > 0 },
    };
  } catch (e) {
    return { mods: null, loadout: null };
  }
}
