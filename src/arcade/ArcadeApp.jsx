// src/arcade/ArcadeApp.jsx — 貓小隊訪客冒險系統入口（Local First Arcade RPG）
// 獨立於學生系統：掃 QR → 匿名 Visitor ID → 暱稱 → 同行貓 → 開始冒險。
// 資料只存在本機（IndexedDB），第二次回來直接「歡迎回來，繼續冒險」。
import { lazy, Suspense, useEffect, useState } from "react";
import {
  ARCADE_CATS,
  DEFAULT_CAT_ID,
  arcadeCatById,
  buildNewProfile,
  isCompleteProfile,
} from "./arcadeData";
import { loadVisitorProfile, saveVisitorProfile, clearVisitorProfile, loadCurrentTeamRoom, loadCurrentDuelRoom, syncProfileOnLoad, saveVisitorProfileWithCloud, setupCloudSyncListener } from "./arcadeDb";
import { CHEST_ITEMS } from "./arcadeData";
import { ADVENTURE_TYPES } from "./arcadeBattle";
import { comboLabel, formatTeamDuration, emptyTeamStats, TEAM_MODES, normalizeRoomCode, isValidRoomCode } from "./arcadeTeamLogic";
import { levelProgress, xpForLevel } from "./arcadeShop";
import { ArcadeActionDock, ArcadeBrand, ArcadePlayerBar, ArcadeShell, DungeonCarousel } from "./ArcadeGameUi";
import "./arcadeGame.css";

const ArcadeAdventure = lazy(() => import("./ArcadeAdventure"));
const ArcadeTeam = lazy(() => import("./ArcadeTeam"));
const ArcadeDuel = lazy(() => import("./ArcadeDuel"));
const ArcadeShop = lazy(() => import("./ArcadeShop.jsx"));

