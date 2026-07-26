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

export function useGuildRank(memberId) {
  const [state, setState] = useState(EMPTY);

  useEffect(() => {
    if (!memberId) { setState({ ...EMPTY, loading: false }); return; }
    let alive = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "guildProfiles", memberId));
        const d = snap.exists() ? snap.data() : null;
        const rep = Math.max(0, Math.floor(Number(d?.rep) || 0));
        if (alive) {
          setState({
            loading: false,
            rep,
            ...nextRankInfo(rep),
            // 沒有存檔＝還沒踏進公會，UI 可以據此顯示「尚未註冊」
            registered: !!d,
            expeditions: Math.max(0, Math.floor(Number(d?.expeditions?.total) || 0)),
          });
        }
      } catch {
        if (alive) setState({ ...EMPTY, loading: false });   // 讀不到就當見習，不擋畫面
      }
    })();
    return () => { alive = false; };
  }, [memberId]);

  return state;
}
