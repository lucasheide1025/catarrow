// src/guild/useGuildRank.js
// 主線畫面（首頁／我的）要顯示「新公會階級」用的**唯讀**小 hook。
//
// ⚠️ 為什麼不直接用 db/guildDb.loadGuildProfile：
//    那支會連帶把 guildRewards / guildEquipCatalog / 商店資料整包拉進主線 bundle
//    （公會本體是 lazy-load 的，這樣等於白拆）。這裡只讀兩個欄位、只 import 純函數的
//    guildRank，把體積壓到最小。
//
// ⚠️ 方向性：主線只「讀」公會的展示用欄位，不寫、也不拿公會數值去算主線戰力（隔離鐵律）。
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { nextRankInfo } from "./domain/guildRank";

const EMPTY = { loading: true, rep: 0, ...nextRankInfo(0), expeditions: 0 };

// 模組級快取：首頁與「我的」都會用，切分頁又會重新掛載——沒有快取的話每切一次就打一發網路。
// 公會階級不是即時性資料（聲望只在遠征結算才變），5 分鐘綽綽有餘。
const TTL_MS = 5 * 60 * 1000;
const cache = new Map();   // memberId → { at, value }
const inflight = new Map();  // 同時掛載兩個元件時只發一次請求

// 遠征結算後呼叫，讓下次讀取拿到新聲望（公會畫面關閉時可用）
export function invalidateGuildRank(memberId) {
  cache.delete(memberId);
}

async function fetchRank(memberId) {
  const snap = await getDoc(doc(db, "guildProfiles", memberId));
  const d = snap.exists() ? snap.data() : null;
  const rep = Math.max(0, Math.floor(Number(d?.rep) || 0));
  return {
    loading: false,
    rep,
    ...nextRankInfo({ rep, rankId: d?.rankId }),
    // 沒有存檔＝還沒踏進公會，UI 可以據此顯示「尚未註冊」
    registered: !!d,
    expeditions: Math.max(0, Math.floor(Number(d?.expeditions?.total) || 0)),
  };
}

export function useGuildRank(memberId) {
  const cached = memberId && cache.get(memberId);
  const fresh = cached && Date.now() - cached.at < TTL_MS;
  const [state, setState] = useState(fresh ? cached.value : EMPTY);

  useEffect(() => {
    if (!memberId) { setState({ ...EMPTY, loading: false }); return; }
    const hit = cache.get(memberId);
    if (hit && Date.now() - hit.at < TTL_MS) { setState(hit.value); return; }

    let alive = true;
    const req = inflight.get(memberId) || fetchRank(memberId)
      .then(value => { cache.set(memberId, { at: Date.now(), value }); return value; })
      .finally(() => inflight.delete(memberId));
    inflight.set(memberId, req);
    req.then(v => { if (alive) setState(v); })
       .catch(() => { if (alive) setState({ ...EMPTY, loading: false }); });   // 讀不到就當見習，不擋畫面
    return () => { alive = false; };
  }, [memberId]);

  return state;
}