const ARCADE_CSS = `
.arcade-stage{min-height:100vh;font-family:Inter,"Noto Sans TC",system-ui,sans-serif;color:#3b2f1e;
  background:
    radial-gradient(1100px 520px at 50% -120px, rgba(201,123,45,.16), transparent 62%),
    radial-gradient(900px 500px at 110% 110%, rgba(43,58,103,.10), transparent 60%),
    linear-gradient(180deg,#f7edd3,#f1e2bd);
  position:relative;overflow-x:hidden}
.arcade-stage:before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.5;
  background-image:radial-gradient(rgba(120,84,35,.14) 1px, transparent 1.4px);
  background-size:22px 22px}
.arcade-wrap{position:relative;z-index:1;max-width:720px;margin:0 auto;padding:16px 14px 40px}
.arcade-topbar{display:flex;align-items:center;gap:10px;padding:10px 2px}
.arcade-logo{display:flex;align-items:center;gap:9px}
.arcade-logo-badge{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;font-size:21px;
  background:linear-gradient(135deg,#3a5a40,#2c4533);box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 6px 14px rgba(44,69,51,.35)}
.arcade-logo-title{font-size:14px;font-weight:1000;color:#2c4533;letter-spacing:.02em}
.arcade-logo-sub{font-size:11px;font-weight:800;color:#8a6a3b;margin-top:1px}
.arcade-card{border:1px solid #d8bd8a;border-radius:24px;background:linear-gradient(180deg,#fdf6e4,#f8ecd0);
  box-shadow:0 18px 44px rgba(120,84,35,.22), inset 0 1px 0 rgba(255,255,255,.75);padding:20px}
.arcade-hero{position:relative;overflow:hidden}
.arcade-hero:after{content:"";position:absolute;right:-24px;bottom:-34px;width:176px;height:176px;
  background:url(/cats/haji.webp) center/contain no-repeat;opacity:.95;filter:drop-shadow(0 16px 22px rgba(120,84,35,.34))}
.arcade-kicker{font-size:11px;font-weight:1000;letter-spacing:.14em;color:#b0651f}
.arcade-title{font-size:30px;line-height:1.1;font-weight:1000;color:#2c4533;margin:8px 0 0;max-width:330px}
.arcade-copy{font-size:13px;line-height:1.7;color:#6b5230;margin-top:10px;max-width:330px;font-weight:600}
.arcade-field{margin-top:18px}
.arcade-label{font-size:12px;font-weight:1000;color:#8a6a3b;letter-spacing:.06em;margin:0 0 8px}
.arcade-input{width:100%;box-sizing:border-box;border:2px solid #d8bd8a;background:#fffaf0;color:#3b2f1e;
  border-radius:16px;padding:14px 15px;font-size:17px;font-weight:800;outline:none;box-shadow:inset 0 2px 6px rgba(120,84,35,.08)}
.arcade-input:focus{border-color:#3a5a40;box-shadow:0 0 0 4px rgba(58,90,64,.16)}
.arcade-cat-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}
.arcade-cat{position:relative;border:2px solid #e2cd9d;border-radius:18px;background:#fffaf0;padding:10px 8px 9px;
  display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;transition:transform .12s ease,border-color .12s ease,box-shadow .12s ease}
.arcade-cat:hover{transform:translateY(-2px)}
.arcade-cat img{width:64px;height:64px;object-fit:contain;filter:drop-shadow(0 6px 8px rgba(120,84,35,.25));border-radius:14px}
.arcade-cat-name{font-size:13px;font-weight:1000;color:#3b2f1e}
.arcade-cat-role{font-size:10px;font-weight:800;color:#8a6a3b;background:#f3e7c9;border-radius:999px;padding:2px 8px}
.arcade-cat.sel{border-color:#3a5a40;box-shadow:0 0 0 3px rgba(58,90,64,.22),0 10px 22px rgba(58,90,64,.18);transform:translateY(-2px)}
.arcade-cat.sel .arcade-cat-name{color:#2c4533}
.arcade-primary{width:100%;border:0;border-radius:18px;padding:16px;color:#fff;font-size:17px;font-weight:1000;cursor:pointer;
  background:linear-gradient(135deg,#d64545,#b23b2e);box-shadow:0 14px 30px rgba(178,59,46,.34);transition:transform .1s ease,filter .1s ease}
.arcade-primary:active{transform:translateY(1px);filter:brightness(.96)}
.arcade-primary:disabled{opacity:.6;cursor:default}
.arcade-primary.green{background:linear-gradient(135deg,#3a5a40,#2c4533);box-shadow:0 14px 30px rgba(44,69,51,.32)}
.arcade-primary.blue{background:linear-gradient(135deg,#2b3a67,#1f2b4d);box-shadow:0 14px 30px rgba(31,43,77,.32)}
.arcade-note{margin-top:12px;border:1px solid #e0b76c;background:#fdf3dc;border-radius:16px;padding:12px 14px;
  font-size:12px;line-height:1.65;color:#8a5a1f;font-weight:700}
.arcade-share-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:8px}
.arcade-share-btn{border:1px solid #d8bd8a;background:#fffaf0;color:#6b5230;border-radius:999px;padding:9px 4px;font-size:12px;font-weight:1000;cursor:pointer;transition:transform .1s ease,background .1s ease}
.arcade-share-btn:active{transform:translateY(1px)}
.arcade-share-btn.line{background:#06c755;border-color:#05a848;color:#fff}
.arcade-share-btn.fb{background:#1877f2;border-color:#1465c9;color:#fff}
.arcade-note.blue{border-color:#b9c4e6;background:#eef2fc;color:#2b3a67}
.arcade-hub-hero{position:relative;overflow:hidden;background:linear-gradient(135deg,#3a5a40,#2c4533);border-color:#24402b;color:#fff}
.arcade-hub-hero:after{content:"";position:absolute;right:-20px;bottom:-30px;width:180px;height:180px;
  background:url(/cats/haji.webp) center/contain no-repeat;opacity:.9;filter:drop-shadow(0 18px 24px rgba(0,0,0,.35))}
.arcade-hub-kicker{font-size:11px;font-weight:1000;letter-spacing:.14em;color:#c9b46a;position:relative;z-index:1}
.arcade-hub-title{font-size:26px;line-height:1.14;font-weight:1000;margin:8px 0 0;max-width:340px;position:relative;z-index:1}
.arcade-hub-copy{font-size:13px;line-height:1.65;color:rgba(255,255,255,.82);margin-top:9px;max-width:320px;position:relative;z-index:1}
.arcade-hub-cat{display:flex;gap:14px;align-items:center}
.arcade-hub-cat img{width:88px;height:88px;object-fit:contain;border-radius:20px;background:#fffaf0;border:2px solid #e2cd9d;
  filter:drop-shadow(0 8px 12px rgba(120,84,35,.28))}
.arcade-hub-cat-name{font-size:19px;font-weight:1000;color:#2c4533}
.arcade-hub-cat-motto{font-size:12px;line-height:1.6;color:#6b5230;font-weight:600;margin-top:5px}
.arcade-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}
.arcade-stat{border:1px solid #e2cd9d;background:#fffaf0;border-radius:16px;padding:12px;text-align:center}
.arcade-stat-v{font-size:21px;font-weight:1000;color:#2c4533}
.arcade-stat-l{font-size:11px;font-weight:800;color:#8a6a3b;margin-top:3px}
.arcade-section-title{font-size:12px;font-weight:1000;color:#8a6a3b;letter-spacing:.1em;margin:20px 2px 10px}
.arcade-toast{position:fixed;left:16px;right:16px;bottom:24px;z-index:90;text-align:center;padding:13px 16px;border-radius:16px;
  background:#2c4533;color:#fdf6e4;font-size:13px;font-weight:900;box-shadow:0 16px 40px rgba(0,0,0,.28)}
.arcade-danger{border:0;border-radius:14px;padding:10px 14px;font-size:12px;font-weight:900;cursor:pointer;
  background:#fbe3dd;color:#b23b2e;border:1px solid #efc3b8}
.arcade-splash{min-height:100vh;display:grid;place-items:center;background:linear-gradient(180deg,#f7edd3,#f1e2bd)}
.arcade-splash-inner{text-align:center}
.arcade-splash-icon{font-size:64px;animation:arcade-bob 1.1s ease-in-out infinite}
@keyframes arcade-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.arcade-splash-t{font-size:16px;font-weight:1000;color:#3b2f1e;margin-top:12px}
.arcade-splash-s{font-size:12px;color:#8a6a3b;font-weight:800;margin-top:4px}
/* ── 戰鬥（6 箭一回合，規格 §10） ── */
.arcade-battle-head{display:flex;gap:10px;align-items:stretch}
.arcade-battle-side{flex:1;min-width:0;border:1px solid #e2cd9d;background:#fffaf0;border-radius:18px;padding:12px}
.arcade-vs{display:grid;place-items:center;font-size:14px;font-weight:1000;color:#b0651f;letter-spacing:.05em}
.arcade-fighter{display:flex;align-items:center;gap:10px;min-width:0}
.arcade-fighter img{width:58px;height:58px;object-fit:contain;border-radius:14px;background:#fffaf0;filter:drop-shadow(0 6px 8px rgba(120,84,35,.22))}
.arcade-fighter-name{font-size:14px;font-weight:1000;color:#2c4533;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.arcade-fighter-sub{font-size:10.5px;font-weight:800;color:#8a6a3b;margin-top:3px;line-height:1.4}
.arcade-hpbar{margin-top:9px;height:11px;border-radius:999px;background:#ead9b4;overflow:hidden;box-shadow:inset 0 1px 3px rgba(120,84,35,.25)}
.arcade-hpbar-fill{height:100%;border-radius:999px;transition:width .4s ease}
.arcade-hpbar-fill.hp-player{background:linear-gradient(90deg,#3a5a40,#58a05f)}
.arcade-hpbar-fill.hp-monster{background:linear-gradient(90deg,#b23b2e,#d64545)}
.arcade-hp-text{font-size:11px;font-weight:1000;color:#6b5230;margin-top:5px}
.arcade-task{margin-top:12px;border:1px dashed #c9a25e;background:#fbf3dd;border-radius:14px;padding:10px 12px;font-size:13px;font-weight:900;color:#6b3d10;line-height:1.5}
.arcade-arrows{margin-top:14px}
.arcade-arrow-slots{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}
.arcade-duel-3 .arcade-arrow-slots{grid-template-columns:repeat(3,minmax(0,1fr))}
.arcade-arrow-slot{display:flex;flex-direction:column;align-items:center;gap:1px;border:1px solid #e2cd9d;background:#fffaf0;border-radius:14px;padding:6px 2px 7px;cursor:pointer;transition:transform .12s ease,border-color .12s ease,box-shadow .12s ease;min-width:0}
.arcade-arrow-slot:hover{transform:translateY(-2px);border-color:#c97b2d}
.arcade-arrow-slot.filled{background:#eef7ee;border-color:#bcd9be}
.arcade-arrow-slot.x{background:linear-gradient(135deg,#fdf6d8,#f7df9a);border-color:#e0b13c}
.arcade-arrow-slot.miss{background:#fbe9e5;border-color:#efc0b4}
.arcade-arrow-slot.current{border-color:#3a5a40;box-shadow:0 0 0 3px rgba(58,90,64,.16);transform:translateY(-2px)}
.arcade-arrow-idx{font-size:9.5px;font-weight:900;color:#8a6a3b;opacity:.85}
.arcade-arrow-val{font-size:21px;font-weight:1000;color:#2c4533;line-height:1.1}
.arcade-arrow-slot.miss .arcade-arrow-val{color:#b23b2e}
.arcade-arrow-slot.x .arcade-arrow-val{color:#a06a05}
.arcade-arrow-slot:not(.filled):not(.current) .arcade-arrow-val{color:#c9b48a}
.arcade-scoreboard{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px;margin-top:10px}
.arcade-score-btn{border:1px solid #d8bd8a;background:#fffaf0;color:#2c4533;border-radius:999px;padding:10px 0;font-size:17px;font-weight:1000;cursor:pointer;transition:transform .1s ease,background .1s ease;box-shadow:0 2px 0 rgba(120,84,35,.18)}
.arcade-score-btn:active{transform:translateY(1px);box-shadow:0 0 0 rgba(120,84,35,.18)}
.arcade-score-btn.miss{color:#b23b2e;background:#fbe9e5;border-color:#efc0b4}
.arcade-score-btn.x{color:#7c4a03;background:linear-gradient(135deg,#fdf6d8,#f7df9a);border-color:#e0b13c}
.arcade-score-btn:disabled{opacity:.45;cursor:not-allowed}
.arcade-quick{display:flex;gap:8px;margin-top:12px}
.arcade-quick-btn{flex:1;border:1px solid #d8bd8a;background:#fffaf0;color:#8a5a1f;border-radius:999px;padding:8px 4px;font-size:12px;font-weight:1000;cursor:pointer}
.arcade-log{margin-top:14px;display:flex;flex-direction:column;gap:7px;min-height:120px;justify-content:center}
.arcade-log-line{opacity:0;animation:arcade-log-in .35s ease forwards;font-size:13.5px;font-weight:900;line-height:1.55;padding:8px 12px;border-radius:12px;background:#fffaf0;border:1px solid #e2cd9d}
.arcade-log-line.kind-cat{background:#eef7ee;border-color:#bcd9be;color:#2c4533}
.arcade-log-line.kind-info{background:#fdf3dc;border-color:#e6c98f;color:#8a5a1f}
.arcade-log-line.kind-enemy{background:#fbe9e5;border-color:#efc0b4;color:#a33a2d}
.arcade-log-line.kind-danger{background:#f8d7d0;border-color:#e59a8c;color:#8f2418;font-weight:1000}
@keyframes arcade-log-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.arcade-damage{margin-top:12px;text-align:center;font-size:19px;font-weight:1000;color:#b23b2e}
.arcade-row{display:flex;gap:10px}
.arcade-result-banner{flex:1;text-align:center;font-size:16px;font-weight:1000;border-radius:14px;padding:13px}
.arcade-result-banner.win{background:#eef7ee;color:#2c4533;border:1px solid #bcd9be}
.arcade-result-banner.lose{background:#fbe9e5;color:#a33a2d;border:1px solid #efc0b4}
.arcade-chest-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:16px}
.arcade-chest-card{border:2px solid #d8bd8a;background:#fffaf0;border-radius:18px;padding:14px 10px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;transition:transform .12s ease,border-color .12s ease}
.arcade-chest-card:hover{transform:translateY(-3px);border-color:#c97b2d}
.arcade-chest-name{font-size:14px;font-weight:1000;color:#2c4533}
.arcade-chest-desc{font-size:11px;font-weight:800;color:#8a6a3b;line-height:1.5}
.arcade-grade{margin:14px auto 0;display:inline-flex;flex-direction:column;align-items:center;gap:4px;padding:12px 22px;border-radius:18px;font-size:26px;font-weight:1000}
.arcade-grade.grade-S{background:linear-gradient(135deg,#fde68a,#f59e0b);color:#7c4a03;border:2px solid #e0b13c}
.arcade-grade.grade-A{background:#eef7ee;color:#2c4533;border:2px solid #bcd9be}
.arcade-grade.grade-B{background:#e8eefc;color:#2b3a67;border:2px solid #b9c4e6}
.arcade-grade.grade-C{background:#f3e7c9;color:#6b5230;border:2px solid #d8bd8a}
.arcade-grade-label{font-size:12px;font-weight:900}
@media (max-width:430px){.arcade-fighter img{width:46px;height:46px}.arcade-fighter-name{font-size:12.5px}.arcade-arrow-slots{grid-template-columns:repeat(3,minmax(0,1fr))}.arcade-scoreboard{grid-template-columns:repeat(6,minmax(0,1fr))}.arcade-score-btn{padding:8px 0;font-size:15px}.arcade-chest-grid{gap:7px}}
/* ── 戰鬥演出動畫（M1.1） ── */
@keyframes arcade-pop-in{0%{transform:scale(.2);opacity:0}70%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}
.arcade-monster-img{animation:arcade-pop-in .38s cubic-bezier(.34,1.56,.64,1) both}
.arcade-cat-img{animation:arcade-pop-in .38s cubic-bezier(.34,1.56,.64,1) both}
.arcade-battle-side{position:relative;transition:transform .16s ease}
.arcade-battle-side.fx-lunge{transform:translateX(26px) rotate(-4deg)}
@keyframes arcade-hit-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-10px) rotate(-2deg)}40%{transform:translateX(9px) rotate(2deg)}60%{transform:translateX(-7px)}80%{transform:translateX(5px)}}
.arcade-battle-side.fx-shake{animation:arcade-hit-shake .45s ease}
.arcade-battle-side.fx-monster-lunge{animation:arcade-monster-lunge .4s ease}
@keyframes arcade-monster-lunge{0%{transform:translateX(0)}45%{transform:translateX(-30px)}100%{transform:translateX(0)}}
.arcade-battle-side.fx-dead{animation:arcade-dead .6s ease forwards}
@keyframes arcade-dead{to{transform:scale(.15) rotate(24deg);opacity:0}}
.arcade-hitflash,.arcade-playerflash{position:absolute;inset:0;border-radius:18px;pointer-events:none;opacity:0;z-index:4}
.arcade-hitflash{background:radial-gradient(circle,rgba(214,69,69,.55),transparent 72%)}
.arcade-playerflash{background:radial-gradient(circle,rgba(88,160,95,.45),transparent 72%)}
.arcade-battle-side.fx-shake .arcade-hitflash{opacity:1}
.arcade-battle-side.fx-shake .arcade-playerflash{opacity:1}
@keyframes arcade-float-up{0%{transform:translate(-50%,0) scale(.5);opacity:0}22%{opacity:1;transform:translate(-50%,-10px) scale(1.2)}100%{transform:translate(-50%,-70px) scale(1);opacity:0}}
.arcade-float-dmg{position:absolute;left:50%;top:8%;transform:translateX(-50%);font-size:34px;font-weight:1000;color:#fff;text-shadow:0 2px 0 #7c1d12,0 0 20px rgba(214,69,69,.95);animation:arcade-float-up 1s ease forwards;pointer-events:none;z-index:6;white-space:nowrap}
.arcade-float-dmg.heal{color:#d9f7de;text-shadow:0 2px 0 #14532d,0 0 18px rgba(88,160,95,.95)}
.arcade-float-dmg.hurt{color:#ffd7d0;text-shadow:0 2px 0 #7f1d1d,0 0 16px rgba(214,69,69,.8)}
@keyframes arcade-bubble-pop{0%{transform:translateX(-50%) scale(.3);opacity:0}70%{transform:translateX(-50%) scale(1.12)}100%{transform:translateX(-50%) scale(1);opacity:1}}
.arcade-cat-bubble{position:absolute;top:2px;left:50%;z-index:7;transform:translateX(-50%);background:#2c4533;color:#fdf6e4;font-size:12px;font-weight:900;padding:7px 13px;border-radius:999px;white-space:nowrap;box-shadow:0 8px 20px rgba(0,0,0,.3);animation:arcade-bubble-pop .35s cubic-bezier(.34,1.56,.64,1) both;border:2px solid #58a05f}
@keyframes arcade-arrow-fly{0%{transform:translateX(0) rotate(-14deg) scale(.7);opacity:0}15%{opacity:1}100%{transform:translateX(46vw) rotate(-14deg) scale(1);opacity:1}}
.arcade-arrow-fly{position:absolute;left:6%;top:34%;z-index:7;font-size:34px;pointer-events:none;animation:arcade-arrow-fly .42s ease forwards}
.arcade-acting{min-height:120px;display:flex;align-items:center;justify-content:center;gap:10px;font-size:14px;font-weight:1000;color:#8a6a3b}
.arcade-acting-dots{display:inline-flex;gap:5px}
.arcade-acting-dots i{width:8px;height:8px;border-radius:999px;background:#c97b2d;display:inline-block;animation:arcade-dot 1s ease-in-out infinite}
.arcade-acting-dots i:nth-child(2){animation-delay:.18s}
.arcade-acting-dots i:nth-child(3){animation-delay:.36s}
@keyframes arcade-dot{0%,100%{transform:translateY(0);opacity:.5}50%{transform:translateY(-6px);opacity:1}}
@keyframes arcade-confetti-fall{to{transform:translateY(108vh) rotate(360deg);opacity:.85}}
.arcade-confetti{position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:40}
.arcade-confetti span{position:absolute;top:-48px;font-size:26px;animation:arcade-confetti-fall linear forwards}
.arcade-chest-pop{font-size:58px;animation:arcade-chest-bounce 1.1s ease-in-out infinite}
.arcade-defeat-pop{font-size:54px;animation:arcade-dead-shake .7s ease}
@keyframes arcade-chest-bounce{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-10px) scale(1.08)}}
@keyframes arcade-dead-shake{0%,100%{transform:rotate(0)}25%{transform:rotate(-10deg)}75%{transform:rotate(10deg)}}
/* ── M2：岔路／事件／深淵決策／地下城選卡 ── */
.arcade-route-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:16px}
.arcade-route-card{border:2px solid #d8bd8a;background:#fffaf0;border-radius:18px;padding:16px 10px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:7px;opacity:0;animation:arcade-pop-in .4s cubic-bezier(.34,1.56,.64,1) forwards;transition:transform .12s ease,box-shadow .12s ease}
.arcade-route-card:hover{transform:translateY(-4px);box-shadow:0 14px 28px rgba(120,84,35,.24)}
.arcade-route-icon{width:52px;height:52px;border-radius:16px;display:grid;place-items:center;font-size:28px}
.arcade-route-label{font-size:15px;font-weight:1000;color:#2c4533}
.arcade-route-desc{font-size:11px;font-weight:800;color:#8a6a3b;line-height:1.5}
.arcade-dungeon-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.arcade-dungeon-card{border:2px solid #e2cd9d;background:#fffaf0;border-radius:18px;padding:14px 10px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:5px;opacity:0;animation:arcade-pop-in .4s cubic-bezier(.34,1.56,.64,1) forwards;transition:transform .12s ease,border-color .12s ease}
.arcade-dungeon-card:hover{transform:translateY(-3px);border-color:#c97b2d}
.arcade-dungeon-card-active{border-color:#3a7d44;background:#eef7ee;box-shadow:0 0 0 2px rgba(58,125,68,.25)}
.arcade-team-ach{margin-top:16px;border:2px dashed #d8bd8a;background:#fdf6e4;border-radius:18px;padding:12px 8px 10px}
.arcade-team-ach-title{font-size:13px;font-weight:1000;color:#8a5a1f;margin-bottom:8px}
.arcade-performance{margin-top:14px;padding:13px;border:1px solid #dec89d;border-radius:17px;background:linear-gradient(180deg,#fffaf0,#f8ecd2)}
.arcade-performance-title{font-size:13px;font-weight:1000;color:#70461d;margin-bottom:9px}
.arcade-performance-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.arcade-performance-grid>div{display:flex;flex-direction:column;gap:2px;padding:8px 4px;border-radius:12px;background:rgba(255,255,255,.72);text-align:center}
.arcade-performance-grid b{font-size:17px;color:#2c4533}.arcade-performance-grid span{font-size:9px;font-weight:800;color:#7d6a50}
.arcade-praise{margin-top:9px;font-size:12px;font-weight:900;line-height:1.55;color:#8a5a1f;text-align:center}
.arcade-sync-box{margin-top:12px}.arcade-sync-box .arcade-primary{width:100%;min-height:40px}.arcade-sync-message{margin-top:6px;font-size:11px;font-weight:800;color:#5d6b63;text-align:center}
.arcade-team-attacker-banner{position:fixed;top:72px;left:50%;transform:translateX(-50%);z-index:115;min-width:min(82vw,340px);padding:10px 16px;border-radius:999px;background:rgba(20,31,50,.94);border:1px solid rgba(255,255,255,.22);box-shadow:0 10px 30px rgba(0,0,0,.35);color:#fff;text-align:center;font-size:17px;font-weight:1000;animation:arcade-pop-in .2s ease-out}.arcade-team-attacker-banner small{font-size:11px;color:#f8d99a;margin-left:6px}
.arcade-kill-burst{position:fixed;inset:0;z-index:114;display:grid;place-content:center;pointer-events:none;text-align:center;background:radial-gradient(circle,rgba(255,215,90,.2),rgba(40,15,15,.58) 48%,rgba(0,0,0,.72));animation:arcade-kill-bg .9s ease-out forwards}.arcade-kill-burst span{font-size:clamp(42px,13vw,76px);font-weight:1000;color:#ffe08a;text-shadow:0 0 18px #ff8a00,0 4px 0 #7a2500;animation:arcade-kill-pop .55s cubic-bezier(.2,1.6,.3,1)}.arcade-kill-burst small{margin-top:9px;font-size:15px;font-weight:1000;color:#fff}
@keyframes arcade-kill-pop{0%{transform:scale(.2) rotate(-8deg);opacity:0}65%{transform:scale(1.13) rotate(2deg);opacity:1}100%{transform:scale(1)}}
@keyframes arcade-kill-bg{0%{opacity:0}20%{opacity:1}100%{opacity:.94}}

/* BOSS：靶面平常隱藏，按「輸入分數」才開全螢幕，手機拖曳時可用最大可視面積。 */
.arcade-boss-score-launcher{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:14px;padding:11px 12px;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:rgba(0,0,0,.18)}
.arcade-boss-score-launcher>div{display:grid;gap:3px;text-align:left}.arcade-boss-score-launcher strong{font-size:13px}.arcade-boss-score-launcher span{font-size:11px;color:#cbd5e1}
.arcade-boss-score-launcher .arcade-primary{width:auto;min-width:124px;margin:0;padding:10px 13px}
.arcade-target-overlay{position:fixed;inset:0;z-index:195;display:flex;flex-direction:column;background:rgba(5,7,13,.985);padding:calc(10px + env(safe-area-inset-top)) 10px calc(10px + env(safe-area-inset-bottom));overscroll-behavior:contain;touch-action:none}
.arcade-target-overlay-head{display:flex;align-items:center;justify-content:space-between;gap:12px;color:#fff;padding:2px 4px 9px}.arcade-target-overlay-head strong{display:block;font-size:16px}.arcade-target-overlay-head small{display:block;margin-top:2px;font-size:11px;color:#94a3b8}.arcade-target-overlay-head button{display:grid;place-items:center;width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);color:#fff;font-size:20px}
.arcade-target-overlay-face{flex:1;min-height:0;display:grid;place-items:center;overflow:hidden}.arcade-target-overlay-face>div{width:min(94vw,620px);max-height:100%;margin:auto}.arcade-target-overlay-face svg{max-height:min(68vh,620px)}
.arcade-target-overlay-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding-top:10px}.arcade-target-overlay-actions .arcade-primary{grid-column:1/-1;margin:0}.arcade-target-overlay-actions .arcade-quick-btn{min-height:44px}

/* 單人六箭：每箭都有獨立的 presentation 提示。 */
.arcade-solo-arrow-step{position:fixed;z-index:150;left:50%;top:calc(74px + env(safe-area-inset-top));transform:translateX(-50%);display:flex;align-items:center;gap:10px;min-width:118px;justify-content:center;padding:9px 14px;border:1px solid rgba(255,255,255,.18);border-radius:999px;background:rgba(9,14,22,.94);color:#fff;box-shadow:0 9px 28px rgba(0,0,0,.38);pointer-events:none;animation:arcade-solo-arrow-step .28s ease-out}.arcade-solo-arrow-step b{font-size:11px;color:#cbd5e1}.arcade-solo-arrow-step span{font-size:19px;font-weight:1000;color:#fde68a;min-width:24px;text-align:center}.arcade-solo-arrow-step.impact{border-color:rgba(253,230,138,.5)}
@keyframes arcade-solo-arrow-step{from{opacity:0;transform:translate(-50%,-10px) scale(.9)}to{opacity:1;transform:translate(-50%,0) scale(1)}}

/* 對齊正式打怪模式的完整擊倒語言：閃白 → 怪物失去色彩 → 擊倒印章 → 戰績。 */
.arcade-knockdown-overlay{position:fixed;inset:0;z-index:185;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;pointer-events:none;color:#fff;text-align:center;background:radial-gradient(circle at 50% 38%,rgba(119,18,25,.58),rgba(5,6,10,.97) 67%)}
.arcade-knockdown-flash{position:absolute;inset:0;background:#fff;animation:arcade-knockdown-flash .55s ease-out both}.arcade-knockdown-monster{position:relative;z-index:1;width:min(50vw,230px);max-height:35vh;object-fit:contain;filter:brightness(1.6) saturate(.45);animation:arcade-knockdown-monster 2.65s ease both}.arcade-knockdown-overlay.boss .arcade-knockdown-monster{width:min(62vw,290px)}
.arcade-knockdown-stamp{position:relative;z-index:3;margin-top:-34px;padding:5px 18px;border:5px solid #ef4444;border-radius:7px;color:#ff5a5a;font-size:clamp(36px,11vw,62px);font-weight:1000;line-height:1;letter-spacing:.12em;text-indent:.12em;text-shadow:0 3px 0 #5b0a0a;box-shadow:inset 0 0 0 2px rgba(255,255,255,.18),0 0 28px rgba(239,68,68,.4);transform:rotate(-9deg);animation:arcade-knockdown-stamp .55s .48s cubic-bezier(.18,1.45,.3,1) both}
.arcade-knockdown-title{position:relative;z-index:3;margin-top:16px;font-size:clamp(28px,8vw,46px);font-weight:1000;color:#fde68a;text-shadow:0 0 18px rgba(245,158,11,.8);animation:arcade-knockdown-rise .45s .78s ease-out both}.arcade-knockdown-sub{position:relative;z-index:3;margin-top:5px;font-size:14px;font-weight:900;color:#fff;animation:arcade-knockdown-rise .4s .92s ease-out both}.arcade-knockdown-stats{position:relative;z-index:3;display:flex;gap:9px;margin-top:14px;animation:arcade-knockdown-rise .42s 1.18s ease-out both}.arcade-knockdown-stats span{padding:7px 10px;border:1px solid rgba(255,255,255,.2);border-radius:999px;background:rgba(255,255,255,.08);font-size:12px;font-weight:900}
@keyframes arcade-knockdown-flash{0%{opacity:.95}35%{opacity:.38}100%{opacity:0}}
@keyframes arcade-knockdown-monster{0%{transform:scale(1.08);opacity:1;filter:brightness(2.6) saturate(.15)}18%{transform:scale(1);filter:brightness(1.3) saturate(.35)}62%{transform:scale(.96);opacity:.78;filter:brightness(.52) saturate(.08)}100%{transform:translateY(30px) scale(.88);opacity:.2;filter:brightness(.22) grayscale(1)}}
@keyframes arcade-knockdown-stamp{0%{opacity:0;transform:scale(2.2) rotate(-15deg)}65%{opacity:1;transform:scale(.9) rotate(-8deg)}100%{opacity:1;transform:scale(1) rotate(-9deg)}}
@keyframes arcade-knockdown-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
.arcade-team-stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:10px}
.arcade-team-stat-card{border:1px solid #d8bd8a;background:linear-gradient(180deg,#fdf6e4,#f8ecd0);border-radius:18px;padding:12px 12px 10px;box-shadow:0 6px 16px rgba(120,84,35,.14)}
.arcade-team-stat-card.locked{opacity:.6;filter:grayscale(.25)}
.arcade-team-stat-head{display:flex;align-items:center;gap:7px;margin-bottom:8px}
.arcade-team-stat-icon{font-size:17px}
.arcade-team-stat-name{font-size:12.5px;font-weight:1000;color:#2c4533}
.arcade-team-stat-row{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#6b5533;padding:2.5px 0;border-top:1px dashed #e6d3a8}
.arcade-team-stat-row:first-of-type{border-top:none}
.arcade-team-stat-row b{font-size:11.5px;color:#8a5a1f}
.arcade-team-stat-empty{font-size:11px;color:#9a8a6e;line-height:1.4;padding:4px 0}
.arcade-dungeon-card-locked{opacity:.72;cursor:default}
.arcade-dungeon-card-locked:hover{transform:none;border-color:#e2cd9d}
.arcade-dungeon-card .arcade-dungeon-diff{font-size:11px;font-weight:900;color:#b23b2e}
.arcade-dungeon-card .arcade-dungeon-desc{font-size:10px;color:#8a7a5f;text-align:center;line-height:1.35}

/* M3：冒險者等級條 */
.arcade-levelbar{margin-top:14px;background:linear-gradient(180deg,#fff8e8,#f7ecd2);border:1px solid #e3c98f;border-radius:16px;padding:12px 14px}
.arcade-levelbar-head{display:flex;align-items:center;gap:8px}
.arcade-levelbar-badge{font-size:12.5px;font-weight:1000;color:#fff;background:linear-gradient(135deg,#e8a13c,#c9761f);border-radius:999px;padding:3px 10px;box-shadow:0 2px 6px rgba(201,118,31,.35)}
.arcade-levelbar-label{font-size:12px;font-weight:800;color:#6b5533}
.arcade-levelbar-xp{margin-left:auto;font-size:11px;color:#8a7a5f;font-weight:700}
.arcade-levelbar-track{margin-top:8px;height:9px;border-radius:999px;background:#eadfc2;overflow:hidden}
.arcade-levelbar-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#f6b73c,#e08a1e);box-shadow:0 0 8px rgba(224,138,30,.5);transition:width .6s ease}

/* M2：金幣商店 */
.arcade-shop-hero .arcade-shop-coins{margin-top:14px;display:flex;align-items:center;gap:8px;background:linear-gradient(180deg,#fff8e8,#f8ecd0);border:1px solid #e3c98f;border-radius:16px;padding:12px 16px}
.arcade-shop-coins-icon{font-size:24px}
.arcade-shop-coins-v{font-size:26px;font-weight:1000;color:#c9761f}
.arcade-shop-coins-l{font-size:12px;color:#8a7a5f;font-weight:700}
.arcade-shop-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:10px}
.arcade-shop-card{border:1px solid #d8bd8a;background:linear-gradient(180deg,#fdf6e4,#f8ecd0);border-radius:18px;padding:14px 12px 12px;box-shadow:0 6px 16px rgba(120,84,35,.14);display:flex;flex-direction:column}
.arcade-shop-icon{font-size:30px;text-align:center;filter:drop-shadow(0 3px 4px rgba(120,84,35,.25))}
.arcade-shop-name{font-size:14.5px;font-weight:1000;color:#3b2f1e;text-align:center;margin-top:6px}
.arcade-shop-desc{font-size:11px;color:#8a7a5f;text-align:center;line-height:1.4;margin-top:3px;flex:1}
.arcade-shop-row{display:flex;justify-content:space-between;align-items:center;margin-top:8px}
.arcade-shop-price{font-size:13px;font-weight:1000;color:#c9761f}
.arcade-shop-price.poor{color:#b23b2e}
.arcade-shop-owned{font-size:10.5px;color:#8a7a5f;font-weight:700}
.arcade-primary.gold{background:linear-gradient(135deg,#f0b13c,#d98a1f);border-color:#b97a1a;color:#fff;text-shadow:0 1px 2px rgba(120,60,0,.3)}
.arcade-primary.gray{background:linear-gradient(135deg,#c9c2b2,#a89f8c);border-color:#94896f;color:#fff}
.arcade-dungeon-card .arcade-dungeon-check{font-size:11px;font-weight:1000;color:#3a7d44;background:#dcecdc;border-radius:99px;padding:2px 10px}
.arcade-dungeon-icon{font-size:30px}
.arcade-dungeon-name{font-size:13.5px;font-weight:1000;color:#2c4533}
.arcade-dungeon-diff{font-size:11px;font-weight:900;color:#b0651f}
.arcade-dungeon-desc{font-size:10.5px;font-weight:700;color:#8a6a3b;line-height:1.5;text-align:center}
.arcade-monster-img.elite{filter:drop-shadow(0 0 10px rgba(201,123,45,.85)) saturate(1.25)}
.arcade-monster-img.abyss{filter:drop-shadow(0 0 10px rgba(214,69,69,.8)) saturate(1.35) hue-rotate(-14deg)}
@media (max-width:430px){.arcade-route-grid{gap:7px}.arcade-dungeon-grid{gap:7px}.arcade-dungeon-desc{font-size:9.5px}.arcade-performance-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
/* ── M3：組隊（Team Attack） ── */
.arcade-team-code{font-size:44px;font-weight:1000;letter-spacing:10px;color:#2c4533;margin:10px 0 2px}
/* 隊友列：Grid 自動排欄（≤5 人約 1 欄、6+ 人自動 2 欄），人多頭像縮小 */
.arcade-team-players{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-top:12px}
.arcade-team-players.crowd{grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:7px}
.arcade-team-player{display:flex;align-items:center;gap:9px;border:1px solid #e2cd9d;background:#fffaf0;border-radius:16px;padding:8px 12px;min-width:0;transition:border-color .15s ease,background .15s ease}
.arcade-team-player img{width:38px;height:38px;object-fit:contain;border-radius:12px;background:#fffaf0;filter:drop-shadow(0 4px 6px rgba(120,84,35,.22))}
.arcade-team-player-name{font-size:13px;font-weight:1000;color:#2c4533}
.arcade-team-player-sub{font-size:10.5px;font-weight:800;color:#8a6a3b;margin-top:2px}
.arcade-team-player.ready{border-color:#58a05f;background:#eef7ee}
.arcade-team-player.offline{border-color:#e2cd9d;background:#f4ecdb;opacity:.55;filter:grayscale(.8)}
.arcade-team-player.empty{border-style:dashed;color:#8a6a3b;font-weight:800;font-size:12px;opacity:.75}
/* 6+ 人壓縮模式：頭像縮小、卡更緊、文字縮小（名字只留一行） */
.arcade-team-players.crowd .arcade-team-player{gap:6px;padding:6px 9px;border-radius:13px}
.arcade-team-players.crowd .arcade-team-player img{width:29px;height:29px;border-radius:9px;flex-shrink:0}
.arcade-team-players.crowd .arcade-team-player-name{font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.arcade-team-players.crowd .arcade-team-player-sub{font-size:9.5px;margin-top:1px}
.arcade-team-players.crowd .arcade-team-player.empty{font-size:10.5px;padding:10px 6px}
/* ── 組隊叉路選擇 ── */
.arcade-routes{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-top:16px}
.arcade-route-card{display:flex;flex-direction:column;align-items:center;gap:6px;border:2px solid #d8bd8a;border-radius:18px;background:#fffaf0;padding:14px 10px;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease;font-family:inherit}
.arcade-route-card:active{transform:scale(.96)}
.arcade-route-card:disabled{opacity:.6;cursor:default}
.arcade-route-icon{width:52px;height:52px;border-radius:16px;display:grid;place-items:center;font-size:26px}
.arcade-route-label{font-size:15px;font-weight:1000;color:#2c4533}
.arcade-route-desc{font-size:10.5px;font-weight:700;color:#8a6a3b;text-align:center;line-height:1.45}
.arcade-route-pick{margin-top:2px;font-size:11px;font-weight:1000;color:#2b3a67}
/* ── 組隊四段進度 ── */
.arcade-team-track{display:flex;align-items:center;gap:6px;margin-bottom:10px}
.arcade-team-track-item{flex:1;text-align:center;font-size:10px;font-weight:900;color:#b9a06a;background:#f7efdd;border-radius:10px;padding:4px 2px;white-space:nowrap}
.arcade-team-track-item.done{color:#2c4533;background:#e4f0e2}
.arcade-team-track-item.cur{color:#fff;background:#2b3a67;box-shadow:0 4px 10px rgba(43,58,103,.35)}
.arcade-team-track-item.boss{background:#7c3f2c;color:#fff}
/* ── BOSS 戰：團隊/個人目標＋士氣 ── */
.arcade-boss-goals{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
.arcade-boss-goal{border-radius:14px;padding:10px 12px;border:1.5px solid;background:#fffaf0}
.arcade-boss-goal.team{border-color:#c97b2d;background:#fdf3e3}
.arcade-boss-goal.personal{border-color:#2b3a67;background:#eef2fc}
.arcade-boss-goal-label{font-size:10.5px;font-weight:1000;letter-spacing:.5px;color:#8a6a3b}
.arcade-boss-goal.personal .arcade-boss-goal-label{color:#2b3a67}
.arcade-boss-goal-text{font-size:12.5px;font-weight:900;color:#2c4533;margin-top:4px;line-height:1.4}
.arcade-boss-goal-progress{font-size:10.5px;font-weight:800;color:#8a6a3b;margin-top:4px}
.arcade-spirit{border-radius:14px;padding:10px 12px;background:#fdeeee;border:1.5px solid #e8b3a8;margin-bottom:10px}
.arcade-spirit-label{font-size:12px;font-weight:1000;color:#7c3f2c}
.arcade-spirit .arcade-hpbar{height:10px;margin-top:6px}
.hp-spirit{background:linear-gradient(90deg,#e05252,#ff8a5c)}
.arcade-spirit-note{font-size:10px;font-weight:800;color:#b07a6a;margin-top:5px}
.arcade-route-log{border-radius:12px;background:#f2ead6;border:1px dashed #d8bd8a;padding:8px 12px;font-size:11.5px;font-weight:800;color:#6d5524;margin-bottom:10px;line-height:1.6}
/* ── BOSS 靶面：怪物小圖佔位（普通關） ── */
.arcade-boss-weakspots{position:relative;display:inline-flex;flex-shrink:0}
/* 我的目標圈色標 */
.arcade-goal-dot{display:inline-block;width:11px;height:11px;border-radius:50%;flex-shrink:0}
/* ── 組隊 BOSS 戰：世界王風深色舞台 ── */
.arcade-raid-stage{position:relative;overflow:hidden;background:radial-gradient(ellipse at 50% 30%,#241b3d 0%,#0d0a1a 62%,#05040a 100%);border-radius:22px;padding:12px 12px 14px;border:1px solid #2b2342;color:#e2e8f0}
.arcade-raid-glow{position:absolute;left:50%;top:24%;transform:translate(-50%,-50%);width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(120,84,220,.28),transparent 65%);pointer-events:none;z-index:0}
.arcade-raid-bossbar{position:relative;z-index:2;background:linear-gradient(180deg,rgba(2,6,23,.9),rgba(2,6,23,.35));border-radius:12px;padding:7px 11px}
.arcade-raid-bossbar-row{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.arcade-raid-bossname{font-size:14px;font-weight:1000;color:#fde68a;white-space:nowrap;text-shadow:0 2px 8px rgba(0,0,0,.6)}
.arcade-raid-bossbar-hp{font-size:10px;font-weight:900;color:#e2e8f0;white-space:nowrap}
.arcade-raid-bossbar-track{margin-top:5px;height:11px;border-radius:6px;background:rgba(255,255,255,.08);overflow:hidden}
.arcade-raid-bossbar-fill{height:100%;transition:width .45s cubic-bezier(.3,.9,.4,1)}
/* 單人 BOSS：玩家小條（raid 舞台用） */
.arcade-raid-playerbar{position:relative;z-index:2;display:flex;align-items:center;gap:6px;background:linear-gradient(180deg,rgba(2,6,23,.9),rgba(2,6,23,.35));border-radius:12px;padding:6px 10px;margin-bottom:8px}
.arcade-raid-playerbar img{width:34px;height:34px;border-radius:10px;object-fit:cover;background:#fffaf0}
.arcade-raid-playerbar-name{font-size:11px;font-weight:1000;color:#cbd5e1;white-space:nowrap}
.arcade-raid-playerbar-hp{font-size:10px;font-weight:900;color:#fca5a5;white-space:nowrap}
/* 王立繪：置中放大，弱點圈疊在上面 */
.arcade-raid-bossbox{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;padding:16px 0 6px}
.arcade-raid-boss-wrap{position:relative;width:196px;height:196px;display:grid;place-items:center}
.arcade-raid-boss-wrap img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 14px 22px rgba(0,0,0,.55))}
/* 手機原地操作（單人輸入階段）：王立繪縮小，騰出空間給靶面，不用捲動 */
.arcade-raid-stage.input-mode .arcade-raid-bossbox{padding:4px 0 2px}
.arcade-raid-stage.input-mode .arcade-raid-boss-wrap{width:96px;height:96px}
.arcade-raid-stage.input-mode .arcade-raid-spirit{margin-top:4px;padding:4px 10px}
.arcade-raid-stage.input-mode .arcade-raid-spirit-row{margin-bottom:2px}
.arcade-raid-stage.input-mode .arcade-raid-cell{height:8px}
/* 戰鬥結算底部彈出面板：訊息覆蓋顯示，不推擠版面 */
.arcade-result-sheet{position:fixed;left:8px;right:8px;bottom:8px;z-index:70;max-height:62vh;overflow:auto;border-radius:20px;padding:10px 14px 16px;background:#fffdf6;border:1px solid #f0e6d8;box-shadow:0 -8px 40px rgba(0,0,0,.45);animation:arcade-sheet-up .32s cubic-bezier(.2,1,.3,1)}
.arcade-sheet-handle{width:44px;height:4px;border-radius:99px;background:#e5dccb;margin:2px auto 10px}
@keyframes arcade-sheet-up{from{transform:translateY(120%)}to{transform:translateY(0)}}
/* 王呼吸動畫 */
.arcade-raid-boss-idle{animation:arcade-raid-breathe 3.4s ease-in-out infinite}
.arcade-raid-boss-flinch{animation:arcade-raid-flinch .24s ease-out}
.arcade-raid-boss-roar{animation:arcade-raid-roar 1.05s ease-out}
.arcade-raid-boss-fall{animation:arcade-raid-fall 1.6s cubic-bezier(.5,0,.75,0) forwards}
@keyframes arcade-raid-breathe{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-5px) scale(1.012)}}
@keyframes arcade-raid-flinch{0%,100%{filter:none;transform:translateX(0)}40%{filter:brightness(2.3) saturate(.3);transform:translateX(5px)}}
@keyframes arcade-raid-roar{0%{transform:scale(1)}22%{transform:scale(1.1) translateY(-7px);filter:brightness(1.4)}60%{transform:scale(1.04)}100%{transform:scale(1);filter:brightness(1)}}
@keyframes arcade-raid-fall{0%{transform:translateY(0) rotate(0) scale(1);opacity:1}30%{transform:translateY(10px) rotate(-6deg) scale(.98)}100%{transform:translateY(110px) rotate(-22deg) scale(.85);opacity:0}}
/* 士氣＝格狀槽（世界王破防槽語意：滿格＝可撐、歸零＝潰散） */
.arcade-raid-spirit{position:relative;z-index:2;margin-top:8px;padding:6px 11px;border-radius:10px;background:rgba(2,6,23,.5)}
.arcade-raid-spirit-row{display:flex;justify-content:space-between;font-size:10px;font-weight:900;margin-bottom:4px}
.arcade-raid-spirit-row span:first-child{color:#fca5a5}
.arcade-raid-spirit-row span:last-child{color:#94a3b8}
.arcade-raid-cells{display:flex;gap:3px}
.arcade-raid-cell{flex:1;height:10px;border-radius:3px;background:rgba(255,255,255,.09);transition:background .25s,box-shadow .25s}
.arcade-raid-cell.on{background:linear-gradient(90deg,#e05252,#ff8a5c)}
.arcade-raid-cell.low{animation:arcade-raid-cell-danger .8s ease-in-out infinite}
@keyframes arcade-raid-cell-danger{0%,100%{box-shadow:0 0 0 0 rgba(224,82,82,.5)}50%{box-shadow:0 0 12px 2px rgba(224,82,82,.9)}}
/* 漂浮傷害數字（世界王 raid-dmg 語意：命中弱點金色大字、普通白色、脫靶灰） */
.arcade-raid-float{position:absolute;left:50%;top:46%;z-index:6;pointer-events:none;font-weight:1000;text-shadow:0 2px 10px rgba(0,0,0,.9);animation:arcade-raid-dmg 1.05s cubic-bezier(.2,.9,.3,1) forwards}
.arcade-raid-float.weak{font-size:38px;color:#fde68a;-webkit-text-stroke:1.5px #b45309;animation:arcade-raid-dmg-weak 1.2s cubic-bezier(.15,.95,.25,1) forwards}
.arcade-raid-float.normal{font-size:21px;color:#cbd5e1}
.arcade-raid-float.graze{font-size:18px;color:#94a3b8}
@keyframes arcade-raid-dmg{0%{transform:translate(-50%,0) scale(.5);opacity:0}22%{transform:translate(-50%,-16px) scale(1.1);opacity:1}100%{transform:translate(-50%,-60px) scale(.9);opacity:0}}
@keyframes arcade-raid-dmg-weak{0%{transform:translate(-50%,0) scale(.35) rotate(-6deg);opacity:0}18%{transform:translate(-50%,-22px) scale(1.4) rotate(2deg);opacity:1}36%{transform:translate(-50%,-26px) scale(1.08)}100%{transform:translate(-50%,-86px) scale(1);opacity:0}}
/* 大招／打斷橫幅（血字掃過） */
.arcade-raid-banner{position:absolute;left:0;right:0;top:26%;z-index:7;text-align:center;pointer-events:none;font-size:44px;font-weight:1000;letter-spacing:6px;animation:arcade-raid-banner 1.5s cubic-bezier(.2,1.1,.3,1) forwards}
@keyframes arcade-raid-banner{0%{transform:scale(2.6);opacity:0;filter:blur(10px)}16%{transform:scale(1);opacity:1;filter:blur(0)}74%{transform:scale(1);opacity:1}100%{transform:scale(1.12);opacity:0}}
.arcade-raid-skill{position:absolute;left:0;right:0;top:18%;z-index:7;text-align:center;pointer-events:none;font-size:30px;font-weight:1000;letter-spacing:4px;animation:arcade-raid-skill 1.1s cubic-bezier(.15,.9,.25,1) forwards}
@keyframes arcade-raid-skill{0%{transform:translateX(46%) skewX(-14deg);opacity:0;filter:blur(6px)}22%{transform:translateX(0) skewX(0);opacity:1;filter:blur(0)}74%{transform:translateX(0);opacity:1}100%{transform:translateX(-16%);opacity:0}}
/* 隊友：世界王站位風（立繪大、送出亮） */
.arcade-raid-team{position:relative;z-index:2;display:flex;gap:8px;align-items:flex-end;justify-content:center;flex-wrap:wrap;row-gap:4px;margin-top:8px;padding:0 4px}
.arcade-raid-member{text-align:center;transition:transform .22s cubic-bezier(.3,1.3,.5,1),filter .22s}
.arcade-raid-member img{width:44px;height:44px;object-fit:contain;display:block;filter:drop-shadow(0 4px 8px rgba(0,0,0,.6));margin:0 auto}
.arcade-raid-member .name{font-size:9px;font-weight:1000;color:#cbd5e1;white-space:nowrap;text-shadow:0 1px 4px rgba(0,0,0,.9)}
.arcade-raid-member .name.me{color:#93c5fd}
.arcade-raid-member .st{font-size:8px;font-weight:900;margin-top:1px}
.arcade-raid-member.ready img{filter:drop-shadow(0 4px 8px rgba(0,0,0,.6)) drop-shadow(0 0 8px #58a05f)}
.arcade-raid-member.ready .st{color:#4ade80}
.arcade-raid-member.wait .st{color:#94a3b8}
/* ── 全隊路線揭曉過場 ── */
.arcade-route-reveal{position:fixed;inset:0;z-index:120;display:grid;place-items:center;overflow:hidden}
.arcade-route-reveal-bg{position:absolute;inset:0;background:radial-gradient(circle at 50% 42%,rgba(43,58,103,.55),rgba(18,22,38,.92) 72%);animation:arcadeRevealFade .35s ease both}
.arcade-route-reveal-inner{position:relative;text-align:center;padding:26px;max-width:320px;animation:arcadeRevealPop .45s cubic-bezier(.2,1.4,.4,1) both}
.arcade-route-reveal-kicker{font-size:12px;font-weight:1000;letter-spacing:2.5px;color:#e8d9b0;animation:arcadeRevealUp .5s .15s ease both}
.arcade-route-reveal-icon{font-size:74px;line-height:1;margin:14px 0 4px;filter:drop-shadow(0 10px 24px rgba(0,0,0,.45));animation:arcadeRevealIcon 1s cubic-bezier(.2,1.4,.4,1) both}
.arcade-route-reveal-title{font-size:30px;font-weight:1000;color:#fff;margin-top:6px;text-shadow:0 4px 14px rgba(0,0,0,.4);animation:arcadeRevealUp .5s .2s ease both}
.arcade-route-reveal-desc{font-size:14px;font-weight:800;color:#f3e6c8;margin-top:8px;line-height:1.5;animation:arcadeRevealUp .5s .3s ease both}
.arcade-route-reveal-log{margin-top:14px;padding:10px 14px;border-radius:14px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);font-size:13px;font-weight:900;color:#ffe9a8;line-height:1.6;animation:arcadeRevealUp .5s .42s ease both}
.arcade-route-reveal-boss{margin-top:12px;font-size:14px;font-weight:1000;color:#ff9d7a;letter-spacing:1px;text-shadow:0 0 18px rgba(255,120,70,.6);animation:arcadeRevealUp .5s .5s ease both}
@keyframes arcadeRevealFade{from{opacity:0}to{opacity:1}}
@keyframes arcadeRevealPop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}
@keyframes arcadeRevealIcon{0%{transform:scale(.2) rotate(-25deg);opacity:0}55%{transform:scale(1.25) rotate(6deg);opacity:1}100%{transform:scale(1) rotate(0)}}
@keyframes arcadeRevealUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
/* ── 王房前全螢幕過場（BossEntrance）：王現身＋招式名＋放射光 ── */
.arcade-boss-entrance{position:fixed;inset:0;z-index:130;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at 50% 36%,#3b1d3d 0%,#140a18 58%,#050208 100%)}
.arcade-boss-entrance-rays{position:absolute;inset:-45%;background:conic-gradient(from 0deg,transparent 0 13deg,rgba(224,82,82,.10) 13deg 15deg,transparent 15deg 29deg,rgba(251,191,36,.08) 29deg 31deg,transparent 31deg 45deg,rgba(168,85,247,.10) 45deg 47deg,transparent 47deg 61deg,rgba(224,82,82,.10) 61deg 63deg,transparent 63deg 77deg,rgba(251,191,36,.08) 77deg 79deg,transparent 79deg 93deg,rgba(168,85,247,.10) 93deg 95deg,transparent 95deg);animation:arcade-boss-rays 26s linear infinite}
@keyframes arcade-boss-rays{from{transform:rotate(0)}to{transform:rotate(360deg)}}
.arcade-boss-entrance-inner{position:relative;text-align:center;padding:20px;max-width:340px}
.arcade-boss-entrance-kicker{font-size:13px;font-weight:1000;letter-spacing:3px;color:#fca5a5;text-shadow:0 0 16px rgba(252,165,165,.6);animation:arcade-boss-kicker .5s .1s ease both}
@keyframes arcade-boss-kicker{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}
.arcade-boss-entrance-figure{position:relative;width:212px;height:212px;margin:16px auto 8px;display:grid;place-items:center;animation:arcade-boss-figure .8s cubic-bezier(.2,1.2,.35,1) both}
@keyframes arcade-boss-figure{0%{transform:scale(3.4);opacity:0;filter:blur(14px)}55%{transform:scale(.94);opacity:1;filter:blur(0)}100%{transform:scale(1)}}
.arcade-boss-entrance-figure img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 0 36px rgba(224,82,82,.8));animation:arcade-boss-breathe 2.2s ease-in-out .9s infinite}
@keyframes arcade-boss-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.035)}}
.arcade-boss-entrance-halo{position:absolute;inset:-28px;border-radius:50%;background:radial-gradient(circle,rgba(224,82,82,.42),transparent 66%);animation:arcade-boss-halo 1.6s ease-in-out infinite}
@keyframes arcade-boss-halo{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.1)}}
.arcade-boss-entrance-name{font-size:30px;font-weight:1000;color:#fde68a;letter-spacing:2px;text-shadow:0 0 22px rgba(253,230,138,.65),0 3px 10px rgba(0,0,0,.6);animation:arcade-boss-up .5s .55s ease both}
@keyframes arcade-boss-up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.arcade-boss-entrance-skill{display:inline-block;margin-top:10px;padding:8px 18px;border-radius:999px;background:rgba(224,82,82,.16);border:1.5px solid #f87171;color:#fecaca;font-size:16px;font-weight:1000;letter-spacing:2px;text-shadow:0 0 14px rgba(248,113,113,.7);animation:arcade-boss-skill .55s .75s cubic-bezier(.2,1.2,.4,1) both}
@keyframes arcade-boss-skill{from{opacity:0;transform:scale(1.6) skewX(-8deg)}to{opacity:1;transform:scale(1) skewX(0)}}
.arcade-boss-entrance-tag{margin-top:12px;font-size:13px;font-weight:900;color:#cbd5e1;letter-spacing:1px;animation:arcade-boss-up .5s .95s ease both}
`;

