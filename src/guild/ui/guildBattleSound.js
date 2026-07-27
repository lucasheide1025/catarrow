import {
  sfxGuildArrowHit,
  sfxGuildArrowShoot,
  sfxGuildCatAssist,
  sfxGuildCritical,
  sfxGuildDefeat,
  sfxGuildEnemyAttack,
  sfxGuildError,
  sfxGuildHazard,
  sfxGuildMonsterDown,
  sfxGuildTap,
  sfxGuildVictory,
  sfxGuildWaveClear,
} from "../../lib/sound";

export const GUILD_BATTLE_SOUND_EVENTS = Object.freeze([
  "tap",
  "shoot",
  "hit",
  "critical",
  "monsterDown",
  "enemyAttack",
  "catAssist",
  "hazard",
  "waveClear",
  "victory",
  "defeat",
  "error",
]);

export const guildBattleSound = Object.freeze({
  tap: sfxGuildTap,
  shoot: sfxGuildArrowShoot,
  hit: sfxGuildArrowHit,
  critical: sfxGuildCritical,
  monsterDown: sfxGuildMonsterDown,
  enemyAttack: sfxGuildEnemyAttack,
  catAssist: sfxGuildCatAssist,
  hazard: sfxGuildHazard,
  waveClear: sfxGuildWaveClear,
  victory: sfxGuildVictory,
  defeat: sfxGuildDefeat,
  error: sfxGuildError,
});
