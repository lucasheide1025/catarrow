// src/lib/archerDiagnosis.js
// 射手狀態判斷引擎（純前端計算，不寫 Firestore；符合 client-side 計算原則）
//
// 輸入：
//   arrows   逐箭資料（新→舊），每箭 { score, isX, isMiss, position?:{x,y} }
//            position 為靶面正規化座標（x 右+、y 下+，約 -1~1），僅 targetPlot 箭有值。
//   sessions 同條件場次（新→舊），含 metricsSnapshot：{ endStdDev, fatigueDelta, ... }
//
// 輸出：{ ready, sampleSize, state, overallScore, headline, dimensions:[
//          { key, label, icon, score(0-100), tier:'good'|'ok'|'warn', value, advice } ] }
//
// ⚠️ 門檻/建議措辭為教練可校正的 v1 草案，集中在本檔上方常數，方便日後調參。

const T = { good: "good", ok: "ok", warn: "warn" };

// 各維度判斷門檻（教練校正區）
const TH = {
  minSample: 12,          // 低於此箭數不出完整判斷
  miss: { good: 0.05, ok: 0.15 },      // 失箭率（越低越好）
  spread: { good: 0.15, ok: 0.30 },    // 群聚離散度 σ（越低越集中）
  bias: { good: 0.10, ok: 0.22 },      // 群心偏移量（越低越置中）
  endStd: { good: 2, ok: 4 },          // 回合波動（越低越穩）
  fatigue: { good: -0.2, ok: -0.5 },   // 後段差（>=good 無衰退；越負越掉）
  trend: 0.2,                          // 近30 vs 前30 進步/退步門檻
};

function mean(xs) { return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0; }
function clamp(v) { return Math.max(0, Math.min(100, v)); }
function metricsOf(session) { return session.metricsSnapshot || {}; }

// 方位（射手視角：x 右+、y 下+）
function directionLabel(cx, cy) {
  const parts = [];
  if (Math.abs(cy) >= 0.05) parts.push(cy > 0 ? "下" : "上");
  if (Math.abs(cx) >= 0.05) parts.push(cx > 0 ? "右" : "左");
  return parts.join("") || "置中";
}