function mountArcadeCss() {
  if (document.querySelector("[data-arcade-visual-css]")) return;
  const s = document.createElement("style");
  s.setAttribute("data-arcade-visual-css", "1");
  s.textContent = ARCADE_CSS;
  document.head.appendChild(s);
}

export default function ArcadeApp() {
  const [phase, setPhase] = useState("loading"); // loading | onboarding | hub | adventure | team
  const [mode, setMode] = useState("forest"); // forest | moon | abyss
  const [teamCode, setTeamCode] = useState(""); // ?team= 掃 QR 直連的房間代碼
  const [teamSaved, setTeamSaved] = useState(null); // 斷線回鍋：存檔的 round/arrows
  const [duelCode, setDuelCode] = useState(""); // ?duel= 掃 QR 直連的競技場
  const [duelSaved, setDuelSaved] = useState(null); // PvP 全部暫存只在本機
  const [profile, setProfile] = useState(null);
  const [nickname, setNickname] = useState("");
  const [catId, setCatId] = useState(DEFAULT_CAT_ID);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    mountArcadeCss();
  }, []);

  // M1 雲端保存：離線→上線自動補傳
  useEffect(() => setupCloudSyncListener(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // M1：載入時同步雲端（離線降級為純本機）
      let saved = null;
      try {
        saved = await syncProfileOnLoad();
      } catch {
        saved = await loadVisitorProfile();
      }
      if (cancelled) return;
      const params = new URLSearchParams(window.location.search);
      const team = params.get("team") || "";
      const duel = params.get("duel") || "";
      if (isCompleteProfile(saved)) {
        setProfile(saved);
        // QR 直連優先：競技場與組隊共用 ?arcade，但各有自己的 5 位數參數。
        if (/^\d{5}$/.test(duel)) {
          setDuelCode(duel);
          setPhase("duel");
        } else if (/^\d{5}$/.test(team)) {
          setTeamCode(team);
          setPhase("team");
        } else {
          // 斷線恢復全部讀本機；PvP 不需要為了 resume 多讀一次 Firestore。
          const [savedDuel, savedRoom] = await Promise.all([loadCurrentDuelRoom(), loadCurrentTeamRoom()]);
          if (cancelled) return;
          if (savedDuel && /^\d{5}$/.test(savedDuel.roomCode || "")) {
            setDuelCode(savedDuel.roomCode);
            setDuelSaved(savedDuel);
            setPhase("duel");
          } else if (savedRoom && /^\d{5}$/.test(savedRoom.roomCode || "")) {
            setTeamCode(savedRoom.roomCode);
            setTeamSaved(savedRoom);
            setPhase("team");
          } else {
            setPhase("hub");
          }
        }
      } else {
        setPhase("onboarding");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  async function handleStart() {
    if (busy) return;
    setBusy(true);
    const p = buildNewProfile({ nickname, catId });
    await saveVisitorProfileWithCloud(p);
    setProfile(p);
    const params = new URLSearchParams(window.location.search);
    const duel = params.get("duel") || "";
    const team = params.get("team") || "";
    if (/^\d{5}$/.test(duel)) { setDuelCode(duel); setPhase("duel"); }
    else if (/^\d{5}$/.test(team)) { setTeamCode(team); setPhase("team"); }
    else setPhase("hub");
    setBusy(false);
  }

  async function handleReset() {
    if (!window.confirm("確定清除這支手機上的冒險進度嗎？此動作無法復原。")) return;
    await clearVisitorProfile();
    setProfile(null);
    setNickname("");
    setCatId(DEFAULT_CAT_ID);
    setPhase("onboarding");
  }

  async function handleSaveProfile(updated) {
    setProfile(updated);
    await saveVisitorProfileWithCloud(updated);
  }

  async function handleSaveProfileLocal(updated) {
    // PvP 生涯資料刻意只落在 IndexedDB/localStorage，不觸發 arcadeProfiles 雲端寫入。
    setProfile(updated);
    await saveVisitorProfile(updated);
  }

  let content = null;
  if (phase === "loading") {
    content = <ArcadeSplash />;
  } else if (phase === "onboarding") {
    content = (
      <ArcadeOnboarding
        nickname={nickname}
        onNickname={setNickname}
        catId={catId}
        onCat={setCatId}
        busy={busy}
        onStart={handleStart}
      />
    );
  } else if (phase === "adventure") {
    content = (
      <ArcadeAdventure
        mode={mode}
        profile={profile}
        onSave={handleSaveProfile}
        onExit={() => setPhase("hub")}
        onToast={setToast}
      />
    );
  } else if (phase === "shop") {
    content = (
      <ArcadeShop
        profile={profile}
        onSave={handleSaveProfile}
        onExit={() => setPhase("hub")}
        onToast={setToast}
      />
    );
  } else if (phase === "duel") {
    content = (
      <ArcadeDuel
        profile={profile}
        initialCode={duelCode || null}
        initialRound={duelSaved?.round || 0}
        initialArrows={duelSaved?.arrows || null}
        initialTargetId={duelSaved?.targetId || null}
        initialLocalMatch={duelSaved?.localMatch || null}
        initialSubmittedRound={duelSaved?.submittedRound || 0}
        initialSeenResolutionRound={duelSaved?.seenResolutionRound || 0}
        initialResultSaved={!!duelSaved?.resultSaved}
        onSaveLocal={handleSaveProfileLocal}
        onExit={() => { setDuelCode(""); setDuelSaved(null); setPhase("hub"); }}
      />
    );
  } else if (phase === "team") {
    content = (
      <ArcadeTeam
        profile={profile}
        initialCode={teamCode || null}
        initialRound={teamSaved?.round || 0}
        initialArrows={teamSaved?.arrows || null}
        onSave={handleSaveProfile}
        onExit={() => { setTeamCode(""); setTeamSaved(null); setPhase("hub"); }}
        onToast={setToast}
      />
    );
  } else {
    content = (
      <ArcadeHub
        profile={profile}
        onAdventure={(m) => { setMode(m || "forest"); setPhase("adventure"); }}
        onTeam={(code = "") => { setTeamCode(normalizeRoomCode(code)); setTeamSaved(null); setPhase("team"); }}
        onDuel={() => { setDuelCode(""); setDuelSaved(null); setPhase("duel"); }}
        onShop={() => setPhase("shop")}
        onReset={handleReset}
        onToast={setToast}
      />
    );
  }
  return (
    <>
      <div className={`arcade-visual-root phase-${phase}`}>
        <Suspense fallback={<ArcadeSplash />}>{content}</Suspense>
      </div>
      {toast && <div className="arcade-toast" role="status" aria-live="polite">{toast}</div>}
    </>
  );
}

// ── 掃 QR 後的首次入場：暱稱 ＋ 選同行貓（10～20 秒內開始）────────────────
function ArcadeOnboarding({ nickname, onNickname, catId, onCat, busy, onStart }) {
  const selectedCat = arcadeCatById(catId) || arcadeCatById(DEFAULT_CAT_ID);
  return (
    <ArcadeShell screen="onboarding">
        <ArcadeBrand subtitle="射箭場 · LOCAL QUEST" />
        <section className="arcade-attract" style={{ "--arcade-cat-image": `url(${selectedCat?.image})` }}>
          <div className="arcade-kicker">CAT ARCHERY ADVENTURE</div>
          <h1>拉弓，讓貓咪帶你進地下城</h1>
          <p>放下弓後輸入分數，把每一箭化成冒險能量。</p>
        </section>

        <section className="arcade-register-panel" aria-label="建立射手資料">
          <div className="arcade-field">
            <label className="arcade-label" htmlFor="arcade-nickname">你的射手暱稱</label>
            <input
              id="arcade-nickname"
              name="arcade-nickname"
              className="arcade-input"
              value={nickname}
              onChange={(e) => onNickname(e.target.value)}
              placeholder="例如：小勇者…"
              autoComplete="off"
              spellCheck={false}
              maxLength={10}
              onKeyDown={(e) => { if (e.key === "Enter") onStart(); }}
            />
          </div>
          <div className="arcade-field">
            <div className="arcade-label">選擇一隻同行貓</div>
            <div className="arcade-cat-grid">
              {ARCADE_CATS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`arcade-cat ${catId === c.id ? "sel" : ""}`}
                  onClick={() => onCat(c.id)}
                  aria-pressed={catId === c.id}
                >
                  <img src={c.image} alt={c.name} width="68" height="68" loading="lazy" />
                  <span className="arcade-cat-name">{c.name}</span>
                  <span className="arcade-cat-role">{c.role}</span>
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="arcade-primary"
            style={{ marginTop: 14 }}
            onClick={onStart}
            disabled={busy}
          >
            {busy ? "正在啟動機台…" : "選好貓咪，開始射箭 →"}
          </button>
        </section>

        <div className="arcade-local-note">💾 <strong>訪客進度保存在本裝置。</strong> 無痕模式或換手機不會帶走進度。</div>
    </ArcadeShell>
  );
}

// ── 第二次回來：歡迎回來，繼續冒險（不重新註冊）────────────────────
function ArcadeHub({ profile, onAdventure, onTeam, onDuel, onShop, onReset, onToast }) {
  const [teamJoinCode, setTeamJoinCode] = useState("");
  const dungeonCards = Object.values(ADVENTURE_TYPES);
  const cat = arcadeCatById(profile.selectedCat) || arcadeCatById(DEFAULT_CAT_ID);
  const stats = profile.statistics || {};
  const catMeta = profile.cats?.[cat?.id] || { level: 1 };
  const inventory = profile.inventory || {};
  const itemNames = ["fire_arrow", "cat_riceball", "catnip"]
    .filter((id) => (inventory[id] || 0) > 0)
    .map((id) => `${CHEST_ITEMS[id].icon} ${CHEST_ITEMS[id].name} ×${inventory[id]}`);
  return (
    <ArcadeShell screen="hub">
        <ArcadePlayerBar
          profile={profile}
          cat={cat}
          level={profile.catLevel || 1}
          xp={profile.xp || 0}
          xpMax={xpForLevel(profile.catLevel || 1)}
          progress={levelProgress(profile.catLevel || 1, profile.xp || 0)}
          onReset={onReset}
        />

        <section className="arcade-command-stage" style={{ "--arcade-cat-image": `url(${cat?.image})` }}>
          <div className="arcade-hub-kicker">WELCOME BACK</div>
          <h1>{profile.nickname}，下一箭準備好了</h1>
          <p>{cat?.name} 正守在森林入口。放下弓後再操作手機，繼續你的短回合冒險。</p>
          <button type="button" className="arcade-primary" onClick={() => onAdventure("forest")}>⚔️ 繼續冒險 →</button>
        </section>

        <DungeonCarousel dungeons={dungeonCards} onSelect={onAdventure} />

        <div className="arcade-section-heading">
          <div><span>ARCADE KEYS</span><h2>多人與補給</h2></div>
          <small>功能都保留在這裡</small>
        </div>
        <div className="arcade-utility-grid">
          <button type="button" className="arcade-utility-button" onClick={() => onTeam()}><b>🤝 和朋友組隊</b><span>建立合作地下城房間</span></button>
          <button type="button" className="arcade-utility-button" onClick={() => onDuel()}><b>⚔️ 射手競技場</b><span>2～8 人即時競技</span></button>
          <button type="button" className="arcade-utility-button" onClick={() => onShop()}><b>🛒 金幣商店</b><span>{profile.coins || 0} 枚金幣可使用</span></button>
          <button type="button" className="arcade-utility-button" onClick={() => onToast("冒險紀錄就在下方射手檔案") }><b>🏅 冒險紀錄</b><span>戰績、背包與成就</span></button>
        </div>

        <details className="arcade-details">
          <summary>🚪 輸入 5 位數房號</summary>
          <div className="arcade-details-body">
          <div className="arcade-label">已有房間？輸入 5 位數房號</div>
          <div className="arcade-row" style={{ alignItems: "stretch" }}>
            <input
              id="arcade-team-code"
              name="arcade-team-code"
              className="arcade-input"
              value={teamJoinCode}
              onChange={(e) => setTeamJoinCode(normalizeRoomCode(e.target.value))}
              placeholder="例如：58270…"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              maxLength={5}
              aria-label="組隊房間號碼"
              onKeyDown={(e) => {
                if (e.key === "Enter" && isValidRoomCode(teamJoinCode)) onTeam(teamJoinCode);
              }}
            />
            <button
              type="button"
              className="arcade-primary green"
              style={{ width: "auto", minWidth: 150, padding: "12px 14px" }}
              onClick={() => onTeam(teamJoinCode)}
              disabled={!isValidRoomCode(teamJoinCode)}
            >
              🚪 加入／返回
            </button>
          </div>
          <div className="arcade-copy" style={{ maxWidth: "none", marginTop: 8 }}>
            掃 QR 仍可直接加入。若戰鬥中重新整理或短暫斷線，原隊員也能輸入原本房號返回同一場；已開戰房不接受新玩家加入。
          </div>
          </div>
        </details>

        <details className="arcade-details">
          <summary>🐱 射手檔案、冒險紀錄與背包</summary>
          <div className="arcade-details-body">
        <div className="arcade-section-title">同行貓</div>
        <div className="arcade-card arcade-hub-cat">
          <img src={cat?.image} alt={cat?.name} width="96" height="96" loading="lazy" />
          <div style={{ flex: 1 }}>
            <div className="arcade-hub-cat-name">{cat?.name} <span style={{ fontSize: 13, color: "#8a6a3b" }}>Lv.{catMeta.level || 1}</span></div>
            <div className="arcade-hub-cat-motto">{cat?.motto}</div>
            <div style={{ marginTop: 8 }}>
              <span className="arcade-cat-role">{cat?.role}</span>
            </div>
          </div>
        </div>

        <div className="arcade-section-title">冒險紀錄</div>
        <div className="arcade-stats">
          <div className="arcade-stat"><div className="arcade-stat-v">{stats.battles || 0}</div><div className="arcade-stat-l">冒險次數</div></div>
          <div className="arcade-stat"><div className="arcade-stat-v">{stats.kills || 0}</div><div className="arcade-stat-l">擊敗怪物</div></div>
          <div className="arcade-stat"><div className="arcade-stat-v">🎯 {stats.xCount || 0}</div><div className="arcade-stat-l">X 內十</div></div>
          <div className="arcade-stat"><div className="arcade-stat-v">🪙 {profile.coins || 0}</div><div className="arcade-stat-l">冒險金幣</div></div>
        </div>

        <div className="arcade-section-title">⚔️ 射手競技場戰績（本機）</div>
        <div className="arcade-stats">
          <div className="arcade-stat"><div className="arcade-stat-v">{profile.duelStats?.matches || 0}</div><div className="arcade-stat-l">對戰場次</div></div>
          <div className="arcade-stat"><div className="arcade-stat-v">🏆 {profile.duelStats?.wins || 0}</div><div className="arcade-stat-l">勝場</div></div>
          <div className="arcade-stat"><div className="arcade-stat-v">{profile.duelStats?.bestScore || 0}</div><div className="arcade-stat-l">最佳回合</div></div>
        </div>

        {(stats.bestCombo || 1) > 1 && (
          <div className="arcade-note" style={{ marginTop: 12 }}>
            🔥 <strong>最佳 Combo：{comboLabel(stats.bestCombo)}</strong>（組隊冒險）
          </div>
        )}

        {/* 組隊三模式成就總覽（本機累計） */}
        <div className="arcade-section-title">🤝 組隊冒險成就</div>
        <div className="arcade-team-stats-grid">
          {TEAM_MODES.map((m) => {
            const t = { ...emptyTeamStats(), ...(profile.teamStats?.[m.id] || {}) };
            const has = t.wins > 0;
            return (
              <div key={m.id} className={`arcade-team-stat-card${has ? "" : " locked"}`}>
                <div className="arcade-team-stat-head">
                  <span className="arcade-team-stat-icon">{m.icon}</span>
                  <span className="arcade-team-stat-name">{m.name}</span>
                </div>
                {has ? (
                  <>
                    <div className="arcade-team-stat-row"><span>🏆 通關</span><b>{t.wins} 次</b></div>
                    <div className="arcade-team-stat-row"><span>🏅 Combo</span><b>{comboLabel(t.bestCombo)}</b></div>
                    <div className="arcade-team-stat-row"><span>⚡ 最速</span><b>{formatTeamDuration(t.bestTimeMs)}</b></div>
                  </>
                ) : (
                  <div className="arcade-team-stat-empty">還沒挑戰過 · 和朋友組隊打一場吧！</div>
                )}
              </div>
            );
          })}
        </div>

        {itemNames.length > 0 && (
          <div className="arcade-note" style={{ marginTop: 14 }}>
            🎒 <strong>背包：</strong>{itemNames.join(" · ")}
          </div>
        )}

        <div className="arcade-note blue" style={{ marginTop: 14 }}>
          💾 <strong>訪客進度保存在本裝置。</strong>清除瀏覽器資料、無痕模式或換手機，都會讓進度消失。想要雲端保存的功能會在之後開放。
        </div>
          </div>
        </details>

        <ArcadeActionDock note="進度會自動保存在這支手機">
          <button type="button" className="arcade-primary" onClick={() => onAdventure("forest")}>🏹 繼續冒險</button>
        </ArcadeActionDock>
    </ArcadeShell>
  );
}

function ArcadeSplash() {
  return (
    <div className="arcade-splash">
      <div className="arcade-splash-inner">
        <div className="arcade-splash-icon">🐱</div>
        <div className="arcade-splash-t">貓小隊冒險</div>
        <div className="arcade-splash-s">正在喚醒同行貓…</div>
      </div>
    </div>
  );
}
