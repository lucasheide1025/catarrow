// src/components/admin/BillingSystem.jsx
import { useState, useEffect } from "react";
import {
  addBillingRecord, deleteBillingRecord,
  subscribeBillingRecords, getMembersForBilling, getTodayCheckinMembers,
} from "../../lib/db";

// 匯出給 AdminBooking.jsx 的結帳串接用（避免另外定義一份價格表，見
// .trellis/tasks/07-10-booking-billing-integration/prd.md）
// 2小時方案（07-10-booking-billing-integration 後續）：收費不變＝直接是1小時的2倍，
// 沒有另外的折扣價（3小時「2送1」才有折扣，2小時單純是「多留1小時、多收1小時的錢」）。
export const PLANS = [
  { id: "自一", price: 200 },
  { id: "自二", price: 400 },
  { id: "自三", price: 400 },
  { id: "單一", price: 300 },
  { id: "單二", price: 600 },
  { id: "單三", price: 600 },
  { id: "學一", price: 200 },
  { id: "學二", price: 400 },
  { id: "學三", price: 400 },
];
export const PAY_METHODS = ["現金", "轉帳", "月卡"];
export const EARLY_BIRD_MAX  = 123;
export const EARLY_BIRD_DISC = 50;

const today = () => new Date().toISOString().slice(0, 10);
const currentYear  = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const YEARS = Array.from({ length: 4 }, (_, i) => currentYear - i);