export function buildArcherDiagnosis({ arrows = [], sessions = [] } = {}) {
  const sample = arrows.length;
  if (sample < TH.minSample) {
    return {
      ready: false, sampleSize: sample, state: "累積樣本中", overallScore: 0,
      headline: `目前 ${sample} 支逐箭資料，累積到 ${TH.minSample} 支以上就會產生完整狀態判斷。`,
      dimensions: [],
    };
  }

  const dims = [];
  const recent = arrows.slice(0, 30);
  const prev = arrows.slice(30, 60);

  // 1. 準度 —— 以失箭率為主、X 率為輔
  {
    const missRate = mean(recent.map(a => (a.isMiss ? 1 : 0)));
    const xRate = mean(recent.map(a => (a.isX ? 1 : 0)));
    const tier = missRate <= TH.miss.good ? T.good : missRate <= TH.miss.ok ? T.ok : T.warn;
    const score = clamp(100 - missRate * 400 + xRate * 30);
    const advice = tier === T.warn
      ? `失箭率 ${(missRate * 100).toFixed(0)}% 偏高：下一組放慢節奏、確認每一箭的出箭流程再放。`
      : tier === T.ok
        ? `命中穩定，X 率 ${(xRate * 100).toFixed(0)}%；把注意力放在瞄準微調可再往上。`
        : `命中優秀，X 率 ${(xRate * 100).toFixed(0)}%；維持現有節奏即可。`;
    dims.push({ key: "accuracy", label: "準度", icon: "🎯", score, tier, value: `M ${(missRate * 100).toFixed(0)}% · X ${(xRate * 100).toFixed(0)}%`, advice });
  }

  // 靶面座標（近 60 箭有座標者）
  const pts = arrows.slice(0, 60).map(a => a.position).filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y));
  if (pts.length >= 12) {
    const cx = mean(pts.map(p => p.x)), cy = mean(pts.map(p => p.y));
    const spread = Math.sqrt(mean(pts.map(p => (p.x - cx) ** 2 + (p.y - cy) ** 2)));
    const mag = Math.sqrt(cx * cx + cy * cy);

    // 2. 群聚精密度 —— 箭群離散度
    {
      const tier = spread <= TH.spread.good ? T.good : spread <= TH.spread.ok ? T.ok : T.warn;
      const score = clamp(100 - spread * 280);
      const advice = tier === T.warn
        ? `箭群偏散：先追求「一致的撒放與錨點」，穩定優先於分數。`
        : tier === T.ok
          ? `群聚中等，穩定射前流程可再收緊。`
          : `箭群集中，精密度很好。`;
      dims.push({ key: "precision", label: "群聚精密度", icon: "🔬", score, tier, value: `σ ${spread.toFixed(2)}`, advice });
    }

    // 3. 群心偏移 —— 系統性偏差方向
    {
      const dir = directionLabel(cx, cy);
      const tier = mag <= TH.bias.good ? T.good : mag <= TH.bias.ok ? T.ok : T.warn;
      const score = clamp(100 - mag * 350);
      const advice = tier === T.good
        ? `群心幾乎置中，無明顯系統性偏差。`
        : `群心整體偏${dir}（${mag.toFixed(2)}）：屬系統性偏差，可從瞄準基準與撒放方向著手微調——偏下常見於撒放放鬆不足、偏側常見於推弓/瞄準方向。`;
      dims.push({ key: "bias", label: "群心偏移", icon: "🧭", score, tier, value: `偏${dir}`, advice });
    }
  }

  // 4. 節奏穩定 —— 回合間波動
  const stdList = sessions.map(s => Number(metricsOf(s).endStdDev)).filter(Number.isFinite);
  if (stdList.length) {
    const avgStd = mean(stdList);
    const tier = avgStd <= TH.endStd.good ? T.good : avgStd <= TH.endStd.ok ? T.ok : T.warn;
    const score = clamp(100 - avgStd * 18);
    const advice = tier === T.warn
      ? `回合間分數落差大（波動 ${avgStd.toFixed(1)}）：固定「射前節奏＋呼吸」，讓每回合條件一致。`
      : tier === T.ok
        ? `回合波動中等，射前流程再一致些會更穩。`
        : `回合表現穩定。`;
    dims.push({ key: "consistency", label: "節奏穩定", icon: "🎼", score, tier, value: `波動 ${avgStd.toFixed(1)}`, advice });
  }

  // 5. 後段耐力 —— 後段 vs 前段
  const fatList = sessions.map(s => Number(metricsOf(s).fatigueDelta)).filter(Number.isFinite);
  if (fatList.length) {
    const avgFat = mean(fatList); // 負 = 後段掉
    const tier = avgFat >= TH.fatigue.good ? T.good : avgFat >= TH.fatigue.ok ? T.ok : T.warn;
    const score = clamp(100 + avgFat * 60);
    const advice = tier === T.warn
      ? `後段平均掉 ${Math.abs(avgFat).toFixed(2)}：體力/專注在收尾流失，可縮短單組箭數或加強最後幾箭的節奏。`
      : tier === T.ok
        ? `後段略有下滑，收尾時特別確認流程。`
        : `前後段穩定，耐力良好。`;
    dims.push({ key: "endurance", label: "後段耐力", icon: "🔋", score, tier, value: `後段差 ${avgFat.toFixed(2)}`, advice });
  }

  // 6. 近期趨勢 —— 近30 vs 前30 箭
  if (prev.length >= 15) {
    const delta = mean(recent.map(a => a.score)) - mean(prev.map(a => a.score));
    const tier = delta >= TH.trend ? T.good : delta <= -TH.trend ? T.warn : T.ok;
    const score = clamp(60 + delta * 80);
    const advice = tier === T.good
      ? `近 30 箭平均比前一組進步 ${delta.toFixed(2)}，維持節奏。`
      : tier === T.warn
        ? `近 30 箭平均下滑 ${Math.abs(delta).toFixed(2)}：先以穩定節奏完成一組，再調整瞄準。`
        : `近期表現持平。`;
    dims.push({ key: "trend", label: "近期趨勢", icon: "📈", score, tier, value: `Δ ${delta >= 0 ? "+" : ""}${delta.toFixed(2)}`, advice });
  }

  // 總評 —— 以最需要處理的維度當首要建議
  const warns = dims.filter(d => d.tier === T.warn);
  const oks = dims.filter(d => d.tier === T.ok);
  const priority = warns[0] || oks[0] || dims[0];
  const state = warns.length >= 2 ? "需要調整" : warns.length === 1 ? "小幅微調" : oks.length ? "狀態良好" : "狀態極佳";
  return {
    ready: true,
    sampleSize: sample,
    state,
    overallScore: Math.round(mean(dims.map(d => d.score))),
    headline: priority ? `${priority.icon} ${priority.advice}` : "資料累積中。",
    dimensions: dims,
  };
}
