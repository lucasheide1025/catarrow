import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";

export default function AdminArchery() {
  const { profile } = useAuth();
  const [room, setRoom] = useState("888");

  const base    = window.location.origin + "/archery-poc";
  const camUrl  = `${base}/camera-aruco.html?room=${room}`;
  const camManUrl = `${base}/camera.html?room=${room}`;
  const playerUrl = `${base}/player.html?room=${room}&memberId=${profile?.id || ""}`;
  const markersUrl = `${base}/markers-sheet.html`;

  return (
    <div className="p-4 max-w-lg mx-auto flex flex-col gap-5">
      <div>
        <div className="text-white font-black text-lg mb-1">🎯 AI 靶紙辨識系統</div>
        <div className="text-white/50 text-xs">A 手機架在靶前拍攝 → B 手機（射手）接收落點 → 確認後自動結算</div>
      </div>

      {/* 房號 */}
      <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="text-white/60 text-xs font-bold mb-2">房間號碼（AB 兩端輸入相同號碼）</div>
        <div className="flex gap-2 items-center">
          <input value={room} onChange={e => setRoom(e.target.value.replace(/\D/g, "").slice(0, 6) || "888")}
            className="bg-white/10 text-white font-black text-2xl text-center rounded-xl px-4 py-2 w-28 border border-white/20 outline-none"
            inputMode="numeric" maxLength={6} />
          <div className="text-white/40 text-xs">預設 888，最多 6 碼</div>
        </div>
      </div>

      {/* A 端 */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(124,58,237,0.4)" }}>
        <div className="px-4 py-2 font-black text-sm text-purple-300" style={{ background: "rgba(124,58,237,0.15)" }}>
          📷 A 端・攝影機（架在靶前那支手機開）
        </div>
        <div className="p-4 flex flex-col gap-2">
          <a href={camUrl} target="_blank" rel="noopener noreferrer"
            className="block w-full py-3 rounded-xl font-black text-center text-white active:scale-95 transition-transform"
            style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}>
            ⭐ ArUco 自動校正版（推薦）
          </a>
          <a href={camManUrl} target="_blank" rel="noopener noreferrer"
            className="block w-full py-3 rounded-xl font-black text-center text-white/80 active:scale-95 transition-transform"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}>
            手動點四角版（備用）
          </a>
          <div className="text-white/40 text-[11px]">① 連線 → ② 自動/手動校正四角 → ③ 設定背景 → ④ 開始偵測</div>
        </div>
      </div>

      {/* B 端 */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(34,197,94,0.4)" }}>
        <div className="px-4 py-2 font-black text-sm text-emerald-300" style={{ background: "rgba(34,197,94,0.12)" }}>
          🎯 B 端・射手（射手手上的手機開）
        </div>
        <div className="p-4 flex flex-col gap-2">
          <a href={playerUrl} target="_blank" rel="noopener noreferrer"
            className="block w-full py-3 rounded-xl font-black text-center text-gray-900 active:scale-95 transition-transform"
            style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)" }}>
            🎯 開啟射手端
          </a>
          <div className="text-white/40 text-[11px]">落點自動出現 → 可拖曳微調 → 確認本箭 → 整組結算寫入資料庫</div>
          <div className="text-emerald-300/60 text-[11px]">射手 ID：{profile?.id || "（未取得）"}</div>
        </div>
      </div>

      {/* 標記紙 */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(251,191,36,0.3)" }}>
        <div className="px-4 py-2 font-black text-sm text-amber-300" style={{ background: "rgba(251,191,36,0.08)" }}>
          🖨️ ArUco 標記紙
        </div>
        <div className="p-4 flex flex-col gap-2">
          <a href={markersUrl} target="_blank" rel="noopener noreferrer"
            className="block w-full py-3 rounded-xl font-black text-center text-amber-900 active:scale-95 transition-transform"
            style={{ background: "linear-gradient(135deg,#fbbf24,#d97706)" }}>
            🖨️ 列印四角標記
          </a>
          <div className="text-white/40 text-[11px]">貼在靶紙四個角（計分環外），護貝防潮。id 0=左上 / 1=右上 / 2=右下 / 3=左下</div>
        </div>
      </div>

      {/* 說明 */}
      <div className="rounded-xl p-4 text-white/40 text-[11px] leading-relaxed" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="font-black text-white/60 mb-1">技術說明</div>
        影像只在 A 手機瀏覽器內處理（純 Canvas，不過伺服器）。訊號走 PeerJS 公用 broker。
        結算時才一次寫入 Firestore，節省讀寫配額。射手端每箭確認時會顯示 RPG 傷害數字（10分=暴擊）。
      </div>
    </div>
  );
}
