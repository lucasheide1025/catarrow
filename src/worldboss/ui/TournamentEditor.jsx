// src/worldboss/ui/TournamentEditor.jsx
// 🏛️ 賽事編輯：教練填名稱／日期／賽別，逐列輸入選手與最終名次。
//
// ⚠️ 兩種用法共用同一張表：
//   ① 從今天的比賽模式匯入（成績已經在了，教練只要確認名次）
//   ② 完全手打（資格賽、對抗賽是在別的場地打的，只有紙本記分表）
//
// ⚠️ **最終名次一定是教練填的**。系統只給「照分數排」當一鍵預設——
//    對外賽事有淘汰賽制、有申訴、有並列，名次不見得等於總分排序。
import { useState } from "react";
import {
  TOURNAMENT_TYPES, applySuggestedRanks, normalizeEntry, suggestRanks, validateTournament,
} from "../domain/tournament";

const card = {
  background: "rgba(15,23,42,.92)", borderRadius: 12, padding: 12, marginBottom: 10,
  border: "1px solid rgba(148,163,184,.2)",
};
const label = { fontSize: 10.5, fontWeight: 900, color: "#c7d2fe", marginBottom: 5 };
const input = {
  width: "100%", padding: "8px 9px", borderRadius: 8, background: "#1e293b",
  border: "1px solid #334155", color: "#f8fafc", fontWeight: 800, fontSize: 13,
};

const blankEntry = () => normalizeEntry({ name: "", score: 0 }, Math.floor(Math.random() * 1e6));

