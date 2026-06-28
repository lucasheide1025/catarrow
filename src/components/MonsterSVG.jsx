// src/components/MonsterSVG.jsx — 36 隻怪物 SVG 插圖
// 使用方式：<MonsterSVG id="ghost_1" size={80} />
import { useState, memo } from "react";

// ── 變體光暈效果（弱化=藍光、強化=紅橙光）───────────────
const VARIANT_GLOW = {
  weak:   <circle cx="50" cy="50" r="46" fill="none" stroke="#60a5fa" strokeWidth="3" opacity="0.5">
            <animate attributeName="opacity" values="0.3;0.7;0.3" dur="2s" repeatCount="indefinite" />
            <animate attributeName="r" values="44;48;44" dur="2.5s" repeatCount="indefinite" />
          </circle>,
  strong: <>
            <circle cx="50" cy="50" r="46" fill="none" stroke="#ef4444" strokeWidth="3" opacity="0.6">
              <animate attributeName="opacity" values="0.4;0.85;0.4" dur="1.5s" repeatCount="indefinite" />
              <animate attributeName="r" values="44;49;44" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx="50" cy="50" r="46" fill="none" stroke="#f97316" strokeWidth="1.5" opacity="0.3">
              <animate attributeName="opacity" values="0.2;0.5;0.2" dur="1.8s" repeatCount="indefinite" />
              <animate attributeName="r" values="46;52;46" dur="2.2s" repeatCount="indefinite" />
            </circle>
          </>,
};