export default function BillingSystem({ profile }) {
  const [tab, setTab] = useState("add");

  // ── 記帳表單 ──────────────────────────────────────────────
  const [memberQuery,       setMemberQuery]       = useState("");
  const [selectedMember,   setSelectedMember]   = useState(null);
  const [memberSuggestions,setMemberSuggestions] = useState([]);
  const [allMembers,        setAllMembers]        = useState([]);
  const [plan,     setPlan]     = useState(null);
  const [payMethod,setPayMethod]= useState("現金");
  const [discount, setDiscount] = useState(false);
  const [date,     setDate]     = useState(today);
  const [note,     setNote]     = useState("");
  const [submitting,setSubmitting] = useState(false);
  const [successMsg,setSuccessMsg] = useState("");

  const [todayCheckins, setTodayCheckins] = useState([]); // 今日報到學生

  // ── 清單 / 報表共用篩選 ───────────────────────────────────
  const [filterYear,  setFilterYear]  = useState(currentYear);
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  // filterMode: "today" | "month" | "year"
  const [filterMode,  setFilterMode]  = useState("month");
  const [records,     setRecords]     = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // record id

  // 載入會員清單 + 今日報到（自動補全用）
  useEffect(() => {
    getMembersForBilling().then(setAllMembers);
    getTodayCheckinMembers().then(setTodayCheckins);
  }, []);

  // 訂閱帳單記錄（今日模式也訂同月，client 再過濾）
  useEffect(() => {
    const unsub = subscribeBillingRecords(
      filterYear,
      filterMode === "year" ? null : filterMonth,
      setRecords,
    );
    return unsub;
  }, [filterYear, filterMonth, filterMode]);

  // 自動補全過濾
  useEffect(() => {
    if (!memberQuery.trim()) { setMemberSuggestions([]); return; }
    const q = memberQuery.toLowerCase();
    setMemberSuggestions(allMembers.filter(m =>
      m.name?.toLowerCase().includes(q) || m.nickname?.toLowerCase().includes(q)
    ).slice(0, 6));
  }, [memberQuery, allMembers]);

  function selectMember(m) {
    setSelectedMember(m);
    setMemberQuery(m.name);
    setMemberSuggestions([]);
    setDiscount(!!m.archerNo && m.archerNo <= EARLY_BIRD_MAX);
  }
  function clearMember() { setSelectedMember(null); setMemberQuery(""); setDiscount(false); }

  // 從今日報到快選
  function selectFromCheckin(c) {
    const found = allMembers.find(m => m.id === c.memberId);
    if (found) selectMember(found);
    else { setMemberQuery(c.memberName); setSelectedMember(null); setDiscount(false); }
  }

  const basePrice  = PLANS.find(p => p.id === plan)?.price ?? 0;
  // 月卡付款 → 免費
  const finalPrice = payMethod === "月卡" ? 0 : Math.max(0, basePrice - (discount ? EARLY_BIRD_DISC : 0));

  async function handleSubmit() {
    if (!memberQuery.trim() || !plan || submitting) return;
    setSubmitting(true);
    const [y, m, d] = date.split("-").map(Number);
    await addBillingRecord({
      memberName:    memberQuery.trim(),
      memberId:      selectedMember?.id ?? null,
      plan,
      basePrice,
      discount:      discount ? EARLY_BIRD_DISC : 0,
      finalPrice,
      paymentMethod: payMethod,
      year: y, month: m, day: d, date,
      note: note.trim(),
      createdBy:     profile?.uid  ?? "",
      createdByName: profile?.name ?? "教練",
    });
    setSubmitting(false);
    setSuccessMsg(`✓ 已記錄 ${memberQuery.trim()} · ${plan} NT$${finalPrice}`);
    setTimeout(() => setSuccessMsg(""), 3500);
    setPlan(null); setNote("");
  }

  // ── 統計 ──────────────────────────────────────────────────
  const todayStr = today(); // 今日日期字串
  const displayedRecords = filterMode === "today"
    ? records.filter(r => r.date === todayStr)
    : records;

  const grandTotal = displayedRecords.reduce((s, r) => s + (r.finalPrice || 0), 0);
  const planTotals = {};
  const payTotals  = {};
  const monthlyTotals = {};
  displayedRecords.forEach(r => {
    planTotals[r.plan]         = (planTotals[r.plan]         || 0) + (r.finalPrice || 0);
    payTotals[r.paymentMethod] = (payTotals[r.paymentMethod] || 0) + (r.finalPrice || 0);
    if (filterMode === "year") monthlyTotals[r.month] = (monthlyTotals[r.month] || 0) + (r.finalPrice || 0);
  });

  // ── 匯出 CSV ──────────────────────────────�  // ─────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily:"sans-serif", paddingBottom:"80px", color:"#f8fafc" }} className="bg-slate-900 min-h-screen">

      {/* Header */}
      <div style={{ background:"linear-gradient(135deg,#0f172a 0%,#1e293b 100%)", borderBottom:"1px solid rgba(255,255,255,0.08)", padding:"16px" }}>
        <div style={{ color:"#f8fafc", fontSize:"16px", fontWeight:900 }}>💰 會計財務系統</div>
        <div style={{ color:"#7dd3fc", fontSize:"12px", marginTop:"2px" }}>收費記帳 · 方案與營收明細</div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:"8px", padding:"10px 16px", background:"#0f172a", borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
        {[{id:"add",label:"＋ 記帳"},{id:"records",label:"📋 清單"},{id:"report",label:"📊 報表"}].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex:1, padding:"9px", fontSize:"13px", fontWeight:800, borderRadius:"10px", border: tab===t.id?"none":"1px solid rgba(255,255,255,0.12)",
              cursor:"pointer", color:tab===t.id?"white":"#94a3b8",
              background: tab===t.id ? "linear-gradient(90deg, #2563eb, #3b82f6)" : "rgba(30,41,59,0.7)" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════ 記帳 TAB ════════════════ */}
      {tab === "add" && (
        <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:"14px" }}>

          {successMsg && (
            <div style={{ background:"rgba(34,197,94,0.15)", border:"1px solid rgba(34,197,94,0.4)", borderRadius:"10px", padding:"10px 14px", fontSize:"13px", color:"#4ade80", fontWeight:700 }}>
              {successMsg}
            </div>
          )}

          {/* 今日報到快選 */}
          {todayCheckins.length > 0 && (
            <div>
              <div style={{ fontSize:"12px", fontWeight:700, color:"#94a3b8", marginBottom:"6px" }}>今日報到 ({todayCheckins.length} 人)</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
                {todayCheckins.map((c, i) => (
                  <button key={i} onClick={() => selectFromCheckin(c)}
                    style={{ padding:"6px 12px", borderRadius:"20px", border:"1px solid rgba(59,130,246,0.4)",
                      background: memberQuery===(allMembers.find(m=>m.id===c.memberId)?.name||c.memberName) ? "#2563eb" : "rgba(30,41,59,0.8)",
                      color: memberQuery===(allMembers.find(m=>m.id===c.memberId)?.name||c.memberName) ? "white" : "#93c5fd",
                      fontSize:"13px", fontWeight:700, cursor:"pointer" }}>
                    {allMembers.find(m=>m.id===c.memberId)?.name || c.memberName}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 姓名 */}
          <div>
            <div style={{ fontSize:"12px", fontWeight:700, color:"#94a3b8", marginBottom:"6px" }}>射手姓名（或直接輸入）</div>
            <div style={{ position:"relative" }}>
              <div style={{ display:"flex", gap:"8px" }}>
                <input value={memberQuery}
                  onChange={e => { setMemberQuery(e.target.value); setSelectedMember(null); }}
                  placeholder="搜尋現有會員或直接輸入姓名"
                  style={{ flex:1, background:"#1e293b", color:"#f8fafc", border:"1px solid #334155", borderRadius:"10px", padding:"10px 14px", fontSize:"14px", outline:"none" }}/>
                {memberQuery && (
                  <button onClick={clearMember}
                    style={{ padding:"0 14px", border:"1px solid #334155", borderRadius:"10px", background:"#1e293b", cursor:"pointer", fontSize:"13px", color:"#94a3b8" }}>✕</button>
                )}
              </div>
              <button onClick={() => { setMemberQuery("訪客/團康"); setSelectedMember(null); setDiscount(false); }}
                style={{ marginTop:"8px", padding:"5px 14px", borderRadius:"20px",
                  border:"1px solid #334155", background:"#1e293b",
                  color:"#cbd5e1", fontSize:"12px", fontWeight:700, cursor:"pointer" }}>
                訪客/團康
              </button>
              {memberSuggestions.length > 0 && (
                <div style={{ position:"absolute", top:"100%", left:0, right:0, background:"#1e293b", border:"1px solid #334155", borderRadius:"10px", boxShadow:"0 8px 24px rgba(0,0,0,0.6)", zIndex:50, overflow:"hidden", marginTop:"4px" }}>
                  {memberSuggestions.map(m => (
                    <button key={m.id} onClick={() => selectMember(m)}
                      style={{ display:"block", width:"100%", padding:"10px 14px", textAlign:"left", border:"none", borderBottom:"1px solid rgba(255,255,255,0.06)", background:"none", cursor:"pointer", fontSize:"13px", color:"#f8fafc" }}>
                      <span style={{ fontWeight:700, color:"#f8fafc" }}>{m.name}</span>
                      {m.nickname && m.nickname !== m.name && (
                        <span style={{ color:"#94a3b8", marginLeft:"5px", fontSize:"11px" }}>（{m.nickname}）</span>
                      )}
                      <span style={{ color:"#60a5fa", marginLeft:"8px", fontSize:"11px" }}>#{m.archerNo}</span>
                      {m.archerNo && m.archerNo <= EARLY_BIRD_MAX && (
                        <span style={{ marginLeft:"6px", background:"rgba(245,158,11,0.2)", color:"#fbbf24", border:"1px solid rgba(245,158,11,0.4)", fontSize:"10px", padding:"1px 6px", borderRadius:"4px", fontWeight:700 }}>早鳥</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedMember && (
              <div style={{ fontSize:"11px", color:"#60a5fa", marginTop:"4px", fontWeight:700 }}>✓ 已連結會員 #{selectedMember.archerNo}</div>
            )}
          </div>

          {/* 方案 */}
          <div>
            <div style={{ fontSize:"12px", fontWeight:700, color:"#94a3b8", marginBottom:"6px" }}>選擇方案</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"8px" }}>
              {PLANS.map(p => (
                <button key={p.id} onClick={() => setPlan(p.id)}
                  style={{ padding:"12px 6px", borderRadius:"10px",
                    border: plan===p.id ? "2px solid #3b82f6" : "1px solid #334155",
                    background: plan===p.id ? "rgba(37,99,235,0.25)" : "#1e293b", cursor:"pointer", textAlign:"center" }}>
                  <div style={{ fontSize:"15px", fontWeight:900, color:plan===p.id?"#60a5fa":"#f8fafc" }}>{p.id}</div>
                  <div style={{ fontSize:"11px", color:plan===p.id?"#bfdbfe":"#94a3b8", marginTop:"2px" }}>NT${p.price}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 金額 + 折扣 */}
          {plan && (
            <div style={{ background:"#1e293b", border:"1px solid #334155", borderRadius:"12px", padding:"14px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:"12px", color:"#94a3b8" }}>實收金額</div>
                <div style={{ fontSize:"28px", fontWeight:900, color:"#38bdf8" }}>NT$ {finalPrice}</div>
                {discount && <div style={{ fontSize:"11px", color:"#fbbf24" }}>早鳥折扣 -${EARLY_BIRD_DISC}</div>}
              </div>
              <button onClick={() => setDiscount(d => !d)}
                style={{ padding:"8px 14px", borderRadius:"10px",
                  border: discount ? "1px solid rgba(245,158,11,0.5)" : "1px solid #334155",
                  background: discount ? "rgba(245,158,11,0.2)" : "#0f172a", cursor:"pointer",
                  fontSize:"12px", fontWeight:700, color: discount ? "#fcd34d" : "#94a3b8" }}>
                {discount ? "✓ 早鳥 -$50" : "早鳥折扣"}
              </button>
            </div>
          )}

          {/* 付款方式 */}
          <div>
            <div style={{ fontSize:"12px", fontWeight:700, color:"#94a3b8", marginBottom:"6px" }}>付款方式</div>
            <div style={{ display:"flex", gap:"8px" }}>
              {PAY_METHODS.map(m => (
                <button key={m} onClick={() => setPayMethod(m)}
                  style={{ flex:1, padding:"10px", borderRadius:"10px",
                    border: payMethod===m ? "2px solid #3b82f6" : "1px solid #334155",
                    background: payMethod===m ? "#2563eb" : "#1e293b", cursor:"pointer",
                    fontWeight:800, fontSize:"13px", color:payMethod===m?"white":"#cbd5e1" }}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* 日期 */}
          <div>
            <div style={{ fontSize:"12px", fontWeight:700, color:"#94a3b8", marginBottom:"6px" }}>日期</div>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ background:"#1e293b", color:"#f8fafc", border:"1px solid #334155", borderRadius:"10px", padding:"10px 14px", fontSize:"14px", outline:"none", width:"100%", boxSizing:"border-box" }}/>
          </div>

          {/* 備註 */}
          <div>
            <div style={{ fontSize:"12px", fontWeight:700, color:"#94a3b8", marginBottom:"6px" }}>備註（選填）</div>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="例：補繳、折扣說明…"
              style={{ background:"#1e293b", color:"#f8fafc", border:"1px solid #334155", borderRadius:"10px", padding:"10px 14px", fontSize:"14px", outline:"none", width:"100%", boxSizing:"border-box" }}/>
          </div>

          <button onClick={handleSubmit}
            disabled={!memberQuery.trim() || !plan || submitting}
            style={{ padding:"14px", borderRadius:"12px", marginTop:"6px",
              background:(!memberQuery.trim()||!plan||submitting)?"#334155":"linear-gradient(90deg, #2563eb, #3b82f6)",
              color:(!memberQuery.trim()||!plan||submitting)?"#94a3b8":"white",
              border:"none", cursor:(!memberQuery.trim()||!plan||submitting)?"not-allowed":"pointer",
              fontSize:"15px", fontWeight:900, boxShadow: (!memberQuery.trim()||!plan||submitting) ? "none" : "0 4px 14px rgba(37,99,235,0.35)" }}>
            {submitting ? "記錄中…" : "確認記帳"}
          </button>
        </div>
      )}

      {/* ════════════════ 清單 TAB ════════════════ */}
      {tab === "records" && (
        <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:"12px" }}>

          {/* 篩選 */}
          <div style={{ display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap" }}>
            <FilterBar filterMode={filterMode} setFilterMode={setFilterMode} filterYear={filterYear} setFilterYear={setFilterYear} filterMonth={filterMonth} setFilterMonth={setFilterMonth} />
            <button onClick={exportCSV}
              style={{ marginLeft:"auto", padding:"8px 14px", border:"1px solid rgba(34,197,94,0.4)", borderRadius:"10px",
                background:"rgba(34,197,94,0.15)", color:"#4ade80", cursor:"pointer", fontSize:"12px", fontWeight:800 }}>
              ↓ 匯出 CSV
            </button>
          </div>

          {/* 合計 */}
          <div style={{ background:"linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%)", borderRadius:"14px", padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", border:"1px solid rgba(255,255,255,0.12)" }}>
            <div style={{ fontSize:"13px", color:"#bfdbfe", fontWeight:700 }}>共 {displayedRecords.length} 筆明細</div>
            <div style={{ fontSize:"22px", fontWeight:900, color:"#ffffff" }}>NT$ {grandTotal.toLocaleString()}</div>
          </div>

          {/* 清單 */}
          {displayedRecords.length === 0 ? (
            <div style={{ textAlign:"center", color:"#64748b", padding:"40px 0", fontSize:"14px" }}>尚無記帳記錄</div>
          ) : displayedRecords.map(r => (
            <div key={r.id} style={{ background:"#1e293b", border:"1px solid #334155", borderRadius:"14px", padding:"14px 16px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontWeight:900, fontSize:"15px", color:"#f8fafc" }}>{r.memberName}</div>
                  <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", alignItems:"center", marginTop:"6px" }}>
                    <span style={{ background:"rgba(59,130,246,0.2)", color:"#60a5fa", border:"1px solid rgba(59,130,246,0.3)", fontSize:"11px", padding:"2px 8px", borderRadius:"6px", fontWeight:800 }}>{r.plan}</span>
                    <span style={{ background:"#0f172a", color:"#cbd5e1", border:"1px solid #334155", fontSize:"11px", padding:"2px 8px", borderRadius:"6px" }}>{r.paymentMethod}</span>
                    <span style={{ color:"#94a3b8", fontSize:"11px" }}>{r.date}</span>
                    {r.discount > 0 && <span style={{ background:"rgba(245,158,11,0.2)", color:"#fbbf24", fontSize:"10px", padding:"2px 6px", borderRadius:"4px" }}>早鳥 -${r.discount}</span>}
                  </div>
                  {r.note && <div style={{ fontSize:"12px", color:"#94a3b8", marginTop:"6px" }}>📝 {r.note}</div>}
                </div>
                <div style={{ textAlign:"right", flexShrink:0, marginLeft:"12px" }}>
                  <div style={{ fontSize:"18px", fontWeight:900, color:"#38bdf8" }}>NT$ {r.finalPrice}</div>
                  {deleteConfirm === r.id ? (
                    <div style={{ display:"flex", gap:"6px", marginTop:"6px" }}>
                      <button onClick={async () => { await deleteBillingRecord(r.id); setDeleteConfirm(null); }}
                        style={{ fontSize:"11px", color:"#ef4444", background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.4)", borderRadius:"6px", padding:"3px 8px", cursor:"pointer", fontWeight:800 }}>
                        確認刪除
                      </button>
                      <button onClick={() => setDeleteConfirm(null)}
                        style={{ fontSize:"11px", color:"#94a3b8", background:"#0f172a", border:"1px solid #334155", borderRadius:"6px", padding:"3px 8px", cursor:"pointer" }}>
                        取消
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirm(r.id)}
                      style={{ fontSize:"11px", color:"#64748b", background:"none", border:"none", cursor:"pointer", marginTop:"6px" }}>
                      刪除
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ════════════════ 報表 TAB ════════════════ */}
      {tab === "report" && (
        <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:"14px" }}>

          {/* 篩選 */}
          <div style={{ display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap" }}>
            <FilterBar filterMode={filterMode} setFilterMode={setFilterMode} filterYear={filterYear} setFilterYear={setFilterYear} filterMonth={filterMonth} setFilterMonth={setFilterMonth} />
          </div>

          {/* 總收入 */}
          <div style={{ background:"linear-gradient(135deg,#0c4a6e 0%,#2563eb 100%)", borderRadius:"16px", padding:"20px", color:"white", textAlign:"center", border:"1px solid rgba(255,255,255,0.12)" }}>
            <div style={{ fontSize:"12px", color:"#7dd3fc", marginBottom:"4px" }}>
              {filterMode==="today" ? `${todayStr} 今日` : filterMode==="year" ? `${filterYear} 年` : `${filterYear} 年 ${filterMonth} 月`}　總營收
            </div>
            <div style={{ fontSize:"34px", fontWeight:900, color:"#ffffff" }}>NT$ {grandTotal.toLocaleString()}</div>
            <div style={{ fontSize:"12px", color:"#93c5fd", marginTop:"4px" }}>{displayedRecords.length} 筆交易明細</div>
          </div>

          {/* 按方案 */}
          <div style={{ background:"#1e293b", border:"1px solid #334155", borderRadius:"14px", padding:"16px" }}>
            <div style={{ fontSize:"14px", fontWeight:900, color:"#f8fafc", marginBottom:"12px" }}>按方案分析</div>
            {PLANS.map(p => {
              const cnt = displayedRecords.filter(r => r.plan === p.id).length;
              const total = planTotals[p.id] || 0;
              return (
                <div key={p.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                    <span style={{ background:"rgba(59,130,246,0.2)", color:"#60a5fa", border:"1px solid rgba(59,130,246,0.3)", fontSize:"11px", padding:"2px 8px", borderRadius:"6px", fontWeight:800 }}>{p.id}</span>
                    <span style={{ fontSize:"12px", color:"#94a3b8" }}>{cnt} 筆</span>
                  </div>
                  <span style={{ fontWeight:800, fontSize:"14px", color: total ? "#38bdf8" : "#64748b" }}>
                    NT$ {total.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>

          {/* 按付款方式 */}
          <div style={{ background:"#1e293b", border:"1px solid #334155", borderRadius:"14px", padding:"16px" }}>
            <div style={{ fontSize:"14px", fontWeight:900, color:"#f8fafc", marginBottom:"12px" }}>按付款方式</div>
            {PAY_METHODS.map(m => (
              <div key={m} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontSize:"13px", color:"#cbd5e1" }}>{m}</span>
                <span style={{ fontWeight:800, fontSize:"14px", color: payTotals[m] ? "#38bdf8" : "#64748b" }}>
                  NT$ {(payTotals[m] || 0).toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          {/* 各月（全年模式才顯示）*/}
          {filterMode === "year" && (
            <div style={{ background:"#1e293b", border:"1px solid #334155", borderRadius:"14px", padding:"16px" }}>
              <div style={{ fontSize:"14px", fontWeight:900, color:"#f8fafc", marginBottom:"12px" }}>各月收入</div>
              {Array.from({length:12},(_,i)=>i+1).map(m => (
                <div key={m} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ fontSize:"13px", color:"#cbd5e1" }}>{m} 月</span>
                  <span style={{ fontWeight:800, fontSize:"14px", color: monthlyTotals[m] ? "#38bdf8" : "#64748b" }}>
                    NT$ {(monthlyTotals[m] || 0).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          <button onClick={exportCSV}
            style={{ padding:"12px", borderRadius:"12px", background:"rgba(34,197,94,0.15)", color:"#4ade80",
              border:"1px solid rgba(34,197,94,0.4)", cursor:"pointer", fontSize:"14px", fontWeight:800 }}>
            ↓ 匯出完整 CSV 報表
          </button>
        </div>
      )}
    </div>
  );
}

function FilterBar({ filterMode, setFilterMode, filterYear, setFilterYear, filterMonth, setFilterMonth }) {
  const btnStyle = (active) => ({
    padding:"7px 12px", border:"1px solid #334155", borderRadius:"8px",
    background: active ? "#2563eb" : "#1e293b", color: active ? "white" : "#94a3b8",
    cursor:"pointer", fontSize:"12px", fontWeight:800,
  });
  return (
    <>
      <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}
        style={{ background:"#1e293b", color:"#f8fafc", border:"1px solid #334155", borderRadius:"8px", padding:"7px 10px", fontSize:"13px", cursor:"pointer" }}>
        {YEARS.map(y => <option key={y} value={y}>{y} 年</option>)}
      </select>
      {["today","month","year"].map(mode => (
        <button key={mode} onClick={() => setFilterMode(mode)} style={btnStyle(filterMode===mode)}>
          {mode==="today"?"今日":mode==="month"?"單月":"全年"}
        </button>
      ))}
      {filterMode === "month" && (
        <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}
          style={{ background:"#1e293b", color:"#f8fafc", border:"1px solid #334155", borderRadius:"8px", padding:"7px 10px", fontSize:"13px", cursor:"pointer" }}>
          {Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>{m} 月</option>)}
        </select>
      )}
    </>
  );
}