export default function TournamentEditor({ initial = null, onSave, onCancel, onDelete }) {
  const [name, setName] = useState(initial?.name || "");
  const [date, setDate] = useState(initial?.date || new Date().toISOString().slice(0, 10));
  const [type, setType] = useState(initial?.type || "qualifier");
  const [note, setNote] = useState(initial?.note || "");
  const [rows, setRows] = useState(() =>
    (initial?.entries?.length ? initial.entries : [blankEntry(), blankEntry(), blankEntry()])
      .map((e, i) => normalizeEntry(e, i)));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const draft = { id: initial?.id, name, date, type, note, entries: rows, sourceMatchId: initial?.sourceMatchId };
  const check = validateTournament(draft);
  const withSuggest = suggestRanks(rows);

  const setRow = (key, field, value) =>
    setRows(rs => rs.map(r => (r.key === key ? { ...r, [field]: value } : r)));

  const save = async () => {
    setBusy(true); setMsg("");
    const res = await onSave(draft);
    setBusy(false);
    setMsg(res?.ok ? "✅ 已儲存" : `⚠️ ${res?.reason || "儲存失敗"}`);
  };

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <div style={card}>
        <div style={label}>比賽名稱</div>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="例：2026 台南市秋季射箭資格賽" style={input} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 9 }}>
          <div>
            <div style={label}>比賽日期</div>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={input} />
          </div>
          <div>
            <div style={label}>賽別</div>
            <select value={type} onChange={e => setType(e.target.value)} style={input}>
              {TOURNAMENT_TYPES.map(t => (
                <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ ...label, marginTop: 9 }}>備註（賽制、場地、距離…）</div>
        <input value={note} onChange={e => setNote(e.target.value)}
          placeholder="例：70m 122cm 靶・排名賽 72 箭" style={input} />
      </div>

      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ ...label, marginBottom: 0, flex: 1 }}>選手成績（{rows.length} 列）</div>
          <button type="button" onClick={() => setRows(applySuggestedRanks(rows))}
            style={{
              padding: "6px 11px", borderRadius: 8, cursor: "pointer",
              border: "1px solid #60a5fa", background: "rgba(96,165,250,.15)",
              color: "#bfdbfe", fontSize: 11, fontWeight: 900,
            }}>照分數排名次</button>
        </div>

        {/* ⚠️ 名次欄位放最前面：教練填的順序就是「第幾名是誰」 */}
        <div style={{
          display: "grid", gridTemplateColumns: "44px 1fr 62px 52px 44px 36px",
          gap: 5, fontSize: 9, color: "#64748b", fontWeight: 800, marginBottom: 4, padding: "0 2px",
        }}>
          <span>名次</span><span>姓名</span><span>總分</span><span>箭數</span><span>X</span><span />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {withSuggest.map(r => (
            <div key={r.key} style={{
              display: "grid", gridTemplateColumns: "44px 1fr 62px 52px 44px 36px", gap: 5,
            }}>
              <input value={r.rank || ""} onChange={e => setRow(r.key, "rank", e.target.value)}
                placeholder={String(r.suggestedRank)} inputMode="numeric"
                style={{
                  ...input, padding: "7px 4px", textAlign: "center",
                  color: r.rank ? "#fde68a" : "#64748b",
                  borderColor: r.rank === 1 ? "#fbbf24" : "#334155",
                }} />
              <input value={r.name} onChange={e => setRow(r.key, "name", e.target.value)}
                placeholder="選手姓名" style={{ ...input, padding: "7px 8px" }} />
              <input value={r.score || ""} onChange={e => setRow(r.key, "score", e.target.value)}
                inputMode="numeric" placeholder="0"
                style={{ ...input, padding: "7px 4px", textAlign: "center" }} />
              <input value={r.arrows || ""} onChange={e => setRow(r.key, "arrows", e.target.value)}
                inputMode="numeric" placeholder="0"
                style={{ ...input, padding: "7px 4px", textAlign: "center", fontSize: 12 }} />
              <input value={r.xCount || ""} onChange={e => setRow(r.key, "xCount", e.target.value)}
                inputMode="numeric" placeholder="0"
                style={{ ...input, padding: "7px 4px", textAlign: "center", fontSize: 12 }} />
              <button type="button" onClick={() => setRows(rs => rs.filter(x => x.key !== r.key))}
                style={{
                  borderRadius: 8, border: "1px solid rgba(248,113,113,.4)",
                  background: "transparent", color: "#f87171",
                  fontSize: 14, fontWeight: 900, cursor: "pointer",
                }}>×</button>
            </div>
          ))}
        </div>

        <button type="button" onClick={() => setRows(rs => [...rs, blankEntry()])}
          style={{
            width: "100%", marginTop: 8, padding: "9px 0", borderRadius: 9,
            border: "1px dashed rgba(148,163,184,.4)", background: "transparent",
            color: "#94a3b8", fontSize: 12, fontWeight: 900, cursor: "pointer",
          }}>＋ 新增一列</button>
      </div>

      {(check.errors.length > 0 || check.warnings.length > 0 || msg) && (
        <div style={{
          ...card,
          border: `1px solid ${check.errors.length ? "rgba(248,113,113,.5)" : "rgba(251,191,36,.45)"}`,
        }}>
          {check.errors.map(x => (
            <div key={x} style={{ fontSize: 11.5, color: "#fecaca", fontWeight: 800 }}>⚠️ {x}</div>
          ))}
          {check.warnings.map(x => (
            <div key={x} style={{ fontSize: 11.5, color: "#fde68a", fontWeight: 800 }}>💡 {x}</div>
          ))}
          {msg && <div style={{ fontSize: 12, color: "#bbf7d0", fontWeight: 900 }}>{msg}</div>}
        </div>
      )}

      <div style={{ display: "flex", gap: 7 }}>
        <button type="button" onClick={onCancel} style={{
          padding: "12px 16px", borderRadius: 10, border: "1px solid #475569",
          background: "transparent", color: "#cbd5e1", fontWeight: 900, fontSize: 13, cursor: "pointer",
        }}>返回</button>
        <button type="button" onClick={save} disabled={busy || !check.ok} style={{
          flex: 1, padding: "12px 0", borderRadius: 10, border: "none",
          background: check.ok ? "linear-gradient(135deg,#f59e0b,#b45309)" : "#1e293b",
          color: check.ok ? "#fff" : "#64748b",
          fontWeight: 900, fontSize: 14,
          cursor: check.ok && !busy ? "pointer" : "not-allowed",
        }}>{busy ? "儲存中…" : initial?.id ? "儲存修改" : "建立賽事"}</button>
        {initial?.id && onDelete && (
          <button type="button" onClick={onDelete} style={{
            padding: "12px 14px", borderRadius: 10, border: "1px solid #f87171",
            background: "transparent", color: "#f87171", fontWeight: 900, fontSize: 13, cursor: "pointer",
          }}>刪除</button>
        )}
      </div>
    </div>
  );
}