const S = {
  // ══════════════════════════════════════════════
  // 鬼怪族
  // ══════════════════════════════════════════════

  ghost_1: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#1e1b4b"/>
    {/* 鬼魂身體 */}
    <path d="M50 14 C28 14 22 32 22 48 L22 70 Q28 80 34 70 Q40 80 46 70 Q52 80 58 70 Q64 80 70 70 Q76 80 78 70 L78 48 C78 32 72 14 50 14Z" fill="rgba(220,225,255,0.93)" stroke="#a5b4fc" strokeWidth="1.5"/>
    {/* 眼睛 */}
    <ellipse cx="40" cy="44" rx="7" ry="8" fill="#3730a3"/>
    <ellipse cx="60" cy="44" rx="7" ry="8" fill="#3730a3"/>
    <circle cx="42" cy="42" r="2.5" fill="rgba(255,255,255,0.7)"/>
    <circle cx="62" cy="42" r="2.5" fill="rgba(255,255,255,0.7)"/>
    {/* 憂鬱嘴巴 */}
    <path d="M40 57 Q50 52 60 57" stroke="#4338ca" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
    {/* 浮動小粒 */}
    <circle cx="18" cy="40" r="2.5" fill="#818cf8" opacity="0.5"/>
    <circle cx="82" cy="58" r="2" fill="#818cf8" opacity="0.4"/>
    <circle cx="76" cy="25" r="1.5" fill="#c7d2fe" opacity="0.5"/>
  </>),

  ghost_2: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#1e1b4b"/>
    {/* 旋渦身體 */}
    <path d="M50 20 C65 20 78 30 80 46 C82 62 72 78 56 82 C40 86 22 76 20 60 C18 44 28 22 50 20Z" fill="rgba(79,70,229,0.85)" stroke="#818cf8" strokeWidth="1.5"/>
    {/* 旋渦紋 */}
    <path d="M50 30 C60 32 66 40 64 50 C62 58 54 62 48 58" stroke="rgba(255,255,255,0.3)" strokeWidth="2" fill="none"/>
    <path d="M40 38 C44 30 54 28 60 36" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" fill="none"/>
    {/* 眼睛 */}
    <ellipse cx="40" cy="48" rx="8" ry="8" fill="#fbbf24"/>
    <ellipse cx="62" cy="46" rx="8" ry="8" fill="#fbbf24"/>
    <circle cx="42" cy="46" r="3.5" fill="#1c1917"/>
    <circle cx="64" cy="44" r="3.5" fill="#1c1917"/>
    <circle cx="43" cy="45" r="1.5" fill="rgba(255,255,255,0.8)"/>
    <circle cx="65" cy="43" r="1.5" fill="rgba(255,255,255,0.8)"/>
    {/* 詭異笑容 */}
    <path d="M36 63 Q50 74 64 63" stroke="#fbbf24" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <line x1="40" y1="63" x2="40" y2="69" stroke="#fbbf24" strokeWidth="1.5"/>
    <line x1="46" y1="66" x2="46" y2="73" stroke="#fbbf24" strokeWidth="1.5"/>
    <line x1="54" y1="66" x2="54" y2="73" stroke="#fbbf24" strokeWidth="1.5"/>
    <line x1="60" y1="63" x2="60" y2="69" stroke="#fbbf24" strokeWidth="1.5"/>
  </>),

  ghost_3: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#1e1b4b"/>
    {/* 林投葉背景 */}
    <path d="M15 80 Q25 40 35 20 Q38 15 40 20 Q42 35 30 60 Q25 72 20 85Z" fill="#14532d" opacity="0.7"/>
    <path d="M85 80 Q75 40 65 20 Q62 15 60 20 Q58 35 70 60 Q75 72 80 85Z" fill="#14532d" opacity="0.7"/>
    {/* 幽靈身體 */}
    <ellipse cx="50" cy="52" rx="20" ry="25" fill="rgba(200,210,255,0.15)" stroke="rgba(200,210,255,0.4)" strokeWidth="1"/>
    {/* 臉 */}
    <ellipse cx="50" cy="46" rx="17" ry="19" fill="rgba(230,235,255,0.9)"/>
    {/* 長髮 */}
    <path d="M33 38 Q20 55 22 78 Q26 90 30 85 Q28 68 36 52Z" fill="#14532d"/>
    <path d="M67 38 Q80 55 78 78 Q74 90 70 85 Q72 68 64 52Z" fill="#14532d"/>
    <path d="M36 30 Q28 20 24 30 Q22 42 33 46Z" fill="#166534"/>
    <path d="M64 30 Q72 20 76 30 Q78 42 67 46Z" fill="#166534"/>
    {/* 眼睛（空洞）*/}
    <ellipse cx="43" cy="44" rx="5" ry="6" fill="#0f172a"/>
    <ellipse cx="57" cy="44" rx="5" ry="6" fill="#0f172a"/>
    {/* 哭泣 */}
    <path d="M45 56 Q50 53 55 56" stroke="#94a3b8" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <line x1="43" y1="50" x2="41" y2="58" stroke="rgba(148,163,184,0.6)" strokeWidth="1.2"/>
    <line x1="57" y1="50" x2="59" y2="58" stroke="rgba(148,163,184,0.6)" strokeWidth="1.2"/>
  </>),

  ghost_4: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#1c0a0a"/>
    {/* 官帽 */}
    <rect x="28" y="12" width="44" height="8" rx="3" fill="#dc2626"/>
    <rect x="22" y="18" width="56" height="6" rx="2" fill="#b91c1c"/>
    <rect x="32" y="8" width="36" height="6" rx="3" fill="#dc2626"/>
    {/* 臉 */}
    <ellipse cx="50" cy="42" rx="20" ry="22" fill="#fef3c7"/>
    {/* 鬍鬚 */}
    <path d="M34 48 Q38 46 42 48" stroke="#78350f" strokeWidth="2" fill="none" strokeLinecap="round"/>
    <path d="M58 48 Q62 46 66 48" stroke="#78350f" strokeWidth="2" fill="none" strokeLinecap="round"/>
    <path d="M42 52 Q50 56 58 52" stroke="#78350f" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    {/* 眼睛（嚴肅）*/}
    <ellipse cx="42" cy="40" rx="5" ry="4" fill="#1c0a0a"/>
    <ellipse cx="58" cy="40" rx="5" ry="4" fill="#1c0a0a"/>
    <line x1="36" y1="35" x2="48" y2="37" stroke="#78350f" strokeWidth="2"/>
    <line x1="52" y1="37" x2="64" y2="35" stroke="#78350f" strokeWidth="2"/>
    {/* 紅袍 */}
    <path d="M30 64 Q22 90 20 100 L80 100 Q78 90 70 64 Q60 58 50 58 Q40 58 30 64Z" fill="#dc2626"/>
    {/* 金色邊 */}
    <path d="M30 64 Q35 62 50 60 Q65 62 70 64" stroke="#fbbf24" strokeWidth="1.5" fill="none"/>
    {/* 天平 */}
    <line x1="50" y1="64" x2="50" y2="75" stroke="#fbbf24" strokeWidth="2"/>
    <line x1="36" y1="72" x2="64" y2="72" stroke="#fbbf24" strokeWidth="1.5"/>
    <circle cx="36" cy="75" r="4" fill="none" stroke="#fbbf24" strokeWidth="1.5"/>
    <circle cx="64" cy="75" r="4" fill="none" stroke="#fbbf24" strokeWidth="1.5"/>
  </>),

  ghost_5: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#0f0f2e"/>
    {/* 藍色火焰光暈 */}
    <ellipse cx="50" cy="55" rx="38" ry="38" fill="rgba(59,130,246,0.15)"/>
    <ellipse cx="50" cy="55" rx="28" ry="28" fill="rgba(99,102,241,0.2)"/>
    {/* 火焰 */}
    <path d="M20 90 Q28 60 22 45 Q30 55 32 45 Q36 62 50 55 Q64 62 68 45 Q70 55 78 45 Q72 60 80 90Z" fill="rgba(59,130,246,0.6)"/>
    <path d="M26 90 Q32 65 28 52 Q34 60 36 52 Q40 65 50 60 Q60 65 64 52 Q66 60 72 52 Q68 65 74 90Z" fill="rgba(147,197,253,0.7)"/>
    {/* 狼頭 */}
    <path d="M50 20 Q62 20 68 28 L72 25 Q74 38 68 42 Q72 50 68 56 Q60 62 50 62 Q40 62 32 56 Q28 50 32 42 Q26 38 28 25 L32 28 Q38 20 50 20Z" fill="#e2e8f0"/>
    {/* 耳朵 */}
    <path d="M34 24 Q30 12 38 16 Q40 22 38 28Z" fill="#e2e8f0"/>
    <path d="M66 24 Q70 12 62 16 Q60 22 62 28Z" fill="#e2e8f0"/>
    <path d="M34 24 Q31 15 37 18 Q39 23 37 27Z" fill="#f87171"/>
    <path d="M66 24 Q69 15 63 18 Q61 23 63 27Z" fill="#f87171"/>
    {/* 眼睛（發光）*/}
    <ellipse cx="41" cy="40" rx="6" ry="6" fill="#fbbf24"/>
    <ellipse cx="59" cy="40" rx="6" ry="6" fill="#fbbf24"/>
    <circle cx="42" cy="40" r="3" fill="#1c0a0a"/>
    <circle cx="60" cy="40" r="3" fill="#1c0a0a"/>
    {/* 口鼻 */}
    <ellipse cx="50" cy="50" rx="8" ry="5" fill="#cbd5e1"/>
    <circle cx="46" cy="49" r="2" fill="#475569"/>
    <circle cx="54" cy="49" r="2" fill="#475569"/>
    <path d="M44 54 Q50 58 56 54" stroke="#475569" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
  </>),

  ghost_6: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#0a0a0a"/>
    {/* 地獄火光 */}
    <path d="M50 95 Q20 80 15 55 Q10 30 30 20 Q20 35 28 45 Q35 30 40 40 Q45 25 50 35 Q55 25 60 40 Q65 30 72 45 Q80 35 70 20 Q90 30 90 55 Q85 80 50 95Z" fill="#dc2626" opacity="0.8"/>
    <path d="M50 90 Q25 78 22 57 Q20 38 38 28 Q30 40 36 48 Q42 36 46 44 Q48 32 50 40 Q52 32 54 44 Q58 36 64 48 Q70 40 62 28 Q80 38 78 57 Q75 78 50 90Z" fill="#f97316" opacity="0.7"/>
    {/* 王冠 */}
    <path d="M25 30 L30 18 L38 26 L50 14 L62 26 L70 18 L75 30Z" fill="#fbbf24" stroke="#b45309" strokeWidth="1.5"/>
    <circle cx="30" cy="19" r="3" fill="#dc2626"/>
    <circle cx="50" cy="15" r="3" fill="#dc2626"/>
    <circle cx="70" cy="19" r="3" fill="#dc2626"/>
    {/* 臉 */}
    <ellipse cx="50" cy="55" rx="22" ry="24" fill="#7f1d1d"/>
    {/* 角 */}
    <path d="M30 38 Q24 22 28 18 Q34 30 36 42Z" fill="#1c1917"/>
    <path d="M70 38 Q76 22 72 18 Q66 30 64 42Z" fill="#1c1917"/>
    {/* 眼睛（多眼）*/}
    <ellipse cx="40" cy="52" rx="7" ry="7" fill="#fbbf24"/>
    <ellipse cx="60" cy="52" rx="7" ry="7" fill="#fbbf24"/>
    <circle cx="50" cy="46" rx="4" ry="4" fill="#fbbf24"/>
    <circle cx="41" cy="52" r="4" fill="#dc2626"/>
    <circle cx="61" cy="52" r="4" fill="#dc2626"/>
    <circle cx="50" cy="46" r="2.5" fill="#dc2626"/>
    {/* 嘴巴 */}
    <path d="M34 66 Q50 76 66 66" stroke="#fbbf24" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <line x1="40" y1="68" x2="40" y2="74" stroke="#fbbf24" strokeWidth="1.5"/>
    <line x1="50" y1="70" x2="50" y2="78" stroke="#fbbf24" strokeWidth="1.5"/>
    <line x1="60" y1="68" x2="60" y2="74" stroke="#fbbf24" strokeWidth="1.5"/>
  </>),

  // ══════════════════════════════════════════════
  // 山林族
  // ══════════════════════════════════════════════

  mountain_1: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#14532d"/>
    {/* 山豬身體 */}
    <ellipse cx="50" cy="60" rx="28" ry="22" fill="#92400e"/>
    {/* 頭 */}
    <ellipse cx="50" cy="38" rx="22" ry="20" fill="#a16207"/>
    {/* 鬃毛 */}
    <path d="M30 30 Q34 18 40 22 Q44 14 50 20 Q56 14 60 22 Q66 18 70 30" stroke="#1c1917" strokeWidth="4" fill="none" strokeLinecap="round"/>
    {/* 鼻子 */}
    <ellipse cx="50" cy="46" rx="10" ry="7" fill="#78350f"/>
    <circle cx="46" cy="46" r="3" fill="#0f172a"/>
    <circle cx="54" cy="46" r="3" fill="#0f172a"/>
    {/* 眼睛（憤怒）*/}
    <ellipse cx="38" cy="32" rx="5" ry="5" fill="#fbbf24"/>
    <ellipse cx="62" cy="32" rx="5" ry="5" fill="#fbbf24"/>
    <circle cx="39" cy="33" r="3" fill="#1c0a0a"/>
    <circle cx="63" cy="33" r="3" fill="#1c0a0a"/>
    <line x1="32" y1="26" x2="44" y2="30" stroke="#1c1917" strokeWidth="2.5"/>
    <line x1="56" y1="30" x2="68" y2="26" stroke="#1c1917" strokeWidth="2.5"/>
    {/* 象牙 */}
    <path d="M36 52 Q28 60 24 72 Q28 74 30 72 Q34 64 40 56Z" fill="#fef9c3" stroke="#ca8a04" strokeWidth="1"/>
    <path d="M64 52 Q72 60 76 72 Q72 74 70 72 Q66 64 60 56Z" fill="#fef9c3" stroke="#ca8a04" strokeWidth="1"/>
    {/* 腳 */}
    <rect x="30" y="78" width="8" height="14" rx="4" fill="#92400e"/>
    <rect x="62" y="78" width="8" height="14" rx="4" fill="#92400e"/>
  </>),

  mountain_2: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#14532d"/>
    {/* 蛇身盤捲 */}
    <path d="M50 88 Q22 82 18 60 Q14 38 30 28 Q20 40 24 54 Q28 68 42 72 Q38 60 42 48 Q44 36 50 32 Q56 36 58 48 Q62 60 58 72 Q72 68 76 54 Q80 40 70 28 Q86 38 82 60 Q78 82 50 88Z" fill="#166534" stroke="#15803d" strokeWidth="1.5"/>
    {/* 蛇鱗紋路 */}
    <path d="M34 50 Q42 46 50 50 Q58 46 66 50" stroke="rgba(0,0,0,0.3)" strokeWidth="1.5" fill="none"/>
    <path d="M30 62 Q42 56 50 62 Q58 56 70 62" stroke="rgba(0,0,0,0.3)" strokeWidth="1.5" fill="none"/>
    {/* 蛇頭 */}
    <path d="M50 14 Q62 14 68 22 Q72 32 68 40 Q64 48 50 50 Q36 48 32 40 Q28 32 32 22 Q38 14 50 14Z" fill="#15803d"/>
    {/* 毒牙 */}
    <path d="M42 50 L38 62 L42 60 L44 66 L48 52Z" fill="#fef9c3"/>
    <path d="M58 50 L62 62 L58 60 L56 66 L52 52Z" fill="#fef9c3"/>
    {/* 分叉舌頭 */}
    <path d="M48 50 L44 60 M52 50 L56 60 M48 50 L52 50" stroke="#dc2626" strokeWidth="2" fill="none" strokeLinecap="round"/>
    {/* 眼睛 */}
    <ellipse cx="40" cy="28" rx="6" ry="6" fill="#fbbf24"/>
    <ellipse cx="60" cy="28" rx="6" ry="6" fill="#fbbf24"/>
    <path d="M37 26 L43 30" stroke="#1c0a0a" strokeWidth="4" strokeLinecap="round"/>
    <path d="M57 26 L63 30" stroke="#1c0a0a" strokeWidth="4" strokeLinecap="round"/>
    {/* 菱形紋 */}
    <path d="M50 14 L56 22 L50 30 L44 22Z" fill="#166534" stroke="#14532d" strokeWidth="1" opacity="0.6"/>
  </>),

  mountain_3: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#14532d"/>
    {/* 狐狸臉 */}
    <path d="M50 20 Q68 20 74 38 Q78 54 68 66 Q60 74 50 74 Q40 74 32 66 Q22 54 26 38 Q32 20 50 20Z" fill="#c2410c"/>
    {/* 耳朵 */}
    <path d="M32 28 Q28 12 36 16 Q38 24 38 32Z" fill="#c2410c" stroke="#7c2d12" strokeWidth="1"/>
    <path d="M68 28 Q72 12 64 16 Q62 24 62 32Z" fill="#c2410c" stroke="#7c2d12" strokeWidth="1"/>
    <path d="M33 26 Q30 15 36 19 Q37 24 37 30Z" fill="#fca5a5"/>
    <path d="M67 26 Q70 15 64 19 Q63 24 63 30Z" fill="#fca5a5"/>
    {/* 臉部白斑 */}
    <ellipse cx="50" cy="52" rx="14" ry="16" fill="#fef9c3"/>
    {/* 眼睛 */}
    <ellipse cx="38" cy="42" rx="7" ry="7" fill="#fbbf24"/>
    <ellipse cx="62" cy="42" rx="7" ry="7" fill="#fbbf24"/>
    <circle cx="38" cy="42" r="4" fill="#1c0a0a"/>
    <circle cx="62" cy="42" r="4" fill="#1c0a0a"/>
    <circle cx="37" cy="41" r="2" fill="rgba(255,255,255,0.7)"/>
    <circle cx="61" cy="41" r="2" fill="rgba(255,255,255,0.7)"/>
    {/* 鼻子 */}
    <ellipse cx="50" cy="55" rx="4" ry="3" fill="#7c3aed"/>
    {/* 嘴巴 & 鬍鬚 */}
    <path d="M46 58 Q50 62 54 58" stroke="#7c2d12" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <line x1="28" y1="52" x2="44" y2="55" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2"/>
    <line x1="28" y1="57" x2="44" y2="57" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2"/>
    <line x1="56" y1="55" x2="72" y2="52" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2"/>
    <line x1="56" y1="57" x2="72" y2="57" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2"/>
    {/* 額頭符文 */}
    <path d="M46 30 L50 24 L54 30 L50 34Z" fill="#fbbf24" opacity="0.8"/>
  </>),

  mountain_4: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#1c2a20"/>
    {/* 山霧 */}
    <ellipse cx="50" cy="85" rx="42" ry="18" fill="rgba(255,255,255,0.12)"/>
    <ellipse cx="30" cy="90" rx="28" ry="12" fill="rgba(255,255,255,0.08)"/>
    <ellipse cx="72" cy="88" rx="22" ry="10" fill="rgba(255,255,255,0.08)"/>
    {/* 巨人身體（石頭質感）*/}
    <path d="M34 100 Q28 75 30 55 Q32 40 50 36 Q68 40 70 55 Q72 75 66 100Z" fill="#6b7280"/>
    {/* 頭 */}
    <ellipse cx="50" cy="32" rx="22" ry="22" fill="#78716c"/>
    {/* 石頭裂縫 */}
    <path d="M38 24 Q42 32 40 40" stroke="#44403c" strokeWidth="1.5" fill="none"/>
    <path d="M56 26 Q60 34 58 42" stroke="#44403c" strokeWidth="1.5" fill="none"/>
    <path d="M44 14 Q46 20 44 26" stroke="#57534e" strokeWidth="1" fill="none"/>
    {/* 眼睛（石頭空洞）*/}
    <ellipse cx="40" cy="30" rx="8" ry="7" fill="#292524"/>
    <ellipse cx="60" cy="30" rx="8" ry="7" fill="#292524"/>
    <ellipse cx="40" cy="30" rx="5" ry="4" fill="#a16207" opacity="0.7"/>
    <ellipse cx="60" cy="30" rx="5" ry="4" fill="#a16207" opacity="0.7"/>
    {/* 嘴巴 */}
    <path d="M36 44 Q50 50 64 44" stroke="#292524" strokeWidth="4" fill="none" strokeLinecap="round"/>
    {/* 手臂 */}
    <rect x="10" y="52" width="22" height="36" rx="11" fill="#78716c"/>
    <rect x="68" y="52" width="22" height="36" rx="11" fill="#78716c"/>
    {/* 苔蘚 */}
    <path d="M30 58 Q38 52 46 58 Q38 60 30 58Z" fill="#166534" opacity="0.7"/>
    <path d="M54 48 Q62 42 70 48 Q62 50 54 48Z" fill="#166534" opacity="0.7"/>
  </>),

  mountain_5: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#1c0a00"/>
    {/* 熊身體 */}
    <ellipse cx="50" cy="72" rx="34" ry="28" fill="#78350f"/>
    {/* 熊頭 */}
    <ellipse cx="50" cy="40" rx="30" ry="28" fill="#92400e"/>
    {/* 耳朵 */}
    <circle cx="26" cy="20" r="12" fill="#92400e"/>
    <circle cx="74" cy="20" r="12" fill="#92400e"/>
    <circle cx="26" cy="20" r="7" fill="#7c2d12"/>
    <circle cx="74" cy="20" r="7" fill="#7c2d12"/>
    {/* 臉部淡色 */}
    <ellipse cx="50" cy="46" rx="20" ry="16" fill="#a16207"/>
    {/* 眼睛（兇狠）*/}
    <ellipse cx="37" cy="34" rx="8" ry="8" fill="#fbbf24"/>
    <ellipse cx="63" cy="34" rx="8" ry="8" fill="#fbbf24"/>
    <circle cx="38" cy="35" r="5" fill="#0f172a"/>
    <circle cx="64" cy="35" r="5" fill="#0f172a"/>
    <circle cx="37" cy="34" r="2" fill="rgba(255,255,255,0.6)"/>
    <circle cx="63" cy="34" r="2" fill="rgba(255,255,255,0.6)"/>
    <line x1="28" y1="26" x2="46" y2="30" stroke="#1c1917" strokeWidth="3"/>
    <line x1="54" y1="30" x2="72" y2="26" stroke="#1c1917" strokeWidth="3"/>
    {/* 鼻子 */}
    <ellipse cx="50" cy="46" rx="7" ry="5" fill="#1c0a0a"/>
    {/* 嘴巴含牙 */}
    <path d="M32 56 Q50 66 68 56" stroke="#1c0a0a" strokeWidth="3" fill="none" strokeLinecap="round"/>
    <path d="M36 58 L36 66 Q38 70 40 66 L40 58" fill="#fef9c3"/>
    <path d="M46 60 L46 70 Q48 74 50 70 L50 60" fill="#fef9c3"/>
    <path d="M60 58 L60 66 Q62 70 64 66 L64 58" fill="#fef9c3"/>
    {/* 爪子 */}
    <path d="M16 72 Q20 60 24 68 Q26 62 28 70 Q30 62 32 70" stroke="#292524" strokeWidth="3" fill="none" strokeLinecap="round"/>
    <path d="M68 72 Q72 60 76 68 Q78 62 80 70 Q82 62 84 70" stroke="#292524" strokeWidth="3" fill="none" strokeLinecap="round"/>
  </>),

  mountain_6: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#052e16"/>
    {/* 蛟龍身體蜿蜒 */}
    <path d="M15 30 Q30 20 50 28 Q70 36 85 24 Q88 40 75 50 Q60 60 50 55 Q40 50 30 60 Q20 70 18 88" stroke="#065f46" strokeWidth="18" fill="none" strokeLinecap="round"/>
    <path d="M15 30 Q30 20 50 28 Q70 36 85 24 Q88 40 75 50 Q60 60 50 55 Q40 50 30 60 Q20 70 18 88" stroke="#047857" strokeWidth="14" fill="none" strokeLinecap="round"/>
    {/* 鱗片 */}
    <path d="M28 24 Q32 20 36 24 Q32 28 28 24Z" fill="#065f46"/>
    <path d="M48 30 Q52 26 56 30 Q52 34 48 30Z" fill="#065f46"/>
    <path d="M68 28 Q72 24 76 28 Q72 32 68 28Z" fill="#065f46"/>
    <path d="M60 52 Q64 48 68 52 Q64 56 60 52Z" fill="#065f46"/>
    <path d="M32 58 Q36 54 40 58 Q36 62 32 58Z" fill="#065f46"/>
    {/* 龍頭 */}
    <ellipse cx="82" cy="20" rx="16" ry="12" fill="#059669" transform="rotate(-20 82 20)"/>
    {/* 角 */}
    <path d="M74 10 Q70 2 72 8 Q76 6 76 12Z" fill="#fbbf24"/>
    <path d="M82 8 Q82 0 84 6 Q88 4 86 10Z" fill="#fbbf24"/>
    {/* 眼睛 */}
    <ellipse cx="80" cy="18" rx="5" ry="5" fill="#dc2626"/>
    <circle cx="80" cy="18" r="2.5" fill="#1c0a0a"/>
    <circle cx="79" cy="17" r="1.5" fill="rgba(255,255,255,0.7)"/>
    {/* 火焰 */}
    <path d="M92 18 Q100 12 96 22 Q104 18 98 28 Q106 24 100 35 Q90 32 92 18Z" fill="#fbbf24" opacity="0.9"/>
    <path d="M93 20 Q100 15 96 24 Q102 20 97 29" fill="#f97316" opacity="0.8"/>
  </>),

  // ══════════════════════════════════════════════
  // 毒蟲族
  // ══════════════════════════════════════════════

  insect_1: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#1c0800"/>
    {/* 觸角 */}
    <line x1="42" y1="18" x2="28" y2="6" stroke="#78350f" strokeWidth="2"/>
    <line x1="58" y1="18" x2="72" y2="6" stroke="#78350f" strokeWidth="2"/>
    <circle cx="28" cy="6" r="3" fill="#78350f"/>
    <circle cx="72" cy="6" r="3" fill="#78350f"/>
    {/* 身體段節 */}
    <ellipse cx="50" cy="28" rx="16" ry="14" fill="#92400e"/>
    <ellipse cx="50" cy="48" rx="20" ry="16" fill="#78350f"/>
    <ellipse cx="50" cy="68" rx="22" ry="16" fill="#92400e"/>
    {/* 段節分隔線 */}
    <path d="M30 40 Q50 36 70 40" stroke="#1c0a0a" strokeWidth="1.5" fill="none"/>
    <path d="M28 60 Q50 55 72 60" stroke="#1c0a0a" strokeWidth="1.5" fill="none"/>
    {/* 眼睛（複眼）*/}
    <ellipse cx="38" cy="26" rx="9" ry="9" fill="#dc2626"/>
    <ellipse cx="62" cy="26" rx="9" ry="9" fill="#dc2626"/>
    <path d="M32 24 Q38 22 44 26 Q40 28 32 26Z" fill="rgba(255,255,255,0.3)" opacity="0.6"/>
    <path d="M56 24 Q62 22 68 26 Q64 28 56 26Z" fill="rgba(255,255,255,0.3)" opacity="0.6"/>
    {/* 腿（6條）*/}
    <line x1="30" y1="46" x2="10" y2="38" stroke="#78350f" strokeWidth="2.5"/>
    <line x1="30" y1="52" x2="8" y2="52" stroke="#78350f" strokeWidth="2.5"/>
    <line x1="30" y1="58" x2="12" y2="66" stroke="#78350f" strokeWidth="2.5"/>
    <line x1="70" y1="46" x2="90" y2="38" stroke="#78350f" strokeWidth="2.5"/>
    <line x1="70" y1="52" x2="92" y2="52" stroke="#78350f" strokeWidth="2.5"/>
    <line x1="70" y1="58" x2="88" y2="66" stroke="#78350f" strokeWidth="2.5"/>
    {/* 翅膀 */}
    <ellipse cx="35" cy="44" rx="14" ry="8" fill="rgba(120,53,15,0.4)" stroke="#92400e" strokeWidth="1" transform="rotate(-20 35 44)"/>
    <ellipse cx="65" cy="44" rx="14" ry="8" fill="rgba(120,53,15,0.4)" stroke="#92400e" strokeWidth="1" transform="rotate(20 65 44)"/>
  </>),

  insect_2: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#1c1400"/>
    {/* 翅膀 */}
    <ellipse cx="30" cy="40" rx="22" ry="12" fill="rgba(250,204,21,0.2)" stroke="#ca8a04" strokeWidth="1.5" transform="rotate(-30 30 40)"/>
    <ellipse cx="70" cy="40" rx="22" ry="12" fill="rgba(250,204,21,0.2)" stroke="#ca8a04" strokeWidth="1.5" transform="rotate(30 70 40)"/>
    <ellipse cx="28" cy="52" rx="18" ry="9" fill="rgba(250,204,21,0.15)" stroke="#a16207" strokeWidth="1" transform="rotate(-20 28 52)"/>
    <ellipse cx="72" cy="52" rx="18" ry="9" fill="rgba(250,204,21,0.15)" stroke="#a16207" strokeWidth="1" transform="rotate(20 72 52)"/>
    {/* 腹部條紋 */}
    <ellipse cx="50" cy="65" rx="16" ry="24" fill="#fbbf24"/>
    <rect x="34" y="55" width="32" height="5" rx="2" fill="#1c1917"/>
    <rect x="34" y="64" width="32" height="5" rx="2" fill="#1c1917"/>
    <rect x="34" y="73" width="32" height="5" rx="2" fill="#1c1917"/>
    {/* 胸部 */}
    <ellipse cx="50" cy="45" rx="14" ry="12" fill="#a16207"/>
    {/* 頭 */}
    <ellipse cx="50" cy="28" rx="13" ry="13" fill="#ca8a04"/>
    {/* 複眼 */}
    <ellipse cx="38" cy="26" rx="9" ry="10" fill="#dc2626"/>
    <ellipse cx="62" cy="26" rx="9" ry="10" fill="#dc2626"/>
    <path d="M33 22 Q38 20 43 24 Q40 27 33 24Z" fill="rgba(255,255,255,0.25)"/>
    <path d="M57 22 Q62 20 67 24 Q64 27 57 24Z" fill="rgba(255,255,255,0.25)"/>
    {/* 大顎 */}
    <path d="M42 36 Q38 42 36 48" stroke="#1c1917" strokeWidth="3" fill="none" strokeLinecap="round"/>
    <path d="M58 36 Q62 42 64 48" stroke="#1c1917" strokeWidth="3" fill="none" strokeLinecap="round"/>
    {/* 刺針 */}
    <path d="M50 89 L46 100 L50 96 L54 100Z" fill="#ca8a04"/>
  </>),

  insect_3: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#1a0a20"/>
    {/* 蜈蚣長身體 */}
    {[0,1,2,3,4,5,6].map(i => (
      <ellipse key={i} cx={50} cy={22 + i * 11} rx={12 - i * 0.5} ry={6} fill={i%2===0 ? "#7c3aed" : "#6d28d9"}/>
    ))}
    {/* 節肢（每節兩對）*/}
    {[0,1,2,3,4,5].map(i => (<g key={i}>
      <line x1={38} y1={22+i*11} x2={18+i*3} y2={16+i*11} stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round"/>
      <line x1={62} y1={22+i*11} x2={82-i*3} y2={16+i*11} stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round"/>
    </g>))}
    {/* 頭 */}
    <ellipse cx="50" cy="16" rx="14" ry="12" fill="#7c3aed"/>
    {/* 觸角 */}
    <path d="M44 8 Q36 2 28 6" stroke="#a78bfa" strokeWidth="2" fill="none" strokeLinecap="round"/>
    <path d="M56 8 Q64 2 72 6" stroke="#a78bfa" strokeWidth="2" fill="none" strokeLinecap="round"/>
    <circle cx="28" cy="6" r="2.5" fill="#a78bfa"/>
    <circle cx="72" cy="6" r="2.5" fill="#a78bfa"/>
    {/* 眼睛 */}
    <circle cx="43" cy="14" r="5" fill="#fbbf24"/>
    <circle cx="57" cy="14" r="5" fill="#fbbf24"/>
    <circle cx="43" cy="14" r="3" fill="#1c0a0a"/>
    <circle cx="57" cy="14" r="3" fill="#1c0a0a"/>
    {/* 大牙 */}
    <path d="M44 22 L40 30 L44 28 L42 34" stroke="#c4b5fd" strokeWidth="2" fill="none" strokeLinecap="round"/>
    <path d="M56 22 L60 30 L56 28 L58 34" stroke="#c4b5fd" strokeWidth="2" fill="none" strokeLinecap="round"/>
  </>),

  insect_4: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#1c1400"/>
    {/* 毒刺尾巴 */}
    <path d="M50 20 Q68 20 76 32 Q82 44 76 56 Q70 62 64 58 Q70 50 66 42 Q60 36 50 36Z" fill="#ca8a04" stroke="#a16207" strokeWidth="1.5"/>
    <path d="M76 56 Q82 64 80 72 Q78 80 72 84 L68 88 Q66 80 70 76 Q72 68 68 62Z" fill="#fbbf24"/>
    <path d="M68 88 L72 98 L66 92Z" fill="#dc2626"/>
    {/* 身體 */}
    <ellipse cx="40" cy="62" rx="28" ry="22" fill="#fbbf24"/>
    {/* 頭 */}
    <ellipse cx="36" cy="42" rx="18" ry="16" fill="#ca8a04"/>
    {/* 王冠 */}
    <path d="M22 34 L26 22 L32 30 L36 18 L40 30 L46 22 L50 34" fill="#fbbf24" stroke="#a16207" strokeWidth="1.5"/>
    {/* 眼睛 */}
    <ellipse cx="30" cy="40" rx="6" ry="6" fill="#dc2626"/>
    <ellipse cx="44" cy="40" rx="6" ry="6" fill="#dc2626"/>
    <circle cx="30" cy="40" r="3" fill="#1c0a0a"/>
    <circle cx="44" cy="40" r="3" fill="#1c0a0a"/>
    {/* 蟹鉗 */}
    <path d="M10 54 Q4 44 10 38 Q16 44 14 52 Q18 46 22 52 Q20 58 10 54Z" fill="#ca8a04"/>
    <path d="M24 76 Q16 80 12 72 Q18 68 22 72 Q20 64 26 66 Q28 74 24 76Z" fill="#ca8a04"/>
    {/* 節腹分段 */}
    <path d="M12 62 Q40 56 68 62" stroke="#a16207" strokeWidth="1.5" fill="none"/>
    <path d="M14 70 Q40 65 66 70" stroke="#a16207" strokeWidth="1.5" fill="none"/>
  </>),

  insect_5: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#0a0010"/>
    {/* 蛛網背景 */}
    {[0,1,2,3,4,5].map(i => {
      const a = i * 60 * Math.PI / 180;
      return <line key={i} x1={50} y1={50} x2={50+44*Math.cos(a)} y2={50+44*Math.sin(a)} stroke="rgba(167,139,250,0.2)" strokeWidth="1"/>;
    })}
    {[14,26,38].map(r => <circle key={r} cx={50} cy={50} r={r} fill="none" stroke="rgba(167,139,250,0.15)" strokeWidth="1"/>)}
    {/* 8隻腳 */}
    {[[-45,-30],[-15,-50],[15,-50],[45,-30],[45,30],[15,50],[-15,50],[-45,30]].map(([dx,dy],i) => (
      <line key={i} x1={50} y1={50} x2={50+dx} y2={50+dy} stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round"/>
    ))}
    {/* 身體 */}
    <ellipse cx="50" cy="56" rx="16" ry="14" fill="#1c1917"/>
    <ellipse cx="50" cy="42" rx="12" ry="12" fill="#292524"/>
    {/* 紅沙漏 */}
    <path d="M44 56 L50 50 L56 56 L50 62Z" fill="#dc2626"/>
    {/* 王冠 */}
    <path d="M40 33 L43 25 L46 31 L50 23 L54 31 L57 25 L60 33" fill="#a78bfa" stroke="#7c3aed" strokeWidth="1.5"/>
    {/* 眼睛（8顆）*/}
    {[[44,40],[50,38],[56,40],[47,44],[53,44]].map(([x,y],i) => (
      <circle key={i} cx={x} cy={y} r={2.5} fill="#dc2626"/>
    ))}
  </>),

  insect_6: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#0c0010"/>
    {/* 神聖光芒 */}
    {[0,30,60,90,120,150,180,210,240,270,300,330].map(a => {
      const r = a * Math.PI / 180;
      return <line key={a} x1={50} y1={50} x2={50+46*Math.cos(r)} y2={50+46*Math.sin(r)} stroke="rgba(167,139,250,0.15)" strokeWidth="1"/>;
    })}
    {/* 翅膀 */}
    <path d="M50 44 Q30 24 10 30 Q14 50 32 56 Q42 50 50 44Z" fill="rgba(167,139,250,0.6)" stroke="#a78bfa" strokeWidth="1"/>
    <path d="M50 44 Q70 24 90 30 Q86 50 68 56 Q58 50 50 44Z" fill="rgba(167,139,250,0.6)" stroke="#a78bfa" strokeWidth="1"/>
    <path d="M50 56 Q28 52 14 64 Q22 76 40 72 Q46 64 50 56Z" fill="rgba(196,181,253,0.5)" stroke="#c4b5fd" strokeWidth="1"/>
    <path d="M50 56 Q72 52 86 64 Q78 76 60 72 Q54 64 50 56Z" fill="rgba(196,181,253,0.5)" stroke="#c4b5fd" strokeWidth="1"/>
    {/* 翅膀花紋 */}
    <circle cx="24" cy="42" r="6" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/>
    <circle cx="76" cy="42" r="6" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/>
    {/* 身體 */}
    <ellipse cx="50" cy="50" rx="8" ry="16" fill="#7c3aed"/>
    {/* 頭 */}
    <circle cx="50" cy="34" r="10" fill="#6d28d9"/>
    {/* 眼睛（發光）*/}
    <ellipse cx="44" cy="33" rx="4" ry="4" fill="#fbbf24"/>
    <ellipse cx="56" cy="33" rx="4" ry="4" fill="#fbbf24"/>
    <circle cx="44" cy="33" r="2" fill="white"/>
    <circle cx="56" cy="33" r="2" fill="white"/>
    {/* 觸角 */}
    <path d="M46 26 Q40 18 32 14" stroke="#c4b5fd" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <path d="M54 26 Q60 18 68 14" stroke="#c4b5fd" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <circle cx="32" cy="14" r="3" fill="#fbbf24"/>
    <circle cx="68" cy="14" r="3" fill="#fbbf24"/>
  </>),

  // ══════════════════════════════════════════════
  // 職場族
  // ══════════════════════════════════════════════

  workplace_1: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#1a0000"/>
    {/* 身體 */}
    <rect x="30" y="58" width="40" height="36" rx="8" fill="#6b7280"/>
    {/* 頭（紅臉）*/}
    <circle cx="50" cy="42" r="26" fill="#dc2626"/>
    {/* 憤怒眉毛 */}
    <path d="M30 30 Q38 26 46 30" stroke="#1c0a0a" strokeWidth="4" fill="none" strokeLinecap="round"/>
    <path d="M54 30 Q62 26 70 30" stroke="#1c0a0a" strokeWidth="4" fill="none" strokeLinecap="round"/>
    {/* 眼睛 */}
    <ellipse cx="38" cy="40" rx="7" ry="6" fill="#1c0a0a"/>
    <ellipse cx="62" cy="40" rx="7" ry="6" fill="#1c0a0a"/>
    <circle cx="40" cy="38" r="2.5" fill="rgba(255,255,255,0.7)"/>
    <circle cx="64" cy="38" r="2.5" fill="rgba(255,255,255,0.7)"/>
    {/* 嘴巴（開口叫）*/}
    <ellipse cx="50" cy="54" rx="12" ry="9" fill="#1c0a0a"/>
    <path d="M38 54 Q50 60 62 54" stroke="#fca5a5" strokeWidth="1.5" fill="none"/>
    {/* 指頭 */}
    <path d="M72 50 Q82 46 84 40 Q78 40 76 46Z" fill="#6b7280"/>
    <rect x="68" y="44" width="22" height="10" rx="5" fill="#6b7280"/>
    {/* 青筋 */}
    <path d="M32 26 Q34 22 38 24" stroke="#dc2626" strokeWidth="2" fill="none"/>
    <path d="M62 26 Q64 22 68 24" stroke="#dc2626" strokeWidth="2" fill="none"/>
  </>),

  workplace_2: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#1a1a1a"/>
    {/* 西裝身體 */}
    <path d="M24 100 Q22 72 28 60 Q34 52 50 52 Q66 52 72 60 Q78 72 76 100Z" fill="#374151"/>
    {/* 領帶 */}
    <path d="M46 52 L50 72 L54 52" fill="#dc2626"/>
    {/* 頭 */}
    <ellipse cx="50" cy="36" rx="22" ry="24" fill="#fde68a"/>
    {/* 頭髮 */}
    <path d="M28 30 Q32 14 50 12 Q68 14 72 30 Q68 18 50 18 Q32 18 28 30Z" fill="#1c1917"/>
    {/* 眉毛（皺眉）*/}
    <path d="M32 26 Q40 22 46 28" stroke="#1c1917" strokeWidth="3" fill="none" strokeLinecap="round"/>
    <path d="M54 28 Q60 22 68 26" stroke="#1c1917" strokeWidth="3" fill="none" strokeLinecap="round"/>
    {/* 眼睛 */}
    <ellipse cx="38" cy="34" rx="6" ry="6" fill="#1c0a0a"/>
    <ellipse cx="62" cy="34" rx="6" ry="6" fill="#1c0a0a"/>
    {/* 大叫嘴 */}
    <ellipse cx="50" cy="48" rx="14" ry="11" fill="#1c0a0a"/>
    <path d="M36 48 Q50 55 64 48" stroke="#dc2626" strokeWidth="1.5" fill="none"/>
    {/* 指手畫腳 */}
    <path d="M70 42 Q80 34 82 28 Q86 30 84 36 Q88 32 90 38 Q84 44 76 48Z" fill="#fde68a"/>
    {/* 汗滴 */}
    <path d="M26 22 Q24 16 28 20Z" fill="#3b82f6" opacity="0.7"/>
    <path d="M72 18 Q70 12 74 16Z" fill="#3b82f6" opacity="0.7"/>
  </>),

  workplace_3: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#1a0a00"/>
    {/* 圓胖身體 */}
    <ellipse cx="50" cy="74" rx="30" ry="26" fill="#374151"/>
    {/* 西裝扣子 */}
    <circle cx="50" cy="62" r="2.5" fill="#6b7280"/>
    <circle cx="50" cy="72" r="2.5" fill="#6b7280"/>
    {/* 鈔票 */}
    <rect x="14" y="58" width="22" height="12" rx="3" fill="#16a34a" transform="rotate(-20 14 58)"/>
    <rect x="66" y="55" width="22" height="12" rx="3" fill="#16a34a" transform="rotate(15 66 55)"/>
    <text x="16" y="69" fontSize="7" fill="#86efac" fontWeight="bold" transform="rotate(-20 16 69)">$$$</text>
    <text x="68" y="64" fontSize="7" fill="#86efac" fontWeight="bold" transform="rotate(15 68 64)">$$$</text>
    {/* 頭（大鼻子）*/}
    <circle cx="50" cy="40" r="26" fill="#fde68a"/>
    {/* 大鼻 */}
    <ellipse cx="50" cy="46" rx="10" ry="7" fill="#fca5a5"/>
    {/* 眼睛（狡猾）*/}
    <ellipse cx="36" cy="36" rx="7" ry="5" fill="#1c0a0a"/>
    <ellipse cx="64" cy="36" rx="7" ry="5" fill="#1c0a0a"/>
    <circle cx="38" cy="35" r="2.5" fill="rgba(255,255,255,0.8)"/>
    <circle cx="66" cy="35" r="2.5" fill="rgba(255,255,255,0.8)"/>
    {/* 貪婪笑容 */}
    <path d="M34 52 Q50 62 66 52" stroke="#1c0a0a" strokeWidth="3" fill="none" strokeLinecap="round"/>
    <path d="M38 54 L36 62 Q38 66 40 62 L40 54" fill="#fef9c3"/>
    <path d="M50 56 L48 64 Q50 68 52 64 L52 56" fill="#fef9c3"/>
    <path d="M62 54 L60 62 Q62 66 64 62 L64 54" fill="#fef9c3"/>
    {/* 雪茄 */}
    <rect x="58" y="50" width="20" height="4" rx="2" fill="#a16207"/>
    <circle cx="78" cy="52" r="4" fill="#f97316" opacity="0.8"/>
  </>),

  workplace_4: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#1a0000"/>
    {/* 駝背身體 */}
    <path d="M28 100 Q24 78 26 64 Q32 52 50 52 Q62 52 68 58 Q74 66 72 100Z" fill="#374151"/>
    {/* 頭（老婦）*/}
    <ellipse cx="46" cy="40" rx="20" ry="22" fill="#fde68a"/>
    {/* 白髮盤 */}
    <path d="M28 32 Q32 16 46 14 Q58 16 60 28 Q52 20 40 22 Q32 26 30 36Z" fill="#e2e8f0"/>
    <ellipse cx="44" cy="17" rx="12" ry="8" fill="#e2e8f0"/>
    {/* 皺紋 */}
    <path d="M30 38 Q34 36 38 38" stroke="#ca8a04" strokeWidth="1" fill="none"/>
    <path d="M32 44 Q36 42 40 44" stroke="#ca8a04" strokeWidth="1" fill="none"/>
    <path d="M52 38 Q56 36 60 38" stroke="#ca8a04" strokeWidth="1" fill="none"/>
    {/* 眼睛（算計）*/}
    <ellipse cx="36" cy="38" rx="5" ry="4" fill="#1c0a0a"/>
    <ellipse cx="56" cy="38" rx="5" ry="4" fill="#1c0a0a"/>
    {/* 邪惡笑容 */}
    <path d="M32 50 Q46 58 62 50" stroke="#1c0a0a" strokeWidth="2" fill="none" strokeLinecap="round"/>
    {/* 房契 */}
    <rect x="62" y="46" width="24" height="30" rx="3" fill="#fef9c3" stroke="#ca8a04" strokeWidth="1.5"/>
    <line x1="66" y1="54" x2="82" y2="54" stroke="#92400e" strokeWidth="1.5"/>
    <line x1="66" y1="60" x2="82" y2="60" stroke="#92400e" strokeWidth="1.5"/>
    <line x1="66" y1="66" x2="78" y2="66" stroke="#92400e" strokeWidth="1.5"/>
    <text x="68" y="50" fontSize="6" fill="#dc2626" fontWeight="bold">房</text>
    {/* 爪子 */}
    <path d="M24 62 Q18 56 16 50 Q20 50 22 56 Q24 52 26 58Z" fill="#fde68a"/>
  </>),

  workplace_5: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#0a0a14"/>
    {/* 禮帽 */}
    <rect x="28" y="8" width="44" height="4" rx="2" fill="#1c1917"/>
    <rect x="34" y="12" width="32" height="22" rx="3" fill="#1c1917"/>
    {/* 西裝（高瘦）*/}
    <path d="M32 100 Q28 70 30 56 Q36 48 50 48 Q64 48 70 56 Q72 70 68 100Z" fill="#1c1917"/>
    {/* 白襯衫 */}
    <path d="M43 52 L50 68 L57 52 L52 56 L50 64 L48 56Z" fill="#f8fafc"/>
    {/* 金色配件 */}
    <circle cx="52" cy="60" r="2" fill="#fbbf24"/>
    <circle cx="52" cy="68" r="2" fill="#fbbf24"/>
    {/* 頭 */}
    <ellipse cx="50" cy="34" rx="18" ry="20" fill="#fde68a"/>
    {/* 單片眼鏡 */}
    <circle cx="58" cy="32" r="8" fill="none" stroke="#fbbf24" strokeWidth="2"/>
    <line x1="66" y1="32" x2="70" y2="30" stroke="#fbbf24" strokeWidth="1.5"/>
    {/* 眼睛 */}
    <circle cx="40" cy="32" r="4" fill="#1c0a0a"/>
    <circle cx="58" cy="32" r="4" fill="#1c0a0a"/>
    <circle cx="41" cy="31" r="1.5" fill="rgba(255,255,255,0.7)"/>
    <circle cx="59" cy="31" r="1.5" fill="rgba(255,255,255,0.7)"/>
    {/* 鬍子 */}
    <path d="M36 42 Q42 40 46 42" stroke="#78716c" strokeWidth="2" fill="none" strokeLinecap="round"/>
    <path d="M36 46 Q44 44 48 46" stroke="#78716c" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    {/* 金幣 */}
    <circle cx="20" cy="70" r="8" fill="#fbbf24" stroke="#a16207" strokeWidth="1.5"/>
    <text x="16" y="74" fontSize="9" fill="#a16207" fontWeight="bold">$</text>
    <circle cx="82" cy="66" r="8" fill="#fbbf24" stroke="#a16207" strokeWidth="1.5"/>
    <text x="78" y="70" fontSize="9" fill="#a16207" fontWeight="bold">$</text>
  </>),

  workplace_6: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#0a0010"/>
    {/* 鈔票翅膀 */}
    <path d="M50 50 Q36 34 14 36 Q18 52 36 54 Q44 52 50 50Z" fill="rgba(22,163,74,0.7)" stroke="#16a34a" strokeWidth="1"/>
    <path d="M50 50 Q64 34 86 36 Q82 52 64 54 Q56 52 50 50Z" fill="rgba(22,163,74,0.7)" stroke="#16a34a" strokeWidth="1"/>
    <text x="18" y="48" fontSize="8" fill="#86efac" fontWeight="bold">$$$</text>
    <text x="62" y="48" fontSize="8" fill="#86efac" fontWeight="bold">$$$</text>
    {/* 身體（企業魔王）*/}
    <path d="M34 100 Q30 74 32 62 Q38 54 50 54 Q62 54 68 62 Q70 74 66 100Z" fill="#1c1917"/>
    {/* 領帶（紅）*/}
    <path d="M46 56 L50 76 L54 56" fill="#dc2626"/>
    {/* 頭 */}
    <ellipse cx="50" cy="40" rx="22" ry="22" fill="#292524"/>
    {/* $ 符號角 */}
    <path d="M30 28 Q26 16 28 12 Q34 20 32 28Z" fill="#fbbf24"/>
    <text x="22" y="22" fontSize="10" fill="#fbbf24" fontWeight="bold">$</text>
    <path d="M70 28 Q74 16 72 12 Q66 20 68 28Z" fill="#fbbf24"/>
    <text x="64" y="22" fontSize="10" fill="#fbbf24" fontWeight="bold">$</text>
    {/* 眼睛（紅色）*/}
    <ellipse cx="40" cy="38" rx="7" ry="7" fill="#dc2626"/>
    <ellipse cx="60" cy="38" rx="7" ry="7" fill="#dc2626"/>
    <circle cx="40" cy="38" r="4" fill="#1c0a0a"/>
    <circle cx="60" cy="38" r="4" fill="#1c0a0a"/>
    <circle cx="39" cy="37" r="1.5" fill="rgba(255,255,255,0.5)"/>
    <circle cx="59" cy="37" r="1.5" fill="rgba(255,255,255,0.5)"/>
    {/* 詭笑 */}
    <path d="M34 52 Q50 62 66 52" stroke="#dc2626" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <line x1="40" y1="54" x2="40" y2="60" stroke="#dc2626" strokeWidth="1.5"/>
    <line x1="50" y1="56" x2="50" y2="64" stroke="#dc2626" strokeWidth="1.5"/>
    <line x1="60" y1="54" x2="60" y2="60" stroke="#dc2626" strokeWidth="1.5"/>
  </>),

  // ══════════════════════════════════════════════
  // 考試族
  // ══════════════════════════════════════════════

  exam_1: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#1e1035"/>
    {/* 紙張身體 */}
    <path d="M24 18 L76 18 L82 24 L82 86 L18 86 L18 24Z" fill="#f8fafc" stroke="#c7d2fe" strokeWidth="1.5"/>
    <path d="M76 18 L76 24 L82 24Z" fill="#e0e7ff"/>
    {/* 橫線（考卷感）*/}
    <line x1="28" y1="36" x2="72" y2="36" stroke="#e2e8f0" strokeWidth="1.5"/>
    <line x1="28" y1="44" x2="72" y2="44" stroke="#e2e8f0" strokeWidth="1.5"/>
    <line x1="28" y1="52" x2="72" y2="52" stroke="#e2e8f0" strokeWidth="1.5"/>
    {/* 紅叉 */}
    <line x1="28" y1="60" x2="44" y2="76" stroke="#dc2626" strokeWidth="3" strokeLinecap="round"/>
    <line x1="44" y1="60" x2="28" y2="76" stroke="#dc2626" strokeWidth="3" strokeLinecap="round"/>
    {/* 分數 */}
    <text x="54" y="74" fontSize="16" fill="#dc2626" fontWeight="bold">59</text>
    {/* 惡魔臉 */}
    <circle cx="36" cy="28" r="5" fill="#1c1917"/>
    <circle cx="56" cy="28" r="5" fill="#1c1917"/>
    <circle cx="37" cy="27" r="2" fill="rgba(255,255,255,0.6)"/>
    <circle cx="57" cy="27" r="2" fill="rgba(255,255,255,0.6)"/>
    {/* 小角 */}
    <path d="M30 18 L28 10 L34 16Z" fill="#7c3aed"/>
    <path d="M60 18 L62 10 L56 16Z" fill="#7c3aed"/>
  </>),

  exam_2: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#1e1035"/>
    {/* 書本身體 */}
    <path d="M18 22 L82 22 L82 84 L18 84Z" fill="#1d4ed8"/>
    <path d="M50 22 L50 84" stroke="#1e40af" strokeWidth="3"/>
    {/* 書頁 */}
    <path d="M18 26 Q34 28 50 26" stroke="#dbeafe" strokeWidth="1" fill="none"/>
    <path d="M18 32 Q34 34 50 32" stroke="#dbeafe" strokeWidth="1" fill="none"/>
    <path d="M18 38 Q34 40 50 38" stroke="#dbeafe" strokeWidth="1" fill="none"/>
    <path d="M50 26 Q66 28 82 26" stroke="#dbeafe" strokeWidth="1" fill="none"/>
    <path d="M50 32 Q66 34 82 32" stroke="#dbeafe" strokeWidth="1" fill="none"/>
    <path d="M50 38 Q66 40 82 38" stroke="#dbeafe" strokeWidth="1" fill="none"/>
    {/* 書名標籤 */}
    <rect x="26" y="42" width="46" height="16" rx="3" fill="#1e40af"/>
    <text x="36" y="53" fontSize="9" fill="#fbbf24" fontWeight="bold">考試大全</text>
    {/* 嘴巴（牙齒）*/}
    <path d="M18 68 L82 68 L82 84 L18 84Z" fill="#1c0a0a"/>
    <line x1="28" y1="68" x2="28" y2="78" stroke="#fef9c3" strokeWidth="3"/>
    <line x1="40" y1="68" x2="40" y2="80" stroke="#fef9c3" strokeWidth="3"/>
    <line x1="52" y1="68" x2="52" y2="78" stroke="#fef9c3" strokeWidth="3"/>
    <line x1="64" y1="68" x2="64" y2="80" stroke="#fef9c3" strokeWidth="3"/>
    <line x1="76" y1="68" x2="76" y2="76" stroke="#fef9c3" strokeWidth="3"/>
    {/* 眼睛 */}
    <ellipse cx="34" cy="60" rx="8" ry="7" fill="#dc2626"/>
    <ellipse cx="66" cy="60" rx="8" ry="7" fill="#dc2626"/>
    <circle cx="34" cy="60" r="5" fill="#1c0a0a"/>
    <circle cx="66" cy="60" r="5" fill="#1c0a0a"/>
    <circle cx="33" cy="59" r="2" fill="rgba(255,255,255,0.6)"/>
    <circle cx="65" cy="59" r="2" fill="rgba(255,255,255,0.6)"/>
  </>),

  exam_3: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#1e1035"/>
    {/* 旋轉考卷 */}
    <rect x="28" y="20" width="36" height="46" rx="3" fill="#fef9c3" transform="rotate(-20 28 20)"/>
    <rect x="36" y="16" width="36" height="46" rx="3" fill="#f8fafc" transform="rotate(-8 36 16)"/>
    <rect x="28" y="22" width="36" height="46" rx="3" fill="#fef9c3" transform="rotate(15 28 22)"/>
    {/* 紅分數 */}
    <text x="44" y="50" fontSize="20" fill="#dc2626" fontWeight="bold">0分</text>
    {/* 驚恐臉 */}
    <ellipse cx="50" cy="68" rx="16" ry="14" fill="#fde68a"/>
    <ellipse cx="43" cy="64" rx="5" ry="6" fill="#1c0a0a"/>
    <ellipse cx="57" cy="64" rx="5" ry="6" fill="#1c0a0a"/>
    <circle cx="44" cy="62" r="2" fill="rgba(255,255,255,0.7)"/>
    <circle cx="58" cy="62" r="2" fill="rgba(255,255,255,0.7)"/>
    {/* 驚嚇嘴 */}
    <ellipse cx="50" cy="76" rx="8" ry="6" fill="#1c0a0a"/>
    {/* 汗水 */}
    <path d="M34 60 Q32 54 34 58Z" fill="#3b82f6"/>
    <path d="M66 58 Q68 52 66 56Z" fill="#3b82f6"/>
    <path d="M38 88 Q36 82 38 86Z" fill="#3b82f6"/>
  </>),

  exam_4: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#1e1035"/>
    {/* 答題卡身體 */}
    <rect x="18" y="14" width="52" height="76" rx="3" fill="#f8fafc" stroke="#c7d2fe" strokeWidth="1.5"/>
    {/* 答案圓圈 */}
    {[20,28,36,44,52,60,68].map(y => (
      <g key={y}>
        <circle cx="28" cy={y} r="4" fill="none" stroke="#94a3b8" strokeWidth="1"/>
        <circle cx="40" cy={y} r="4" fill="none" stroke="#94a3b8" strokeWidth="1"/>
        <circle cx="52" cy={y} r="4" fill="none" stroke="#94a3b8" strokeWidth="1"/>
        <circle cx="64" cy={y} r="4" fill="none" stroke="#94a3b8" strokeWidth="1"/>
      </g>
    ))}
    {/* 塗滿的格子 */}
    <circle cx="28" cy="20" r="4" fill="#1c0a0a"/>
    <circle cx="40" cy="28" r="4" fill="#1c0a0a"/>
    <circle cx="64" cy="36" r="4" fill="#1c0a0a"/>
    {/* 鉛筆武器 */}
    <rect x="72" y="8" width="12" height="70" rx="3" fill="#fbbf24"/>
    <path d="M72 78 L84 78 L78 92Z" fill="#fde68a"/>
    <path d="M76 88 L78 92 L80 88Z" fill="#1c1917"/>
    <rect x="72" y="8" width="12" height="8" rx="3" fill="#f87171"/>
    {/* 惡魔臉 */}
    <ellipse cx="32" cy="84" rx="14" ry="7" fill="#7c3aed" opacity="0.9"/>
    <circle cx="26" cy="84" r="3" fill="#fbbf24"/>
    <circle cx="38" cy="84" r="3" fill="#fbbf24"/>
    <path d="M24 90 Q32 94 40 90" stroke="#c4b5fd" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
  </>),

  exam_5: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#1e0a00"/>
    {/* 火焰底層 */}
    <path d="M50 95 Q20 80 16 55 Q12 30 28 18 Q22 34 28 44 Q34 30 38 42 Q44 24 50 38 Q56 24 62 42 Q66 30 72 44 Q78 34 72 18 Q88 30 84 55 Q80 80 50 95Z" fill="#dc2626" opacity="0.7"/>
    <path d="M50 90 Q24 76 22 55 Q20 36 34 26 Q28 38 34 46 Q40 34 44 44 Q46 30 50 40 Q54 30 56 44 Q60 34 66 46 Q72 38 66 26 Q80 36 78 55 Q76 76 50 90Z" fill="#f97316" opacity="0.7"/>
    {/* 古捲軸 */}
    <rect x="28" y="28" width="44" height="52" rx="2" fill="#fef3c7"/>
    <ellipse cx="28" cy="54" rx="8" ry="26" fill="#fde68a"/>
    <ellipse cx="72" cy="54" rx="8" ry="26" fill="#fde68a"/>
    {/* 文字線條 */}
    <line x1="34" y1="38" x2="66" y2="38" stroke="#ca8a04" strokeWidth="1.5"/>
    <line x1="34" y1="44" x2="66" y2="44" stroke="#ca8a04" strokeWidth="1.5"/>
    <line x1="34" y1="50" x2="66" y2="50" stroke="#ca8a04" strokeWidth="1.5"/>
    {/* 骷髏 */}
    <circle cx="50" cy="64" r="10" fill="#1c1917"/>
    <ellipse cx="50" cy="68" rx="7" ry="4" fill="#1c1917"/>
    <circle cx="45" cy="62" r="3" fill="#f8fafc"/>
    <circle cx="55" cy="62" r="3" fill="#f8fafc"/>
    <line x1="44" y1="70" x2="44" y2="74" stroke="#f8fafc" strokeWidth="1.5"/>
    <line x1="50" y1="70" x2="50" y2="74" stroke="#f8fafc" strokeWidth="1.5"/>
    <line x1="56" y1="70" x2="56" y2="74" stroke="#f8fafc" strokeWidth="1.5"/>
    {/* 鎖鏈 */}
    <path d="M20 48 Q16 54 20 60 Q24 54 20 48Z" fill="#6b7280" opacity="0.8"/>
    <path d="M80 48 Q84 54 80 60 Q76 54 80 48Z" fill="#6b7280" opacity="0.8"/>
  </>),

  exam_6: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#1e1035"/>
    {/* 惡魔校舍 */}
    <rect x="14" y="44" width="72" height="56" rx="0" fill="#374151"/>
    {/* 屋頂（惡魔角）*/}
    <path d="M14 44 L50 18 L86 44Z" fill="#4b5563"/>
    <path d="M22 44 L26 28 L30 44Z" fill="#dc2626"/>
    <path d="M70 44 L74 28 L78 44Z" fill="#dc2626"/>
    {/* 柱子 */}
    <rect x="18" y="60" width="6" height="40" fill="#4b5563"/>
    <rect x="76" y="60" width="6" height="40" fill="#4b5563"/>
    {/* 窗戶（眼睛）*/}
    <rect x="24" y="54" width="18" height="18" rx="2" fill="#dc2626"/>
    <rect x="58" y="54" width="18" height="18" rx="2" fill="#dc2626"/>
    <ellipse cx="33" cy="63" rx="6" ry="7" fill="#1c0a0a"/>
    <ellipse cx="67" cy="63" rx="6" ry="7" fill="#1c0a0a"/>
    <circle cx="34" cy="61" r="2.5" fill="rgba(255,255,255,0.5)"/>
    <circle cx="68" cy="61" r="2.5" fill="rgba(255,255,255,0.5)"/>
    {/* 門（嘴巴）*/}
    <path d="M36 100 L36 78 Q50 72 64 78 L64 100Z" fill="#1c0a0a"/>
    <line x1="40" y1="80" x2="40" y2="100" stroke="#fef9c3" strokeWidth="2"/>
    <line x1="50" y1="78" x2="50" y2="100" stroke="#fef9c3" strokeWidth="2"/>
    <line x1="60" y1="80" x2="60" y2="100" stroke="#fef9c3" strokeWidth="2"/>
    {/* 壓制的手臂 */}
    <rect x="2" y="62" width="14" height="8" rx="4" fill="#4b5563"/>
    <rect x="84" y="62" width="14" height="8" rx="4" fill="#4b5563"/>
  </>),

  // ══════════════════════════════════════════════
  // 西方怪物族
  // ══════════════════════════════════════════════

  temple_1: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#0f1a00"/>
    {/* 哥布林身體 */}
    <ellipse cx="50" cy="68" rx="20" ry="22" fill="#4d7c0f"/>
    {/* 頭 */}
    <ellipse cx="50" cy="36" rx="24" ry="26" fill="#65a30d"/>
    {/* 大耳朵 */}
    <ellipse cx="22" cy="32" rx="14" ry="20" fill="#65a30d"/>
    <ellipse cx="22" cy="32" rx="9" ry="14" fill="#4d7c0f"/>
    <ellipse cx="78" cy="32" rx="14" ry="20" fill="#65a30d"/>
    <ellipse cx="78" cy="32" rx="9" ry="14" fill="#4d7c0f"/>
    {/* 大眼睛 */}
    <ellipse cx="37" cy="32" rx="10" ry="11" fill="#fbbf24"/>
    <ellipse cx="63" cy="32" rx="10" ry="11" fill="#fbbf24"/>
    <circle cx="38" cy="33" r="7" fill="#1c0a0a"/>
    <circle cx="64" cy="33" r="7" fill="#1c0a0a"/>
    <circle cx="36" cy="31" r="3" fill="rgba(255,255,255,0.7)"/>
    <circle cx="62" cy="31" r="3" fill="rgba(255,255,255,0.7)"/>
    {/* 大鼻子 */}
    <ellipse cx="50" cy="46" rx="8" ry="6" fill="#4d7c0f"/>
    <circle cx="46" cy="46" r="2.5" fill="#1c0a0a"/>
    <circle cx="54" cy="46" r="2.5" fill="#1c0a0a"/>
    {/* 惡皮笑臉 */}
    <path d="M32 54 Q50 64 68 54" stroke="#1c0a0a" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <line x1="36" y1="56" x2="34" y2="62" stroke="#fef9c3" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="44" y1="58" x2="42" y2="66" stroke="#fef9c3" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="56" y1="58" x2="58" y2="66" stroke="#fef9c3" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="64" y1="56" x2="66" y2="62" stroke="#fef9c3" strokeWidth="2.5" strokeLinecap="round"/>
    {/* 小匕首 */}
    <rect x="66" y="48" width="4" height="20" rx="2" fill="#6b7280"/>
    <path d="M66 68 L70 68 L68 76Z" fill="#9ca3af"/>
  </>),

  temple_2: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#0a0a14"/>
    {/* 劍（交叉）*/}
    <rect x="22" y="46" width="56" height="6" rx="3" fill="#6b7280" transform="rotate(45 50 49)"/>
    <rect x="22" y="46" width="56" height="6" rx="3" fill="#6b7280" transform="rotate(-45 50 49)"/>
    <rect x="22" y="46" width="56" height="4" rx="2" fill="#9ca3af" transform="rotate(45 50 48)"/>
    <rect x="22" y="46" width="56" height="4" rx="2" fill="#9ca3af" transform="rotate(-45 50 48)"/>
    {/* 骷髏頭 */}
    <ellipse cx="50" cy="36" rx="22" ry="24" fill="#e2e8f0"/>
    {/* 下顎 */}
    <path d="M32 52 L36 62 Q50 68 64 62 L68 52Z" fill="#e2e8f0"/>
    {/* 眼洞 */}
    <ellipse cx="38" cy="33" rx="9" ry="10" fill="#1e1b4b"/>
    <ellipse cx="62" cy="33" rx="9" ry="10" fill="#1e1b4b"/>
    {/* 鼻洞 */}
    <path d="M46 44 Q50 42 54 44 Q52 48 50 48 Q48 48 46 44Z" fill="#1e1b4b"/>
    {/* 牙齒 */}
    <line x1="38" y1="56" x2="38" y2="64" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round"/>
    <line x1="46" y1="58" x2="46" y2="66" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round"/>
    <line x1="54" y1="58" x2="54" y2="66" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round"/>
    <line x1="62" y1="56" x2="62" y2="64" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round"/>
    {/* 裂縫 */}
    <path d="M42 24 Q44 30 42 36" stroke="#94a3b8" strokeWidth="1.5" fill="none"/>
    <path d="M58 22 Q60 28 58 34" stroke="#94a3b8" strokeWidth="1.5" fill="none"/>
  </>),

  temple_3: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#0a0014"/>
    {/* 月亮 */}
    <circle cx="72" cy="20" r="16" fill="#fef9c3"/>
    <circle cx="78" cy="16" r="12" fill="#1a0a30"/>
    {/* 狼人身體 */}
    <path d="M30 100 Q26 74 28 60 Q34 50 50 50 Q66 50 72 60 Q74 74 70 100Z" fill="#6b7280"/>
    {/* 頭 */}
    <path d="M50 16 Q66 16 74 28 Q80 44 72 58 Q64 68 50 68 Q36 68 28 58 Q20 44 26 28 Q34 16 50 16Z" fill="#78716c"/>
    {/* 尖耳朵 */}
    <path d="M30 24 Q26 8 34 12 Q36 20 38 28Z" fill="#78716c"/>
    <path d="M70 24 Q74 8 66 12 Q64 20 62 28Z" fill="#78716c"/>
    <path d="M31 24 Q28 12 34 14 Q35 20 37 26Z" fill="#a16207" opacity="0.5"/>
    <path d="M69 24 Q72 12 66 14 Q65 20 63 26Z" fill="#a16207" opacity="0.5"/>
    {/* 眼睛（月光）*/}
    <ellipse cx="38" cy="38" rx="8" ry="8" fill="#fbbf24"/>
    <ellipse cx="62" cy="38" rx="8" ry="8" fill="#fbbf24"/>
    <circle cx="39" cy="38" r="4" fill="#1c0a0a"/>
    <circle cx="63" cy="38" r="4" fill="#1c0a0a"/>
    {/* 口鼻 */}
    <path d="M38 52 Q50 58 62 52 Q58 64 50 68 Q42 64 38 52Z" fill="#1c1917"/>
    <ellipse cx="46" cy="52" rx="3" ry="2.5" fill="#292524"/>
    <ellipse cx="54" cy="52" rx="3" ry="2.5" fill="#292524"/>
    {/* 牙 */}
    <path d="M44 56 L42 64 Q44 66 46 62 L46 56" fill="#fef9c3"/>
    <path d="M56 56 L54 64 Q56 66 58 62 L58 56" fill="#fef9c3"/>
    {/* 爪痕 */}
    <path d="M14 40 Q22 36 18 44 Q16 48 14 40Z" fill="#6b7280"/>
    <path d="M86 40 Q78 36 82 44 Q84 48 86 40Z" fill="#6b7280"/>
  </>),

  temple_4: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#0a0010"/>
    {/* 披風 */}
    <path d="M18 100 Q14 68 20 50 Q26 40 36 38 L50 50 L64 38 Q74 40 80 50 Q86 68 82 100Z" fill="#1c1917"/>
    <path d="M20 100 Q16 68 22 50 L36 40 L50 52 L64 40 L78 50 Q84 68 80 100Z" fill="rgba(220,38,38,0.5)"/>
    {/* 白色臉 */}
    <ellipse cx="50" cy="34" rx="20" ry="22" fill="#f1f5f9"/>
    {/* 梳理的黑髮 */}
    <path d="M30 26 Q34 12 50 10 Q66 12 70 26 Q66 16 50 16 Q34 16 30 26Z" fill="#1c1917"/>
    <path d="M30 26 Q28 34 30 38 Q28 30 30 26Z" fill="#1c1917"/>
    <path d="M70 26 Q72 34 70 38 Q72 30 70 26Z" fill="#1c1917"/>
    {/* 眼睛（紅眼）*/}
    <ellipse cx="38" cy="32" rx="6" ry="6" fill="#dc2626"/>
    <ellipse cx="62" cy="32" rx="6" ry="6" fill="#dc2626"/>
    <circle cx="38" cy="32" r="3.5" fill="#1c0a0a"/>
    <circle cx="62" cy="32" r="3.5" fill="#1c0a0a"/>
    <circle cx="37" cy="31" r="1.5" fill="rgba(255,255,255,0.4)"/>
    <circle cx="61" cy="31" r="1.5" fill="rgba(255,255,255,0.4)"/>
    {/* 嘴巴（血牙）*/}
    <path d="M36 46 Q50 54 64 46" stroke="#1c0a0a" strokeWidth="2" fill="none" strokeLinecap="round"/>
    <path d="M44 48 L42 58 Q44 62 46 58 L46 48" fill="#fef9c3"/>
    <path d="M54 48 L52 58 Q54 62 56 58 L56 48" fill="#fef9c3"/>
    {/* 血跡 */}
    <path d="M44 60 Q46 66 44 70 Q42 66 44 60Z" fill="#dc2626"/>
    <path d="M56 60 Q58 66 56 70 Q54 66 56 60Z" fill="#dc2626"/>
    {/* 胸前十字 */}
    <line x1="50" y1="58" x2="50" y2="72" stroke="#94a3b8" strokeWidth="2"/>
    <line x1="44" y1="62" x2="56" y2="62" stroke="#94a3b8" strokeWidth="2"/>
  </>),

  temple_5: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#08001a"/>
    {/* 法杖 */}
    <rect x="74" y="10" width="6" height="80" rx="3" fill="#4b5563"/>
    <circle cx="77" cy="14" r="10" fill="#7c3aed"/>
    <circle cx="77" cy="14" r="6" fill="#a78bfa"/>
    <circle cx="77" cy="14" r="3" fill="rgba(255,255,255,0.9)"/>
    {/* 法袍 */}
    <path d="M22 100 Q18 72 20 56 Q26 44 50 44 Q74 44 66 56 Q68 72 64 100Z" fill="#2e1065"/>
    {/* 骷髏頭 */}
    <ellipse cx="46" cy="30" rx="20" ry="22" fill="#e2e8f0"/>
    {/* 王冠 */}
    <path d="M26 18 L30 6 L36 16 L46 4 L56 16 L62 6 L66 18" fill="#fbbf24" stroke="#a16207" strokeWidth="1.5"/>
    <circle cx="30" cy="7" r="3" fill="#7c3aed"/>
    <circle cx="46" cy="5" r="3" fill="#dc2626"/>
    <circle cx="62" cy="7" r="3" fill="#7c3aed"/>
    {/* 眼洞（發光）*/}
    <ellipse cx="36" cy="28" rx="9" ry="10" fill="#7c3aed"/>
    <ellipse cx="56" cy="28" rx="9" ry="10" fill="#7c3aed"/>
    <circle cx="36" cy="28" r="5" fill="#a78bfa"/>
    <circle cx="56" cy="28" r="5" fill="#a78bfa"/>
    <circle cx="36" cy="28" r="2" fill="rgba(255,255,255,0.9)"/>
    <circle cx="56" cy="28" r="2" fill="rgba(255,255,255,0.9)"/>
    {/* 鼻洞 */}
    <path d="M42 40 Q46 38 50 40 Q48 44 46 44 Q44 44 42 40Z" fill="#1e1b4b"/>
    {/* 牙齒 */}
    <path d="M30 48 Q46 56 62 48" stroke="#e2e8f0" strokeWidth="3" fill="none" strokeLinecap="round"/>
    <line x1="36" y1="50" x2="36" y2="58" stroke="#e2e8f0" strokeWidth="3" strokeLinecap="round"/>
    <line x1="46" y1="52" x2="46" y2="60" stroke="#e2e8f0" strokeWidth="3" strokeLinecap="round"/>
    <line x1="56" y1="50" x2="56" y2="58" stroke="#e2e8f0" strokeWidth="3" strokeLinecap="round"/>
    {/* 巫術光環 */}
    <circle cx="46" cy="30" r="24" fill="none" stroke="#7c3aed" strokeWidth="1" opacity="0.4" strokeDasharray="4 3"/>
  </>),

  temple_6: (id) => (<>
    <rect width="100" height="100" rx="14" fill="#0a0500"/>
    {/* 末日光暈 */}
    <ellipse cx="50" cy="60" rx="44" ry="36" fill="rgba(220,38,38,0.15)"/>
    {/* 翅膀 */}
    <path d="M50 44 Q30 20 6 22 Q10 46 30 52 Q40 50 50 44Z" fill="#292524"/>
    <path d="M50 44 Q70 20 94 22 Q90 46 70 52 Q60 50 50 44Z" fill="#292524"/>
    <path d="M50 44 Q28 26 8 28 Q14 44 32 50" stroke="#dc2626" strokeWidth="1" fill="none" opacity="0.5"/>
    <path d="M50 44 Q72 26 92 28 Q86 44 68 50" stroke="#dc2626" strokeWidth="1" fill="none" opacity="0.5"/>
    {/* 龍頭 */}
    <path d="M50 16 Q66 14 76 26 Q84 40 80 58 Q72 72 50 76 Q28 72 20 58 Q16 40 24 26 Q34 14 50 16Z" fill="#7c2d12"/>
    {/* 龍角（多角）*/}
    <path d="M30 22 Q24 8 28 4 Q34 14 34 22Z" fill="#fbbf24"/>
    <path d="M40 16 Q38 4 42 2 Q46 12 44 18Z" fill="#fbbf24"/>
    <path d="M70 22 Q76 8 72 4 Q66 14 66 22Z" fill="#fbbf24"/>
    <path d="M60 16 Q62 4 58 2 Q54 12 56 18Z" fill="#fbbf24"/>
    {/* 眼睛（漿紅）*/}
    <ellipse cx="36" cy="40" rx="9" ry="9" fill="#fbbf24"/>
    <ellipse cx="64" cy="40" rx="9" ry="9" fill="#fbbf24"/>
    <circle cx="36" cy="40" r="5" fill="#dc2626"/>
    <circle cx="64" cy="40" r="5" fill="#dc2626"/>
    <circle cx="35" cy="39" r="2.5" fill="rgba(255,255,255,0.5)"/>
    <circle cx="63" cy="39" r="2.5" fill="rgba(255,255,255,0.5)"/>
    {/* 火焰口 */}
    <path d="M28 60 Q50 68 72 60 Q68 72 50 78 Q32 72 28 60Z" fill="#1c0a0a"/>
    <path d="M76 46 Q88 38 96 50 Q88 60 80 56 Q86 44 76 46Z" fill="#fbbf24" opacity="0.9"/>
    <path d="M78 48 Q88 42 94 52 Q86 58 80 56 Q84 46 78 48Z" fill="#f97316"/>
  </>),
};

