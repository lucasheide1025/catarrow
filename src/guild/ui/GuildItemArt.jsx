const ROOT = "/guild/generated";

const BOWS = ["wood_bow", "iron_bow", "hunter_bow", "long_bow", "short_bow", "horn_bow", "bamboo_bow", "siege_bow", "spirit_bow"];
const ARROWS = ["wood_arrow", "sharp_arrow", "heavy_arrow", "bodkin_arrow", "feather_arrow", "poison_arrow", "blessed_arrow", "fire_arrow"];
const GEAR = [
  "cloth_armor", "leather_armor", "scout_armor", "chain_armor", "plate_armor", "robe_armor", "hide_armor", "fortune_vest",
  "small_quiver", "ranger_quiver", "hunter_quiver", "wide_quiver", "swift_quiver", "gilded_quiver", "war_quiver",
  "potion_pouch_s", "potion_pouch_l", "herb_pouch", "ration_pack", "alchemy_kit", "medic_bag", "waterskin",
];
const GRADES = ["common", "rare", "elite", "fierce", "boss", "mythic"];

// Must stay in the same order as guildJunkCatalog.js / the generated 12x6 atlas.
const JUNK = [
  "rusty_gear","old_map_scrap","bent_nail","cracked_bottle","torn_ledger","monster_fang","brass_key","cracked_lens","silver_thimble","old_pocketwatch","ancient_coin","ivory_dice",
  "sealed_letter","gemstone_shard","gilded_compass","music_box_core","obsidian_mirror","mysterious_relic","dragonbone_flute","astral_fragment","first_guild_seal","copper_wire","chipped_whetstone","faded_ribbon",
  "ghost_incense","ghost_joss_paper","ghost_bell","ghost_red_thread","ghost_spirit_tag","ghost_lantern","ghost_jade_seal","ghost_soul_coin","mtn_pine_resin","mtn_boar_bristle","mtn_river_stone","mtn_eagle_feather",
  "mtn_snake_skin","mtn_bear_claw","mtn_mountain_jade","mtn_ancient_seed","ins_chitin_shard","ins_honeycomb","ins_wing_dust","ins_venom_vial","ins_amber_bug","ins_queen_stinger","ins_hive_crown","ins_god_carapace",
  "wp_stapler","wp_coffee_stain","wp_name_plate","wp_broken_mug","wp_golden_stapler","wp_blank_cheque","wp_ceo_seal","wp_capital_core","ex_red_pen","ex_crumpled_test","ex_lucky_eraser","ex_night_coffee",
  "ex_perfect_paper","ex_admission_tag","ex_scholar_seal","ex_system_core","tp_bone_dust","tp_candle_stub","tp_silver_cross","tp_wolf_pelt","tp_vampire_fang","tp_grimoire_page","tp_lich_crown","tp_dragon_scale",
];

const pos = (index, columns, rows) => `${(index % columns) * 100 / (columns - 1)}% ${Math.floor(index / columns) * 100 / (rows - 1)}%`;

function Sprite({ src, index, columns, rows, size, style }) {
  return <span aria-hidden style={{
    display: "inline-block", width: size, height: size, flex: `0 0 ${size}px`,
    backgroundImage: `url(${src})`, backgroundSize: `${columns * 100}% ${rows * 100}%`,
    backgroundPosition: pos(index, columns, rows), backgroundRepeat: "no-repeat",
    filter: "drop-shadow(0 2px 3px rgba(0,0,0,.5))", ...style,
  }} />;
}

export function GuildEquipmentArt({ archetypeId, grade = "common", size = 64, style }) {
  let src; let index; let columns; let rows;
  if ((index = BOWS.indexOf(archetypeId)) >= 0) [src, columns, rows] = [`${ROOT}/equip-bows.png`, 3, 3];
  else if ((index = ARROWS.indexOf(archetypeId)) >= 0) [src, columns, rows] = [`${ROOT}/equip-arrows.png`, 4, 2];
  else if ((index = GEAR.indexOf(archetypeId)) >= 0) [src, columns, rows] = [`${ROOT}/equip-gear.png`, 8, 3];
  else return null;
  const gradeIndex = Math.max(0, GRADES.indexOf(grade));
  return <span style={{ position: "relative", width: size, height: size, display: "inline-block", flex: `0 0 ${size}px`, ...style }}>
    <Sprite src={src} index={index} columns={columns} rows={rows} size={size} />
    <Sprite src={`${ROOT}/equip-grades.png`} index={gradeIndex} columns={3} rows={2} size={size} style={{ position: "absolute", inset: 0, filter: "drop-shadow(0 0 5px rgba(255,255,255,.18))" }} />
  </span>;
}

export function GuildJunkArt({ junkId, size = 44, style }) {
  const index = JUNK.indexOf(junkId);
  return index < 0 ? null : <Sprite src={`${ROOT}/junk.png`} index={index} columns={12} rows={6} size={size} style={style} />;
}

export const PLAYER_APPEARANCES = Object.freeze([
  { id: "tabby_ranger", name: "橘虎斑遊俠" }, { id: "black_scout", name: "黑貓斥候" },
  { id: "white_medic", name: "白貓藥師" }, { id: "calico_hunter", name: "三花獵人" },
  { id: "gray_guard", name: "灰貓守衛" }, { id: "cream_wanderer", name: "奶油旅者" },
]);

export function GuildPlayerAppearance({ appearanceId = "tabby_ranger", size = 80, style }) {
  const index = Math.max(0, PLAYER_APPEARANCES.findIndex(v => v.id === appearanceId));
  return <Sprite src={`${ROOT}/player-appearances.png`} index={index} columns={3} rows={2} size={size} style={style} />;
}
