"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.albumXpForCard = exports.albumForCard = exports.VILLAGE_ALBUM_META = exports.VILLAGE_ALBUM_IDS = exports.CAT_CARD_STAR_COSTS = exports.CAT_CARD_ALBUM = exports.ALBUM_CARD_IDS = void 0;
exports.albumXpFromCards = albumXpFromCards;
exports.albumXpGains = albumXpGains;
exports.villageAlbumBonusPct = exports.catCardUpgradeCost = void 0;
exports.villageAlbumLevel = villageAlbumLevel;
exports.villageAlbumMultiplier = void 0;
exports.villageAlbumThreshold = villageAlbumThreshold;
var _catCardData = require("./catCardData");
const VILLAGE_ALBUM_IDS = exports.VILLAGE_ALBUM_IDS = Object.freeze(["mine", "farm", "harbor", "hunting", "market", "warehouse", "alchemy", "gacha", "archery"]);
const VILLAGE_ALBUM_META = exports.VILLAGE_ALBUM_META = Object.freeze({
  mine: {
    name: "礦山卡冊",
    icon: "⛏️"
  },
  farm: {
    name: "農地卡冊",
    icon: "🌿"
  },
  harbor: {
    name: "海港卡冊",
    icon: "⚓"
  },
  hunting: {
    name: "獵場卡冊",
    icon: "🏕️"
  },
  market: {
    name: "市集卡冊",
    icon: "🛒"
  },
  warehouse: {
    name: "倉庫卡冊",
    icon: "📦"
  },
  alchemy: {
    name: "煉金卡冊",
    icon: "⚗️"
  },
  gacha: {
    name: "扭蛋卡冊",
    icon: "🎰"
  },
  archery: {
    name: "練箭卡冊",
    icon: "🏹"
  }
});
const CAPACITY = Object.freeze({
  mine: 23,
  farm: 23,
  harbor: 22,
  hunting: 22,
  market: 22,
  warehouse: 22,
  alchemy: 22,
  gacha: 22,
  archery: 22
});
const DEFAULT_ORDER = ["market", "warehouse", "farm", "harbor", "hunting", "alchemy", "gacha", "archery", "mine"];
const PREFS = Object.freeze({
  archery: ["archery", "hunting"],
  world: ["harbor", "market"],
  taiwan: ["market", "farm"],
  myth: ["alchemy", "mine"],
  scifi: ["gacha", "warehouse"],
  season: ["farm", "harbor"],
  meme: ["gacha", "market"],
  hero: ["archery", "warehouse"],
  nature: ["farm", "mine"],
  fairy: ["alchemy", "gacha"],
  breakfast: ["market", "farm"],
  cvs: ["warehouse", "market"],
  dessert: ["farm", "market"],
  fruit: ["farm", "harbor"],
  drink: ["harbor", "alchemy"],
  festival: ["market", "gacha"],
  job: ["warehouse", "archery"],
  weather: ["harbor", "farm"],
  quest: ["hunting", "archery"],
  legend: ["mine", "alchemy"]
});
function buildAssignments() {
  const counts = Object.fromEntries(VILLAGE_ALBUM_IDS.map(id => [id, 0]));
  const result = {};
  for (const card of _catCardData.CAT_CARDS) {
    const choices = [...(PREFS[card.cat] || []), ...DEFAULT_ORDER];
    const albumId = choices.find((id, index) => choices.indexOf(id) === index && counts[id] < CAPACITY[id]);
    result[card.id] = albumId;
    counts[albumId] += 1;
  }
  return result;
}
const CAT_CARD_ALBUM = exports.CAT_CARD_ALBUM = Object.freeze(buildAssignments());
const ALBUM_CARD_IDS = exports.ALBUM_CARD_IDS = Object.freeze(Object.fromEntries(VILLAGE_ALBUM_IDS.map(albumId => [albumId, Object.freeze(_catCardData.CAT_CARDS.filter(card => CAT_CARD_ALBUM[card.id] === albumId).map(card => card.id))])));
const albumForCard = cardId => CAT_CARD_ALBUM[String(cardId)] || null;
exports.albumForCard = albumForCard;
const albumXpForCard = cardId => String(cardId) === "100" || String(cardId) === "200" ? 3 : 1;
exports.albumXpForCard = albumXpForCard;
function villageAlbumThreshold(level) {
  const lv = Math.max(0, Math.min(20, Math.floor(Number(level) || 0)));
  return Math.round(1110 * Math.pow(lv / 20, 2));
}
function villageAlbumLevel(xp) {
  const value = Math.max(0, Math.floor(Number(xp) || 0));
  let level = 0;
  while (level < 20 && value >= villageAlbumThreshold(level + 1)) level += 1;
  return level;
}
const villageAlbumBonusPct = xp => villageAlbumLevel(xp) * 0.25;
exports.villageAlbumBonusPct = villageAlbumBonusPct;
const villageAlbumMultiplier = xp => 1 + villageAlbumBonusPct(xp) / 100;
exports.villageAlbumMultiplier = villageAlbumMultiplier;
function albumXpFromCards(catCards = {}) {
  const xp = Object.fromEntries(VILLAGE_ALBUM_IDS.map(id => [id, 0]));
  for (const [cardId, count] of Object.entries(catCards || {})) {
    const albumId = albumForCard(cardId);
    if (albumId) xp[albumId] += Math.max(0, Math.floor(Number(count) || 0)) * albumXpForCard(cardId);
  }
  return xp;
}
function albumXpGains(cardIds = []) {
  const gains = {};
  for (const cardId of cardIds) {
    const albumId = albumForCard(cardId);
    if (albumId) gains[albumId] = (gains[albumId] || 0) + albumXpForCard(cardId);
  }
  return gains;
}
const CAT_CARD_STAR_COSTS = exports.CAT_CARD_STAR_COSTS = Object.freeze([1, 2, 3, 4]);
const catCardUpgradeCost = stars => CAT_CARD_STAR_COSTS[Math.max(1, Number(stars) || 1) - 1] ?? null;
exports.catCardUpgradeCost = catCardUpgradeCost;