function MonsterSVG({ id, size = 80, className = "", variant }) {
  const fn = S[id];
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 100 100"
      className={className}
      style={{ display:"block", flexShrink:0 }}
    >
      {fn ? fn(id) : (
        <>
          <rect width="100" height="100" rx="14" fill="#1c1917"/>
          <text x="50" y="58" textAnchor="middle" fontSize="42">👾</text>
        </>
      )}
      {/* 變體光暈 overlay：弱化=藍光，強化=紅橙雙光環 */}
      {variant && VARIANT_GLOW[variant]}
    </svg>
  );
}
export default memo(MonsterSVG);

/**
 * 戰鬥畫面專用：有 /monsters/{id}.webp 就顯示圖片，否則退回 SVG
 * 圖片以原始比例顯示，不強制裁切為正方形
 */
export function MonsterBattleImg({ id, variant }) {
  const [failed, setFailed] = useState(false);
  if (!failed) {
    // 變體光暈用 CSS box-shadow 做在 <img> 外層容器上
    const glowShadow = variant === "weak"
      ? "0 0 18px rgba(96,165,250,0.5), 0 0 36px rgba(96,165,250,0.2)"
      : variant === "strong"
      ? "0 0 18px rgba(239,68,68,0.5), 0 0 36px rgba(239,68,68,0.25), 0 0 54px rgba(249,115,22,0.15)"
      : "none";
    return (
      <div style={{
        display:"inline-flex",
        position:"relative",
        filter: glowShadow !== "none" ? undefined : undefined,
      }}>
        <img
          src={`/monsters/${id}.webp`}
          alt={id || "monster"}
          onError={() => setFailed(true)}
          style={{
            display:"block",
            maxHeight:200, maxWidth:"100%",
            width:"auto", height:"auto",
            objectFit:"contain",
            imageRendering:"auto",
            boxShadow: glowShadow,
            borderRadius: 14,
            transition:"box-shadow 0.3s ease",
          }}
        />
      </div>
    );
  }
  return <MonsterSVG id={id} size={160} variant={variant}/>;
}
