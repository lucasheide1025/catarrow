// src/components/admin/BillingSystem.jsx
import { useState, useEffect } from "react";
import {
  addBillingRecord, deleteBillingRecord,
  subscribeBillingRecords, getMembersForBilling,
} from "../../lib/db";

const PLANS = [
  { id: "自一", price: 200 },
  { id: "自三", price: 400 },
  { id: "單一", price: 300 },
  { id: "單三", price: 600 },
  { id: "學一", price: 200 },
  { id: "學三", price: 400 },
];
const PAY_METHODS = ["現金", "轉帳", "月卡"];
const EARLY_BIRD_MAX  = 123;
const EARLY_BIRD_DISC = 50;

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

  // ── 清單 / 報表共用篩選 ───────────────────────────────────
  const [filterYear,  setFilterYear]  = useState(currentYear);
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterAll,   setFilterAll]   = useState(false); // true = 全年
  const [records,     setRecords]     = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // record id

  // 載入會員清單（自動補全用）
  useEffect(() => { getMembersForBilling().then(setAllMembers); }, []);

  // 訂閱帳單記錄
  useEffect(() => {
    const unsub = subscribeBillingRecords(
      filterYear,
      filterAll ? null : filterMonth,
      setRecords,
    );
    return unsub;
  }, [filterYear, filterMonth, filterAll]);

  // 自動補全過濾
  useEffect(() => {
    if (!memberQuery.trim()) { setMemberSuggestions([]); return; }
    const q = memberQuery.toLowerCase();
    setMemberSuggestions(allMembers.filter(m => m.name?.toLowerCase().includes(q)).slice(0, 6));
  }, [memberQuery, allMembers]);

  function selectMember(m) {
    setSelectedMember(m);
    setMemberQuery(m.name);
    setMemberSuggestions([]);
    setDiscount(!!m.archerNo && m.archerNo <= EARLY_BIRD_MAX);
  }
  function clearMember() { setSelectedMember(null); setMemberQuery(""); setDiscount(false); }

  const basePrice  = PLANS.find(p => p.id === plan)?.price ?? 0;
  const finalPrice = Math.max(0, basePrice - (discount ? EARLY_BIRD_DISC : 0));

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
  const grandTotal = records.reduce((s, r) => s + (r.finalPrice || 0), 0);
  const planTotals = {};
  const payTotals  = {};
  const monthlyTotals = {};
  records.forEach(r => {
    planTotals[r.plan]          = (planTotals[r.plan]          || 0) + (r.finalPrice || 0);
    payTotals[r.paymentMethod]  = (payTotals[r.paymentMethod]  || 0) + (r.finalPrice || 0);
    if (filterAll) monthlyTotals[r.month] = (monthlyTotals[r.month] || 0) + (r.finalPrice || 0);
  });

  // ── 匯出 CSV ──────────────────────────────────────────────
  function exportCSV() {
    const header = ["日期","姓名","方案","原價","折扣","實收","付款方式","備註","記帳教練"];
    const rows   = records.map(r => [
      r.date, r.memberName, r.plan, r.basePrice, r.discount ?? 0,
      r.finalPrice, r.paymentMethod, r.note || "", r.createdByName || "",
    ]);
    const csv  = [header, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `billing_${filterYear}${filterAll ? "" : `_${String(filterMonth).padStart(2,"0")}` }.csv`;
    a.click();
  }

  // ─────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily:"sans-serif", paddingBottom:"80px" }}>

      {/* Header */}
      <div style={{ background:"linear-gradient(90deg,#0f172a,#1e3a5f)", padding:"14px 16px" }}>
        <div style={{ color:"white", fontSize:"15px", fontWeight:900 }}>💰 會計系統</div>
        <div style={{ color:"rgba(255,255,255,.55)", fontSize:"12px" }}>收費記帳 · 方案管理</div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", background:"white", borderBottom:"1px solid #e2e8f0" }}>
        {[{id:"add",label:"＋ 記帳"},{id:"records",label:"📋 清單"},{id:"report",label:"📊 報表"}].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex:1, padding:"10px", fontSize:"13px", fontWeight:700, border:"none", background:"none",
              cursor:"pointer", color:tab===t.id?"#2563eb":"#64748b",
              borderBottom:tab===t.id?"2px solid #2563eb":"2px solid transparent" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════ 記帳 TAB ════════════════ */}
      {tab === "add" && (
        <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:"14px" }}>

          {successMsg && (
            <div style={{ background:"#f0fdf4", border:"1px solid #86efac", borderRadius:"10px", padding:"10px 14px", fontSize:"13px", color:"#15803d", fontWeight:700 }}>
              {successMsg}
            </div>
          )}

          {/* 姓名 */}
          <div>
            <div style={{ fontSize:"12px", fontWeight:700, color:"#64748b", marginBottom:"6px" }}>射手姓名</div>
            <div style={{ position:"relative" }}>
              <div style={{ display:"flex", gap:"8px" }}>
                <input value={memberQuery}
                  onChange={e => { setMemberQuery(e.target.value); setSelectedMember(null); }}
                  placeholder="搜尋現有會員或直接輸入姓名"
                  style={{ flex:1, border:"1px solid #e2e8f0", borderRadius:"8px", padding:"9px 12px", fontSize:"14px", outline:"none" }}/>
                {memberQuery && (
                  <button onClick={clearMember}
                    style={{ padding:"0 12px", border:"1px solid #e2e8f0", borderRadius:"8px", background:"#f8fafc", cursor:"pointer", fontSize:"13px", color:"#64748b" }}>✕</button>
                )}
              </div>
              {memberSuggestions.length > 0 && (
                <div style={{ position:"absolute", top:"100%", left:0, right:0, background:"white", border:"1px solid #e2e8f0", borderRadius:"8px", boxShadow:"0 4px 12px rgba(0,0,0,.1)", zIndex:50, overflow:"hidden", marginTop:"4px" }}>
                  {memberSuggestions.map(m => (
                    <button key={m.id} onClick={() => selectMember(m)}
                      style={{ display:"block", width:"100%", padding:"9px 14px", textAlign:"left", border:"none", borderBottom:"1px solid #f1f5f9", background:"none", cursor:"pointer", fontSize:"13px", color:"#1e293b" }}>
                      <span style={{ fontWeight:700 }}>{m.name}</span>
                      <span style={{ color:"#94a3b8", marginLeft:"8px", fontSize:"11px" }}>#{m.archerNo}</span>
                      {m.archerNo && m.archerNo <= EARLY_BIRD_MAX && (
                        <span style={{ marginLeft:"6px", background:"#fef9c3", color:"#854d0e", fontSize:"10px", padding:"1px 6px", borderRadius:"4px", fontWeight:700 }}>早鳥</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedMember && (
              <div style={{ fontSize:"11px", color:"#2563eb", marginTop:"4px" }}>已連結會員 #{selectedMember.archerNo}</div>
            )}
          </div>

          {/* 方案 */}
          <div>
            <div style={{ fontSize:"12px", fontWeight:700, color:"#64748b", marginBottom:"6px" }}>方案</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"8px" }}>
              {PLANS.map(p => (
                <button key={p.id} onClick={() => setPlan(p.id)}
                  style={{ padding:"10px 6px", borderRadius:"10px",
                    border: plan===p.id ? "2px solid #2563eb" : "1px solid #e2e8f0",
                    background: plan===p.id ? "#eff6ff" : "white", cursor:"pointer", textAlign:"center" }}>
                  <div style={{ fontSize:"14px", fontWeight:900, color:plan===p.id?"#2563eb":"#1e293b" }}>{p.id}</div>
                  <div style={{ fontSize:"11px", color:"#64748b" }}>NT${p.price}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 金額 + 折扣 */}
          {plan && (
            <div style={{ background:"#f8fafc", borderRadius:"12px", padding:"12px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:"11px", color:"#64748b" }}>實收金額</div>
                <div style={{ fontSize:"26px", fontWeight:900, color:"#0f172a" }}>NT$ {finalPrice}</div>
                {discount && <div style={{ fontSize:"11px", color:"#d97706" }}>早鳥折扣 -${EARLY_BIRD_DISC}</div>}
              </div>
              <button onClick={() => setDiscount(d => !d)}
                style={{ padding:"7px 14px", borderRadius:"8px",
                  border: discount ? "1px solid #fbbf24" : "1px solid #e2e8f0",
                  background: discount ? "#fef9c3" : "white", cursor:"pointer",
                  fontSize:"12px", fontWeight:700, color:"#854d0e" }}>
                {discount ? "✓ 早鳥 -$50" : "早鳥折扣"}
              </button>
            </div>
          )}

          {/* 付款方式 */}
          <div>
            <div style={{ fontSize:"12px", fontWeight:700, color:"#64748b", marginBottom:"6px" }}>付款方式</div>
            <div style={{ display:"flex", gap:"8px" }}>
              {PAY_METHODS.map(m => (
                <button key={m} onClick={() => setPayMethod(m)}
                  style={{ flex:1, padding:"9px", borderRadius:"10px",
                    border: payMethod===m ? "2px solid #2563eb" : "1px solid #e2e8f0",
                    background: payMethod===m ? "#eff6ff" : "white", cursor:"pointer",
                    fontWeight:700, fontSize:"13px", color:payMethod===m?"#2563eb":"#475569" }}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* 日期 */}
          <div>
            <div style={{ fontSize:"12px", fontWeight:700, color:"#64748b", marginBottom:"6px" }}>日期</div>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ border:"1px solid #e2e8f0", borderRadius:"8px", padding:"9px 12px", fontSize:"14px", outline:"none", width:"100%", boxSizing:"border-box" }}/>
          </div>

          {/* 備註 */}
          <div>
            <div style={{ fontSize:"12px", fontWeight:700, color:"#64748b", marginBottom:"6px" }}>備註（選填）</div>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="例：補繳、折扣說明…"
              style={{ border:"1px solid #e2e8f0", borderRadius:"8px", padding:"9px 12px", fontSize:"14px", outline:"none", width:"100%", boxSizing:"border-box" }}/>
          </div>

          <button onClick={handleSubmit}
            disabled={!memberQuery.trim() || !plan || submitting}
            style={{ padding:"13px", borderRadius:"12px",
              background:(!memberQuery.trim()||!plan||submitting)?"#e2e8f0":"#2563eb",
              color:(!memberQuery.trim()||!plan||submitting)?"#94a3b8":"white",
              border:"none", cursor:(!memberQuery.trim()||!plan||submitting)?"not-allowed":"pointer",
              fontSize:"15px", fontWeight:900 }}>
            {submitting ? "記錄中…" : "確認記帳"}
          </button>
        </div>
      )}

      {/* ════════════════ 清單 TAB ════════════════ */}
      {tab === "records" && (
        <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:"12px" }}>

          {/* 篩選 */}
          <div style={{ display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap" }}>
            <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}
              style={{ border:"1px solid #e2e8f0", borderRadius:"8px", padding:"7px 10px", fontSize:"13px", cursor:"pointer" }}>
              {YEARS.map(y => <option key={y} value={y}>{y} 年</option>)}
            </select>
            <button onClick={() => setFilterAll(f => !f)}
              style={{ padding:"7px 12px", border:"1px solid #e2e8f0", borderRadius:"8px",
                background:filterAll?"#eff6ff":"white", color:filterAll?"#2563eb":"#64748b",
                cursor:"pointer", fontSize:"12px", fontWeight:700 }}>
              {filterAll ? "全年" : "單月"}
            </button>
            {!filterAll && (
              <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}
                style={{ border:"1px solid #e2e8f0", borderRadius:"8px", padding:"7px 10px", fontSize:"13px", cursor:"pointer" }}>
                {Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>{m} 月</option>)}
              </select>
            )}
            <button onClick={exportCSV}
              style={{ marginLeft:"auto", padding:"7px 12px", border:"1px solid #d1fae5", borderRadius:"8px",
                background:"#f0fdf4", color:"#15803d", cursor:"pointer", fontSize:"12px", fontWeight:700 }}>
              ↓ 匯出
            </button>
          </div>

          {/* 合計 */}
          <div style={{ background:"#eff6ff", borderRadius:"12px", padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ fontSize:"13px", color:"#2563eb", fontWeight:700 }}>共 {records.length} 筆</div>
            <div style={{ fontSize:"20px", fontWeight:900, color:"#1d4ed8" }}>NT$ {grandTotal.toLocaleString()}</div>
          </div>

          {/* 清單 */}
          {records.length === 0 ? (
            <div style={{ textAlign:"center", color:"#94a3b8", padding:"40px 0", fontSize:"14px" }}>尚無記錄</div>
          ) : records.map(r => (
            <div key={r.id} style={{ background:"white", border:"1px solid #e2e8f0", borderRadius:"12px", padding:"12px 14px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontWeight:900, fontSize:"14px", color:"#1e293b" }}>{r.memberName}</div>
                  <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", alignItems:"center", marginTop:"4px" }}>
                    <span style={{ background:"#eff6ff", color:"#2563eb", fontSize:"11px", padding:"2px 8px", borderRadius:"6px", fontWeight:700 }}>{r.plan}</span>
                    <span style={{ background:"#f1f5f9", color:"#475569", fontSize:"11px", padding:"2px 8px", borderRadius:"6px" }}>{r.paymentMethod}</span>
                    <span style={{ color:"#94a3b8", fontSize:"11px" }}>{r.date}</span>
                    {r.discount > 0 && <span style={{ background:"#fef9c3", color:"#854d0e", fontSize:"10px", padding:"2px 6px", borderRadius:"4px" }}>早鳥 -${r.discount}</span>}
                  </div>
                  {r.note && <div style={{ fontSize:"11px", color:"#64748b", marginTop:"4px" }}>📝 {r.note}</div>}
                </div>
                <div style={{ textAlign:"right", flexShrink:0, marginLeft:"12px" }}>
                  <div style={{ fontSize:"17px", fontWeight:900, color:"#0f172a" }}>NT$ {r.finalPrice}</div>
                  {deleteConfirm === r.id ? (
                    <div style={{ display:"flex", gap:"6px", marginTop:"4px" }}>
                      <button onClick={async () => { await deleteBillingRecord(r.id); setDeleteConfirm(null); }}
                        style={{ fontSize:"11px", color:"#dc2626", background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:"6px", padding:"2px 8px", cursor:"pointer", fontWeight:700 }}>
                        確認刪除
                      </button>
                      <button onClick={() => setDeleteConfirm(null)}
                        style={{ fontSize:"11px", color:"#64748b", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:"6px", padding:"2px 8px", cursor:"pointer" }}>
                        取消
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirm(r.id)}
                      style={{ fontSize:"11px", color:"#94a3b8", background:"none", border:"none", cursor:"pointer", marginTop:"4px" }}>
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
            <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}
              style={{ border:"1px solid #e2e8f0", borderRadius:"8px", padding:"7px 10px", fontSize:"13px" }}>
              {YEARS.map(y => <option key={y} value={y}>{y} 年</option>)}
            </select>
            <button onClick={() => setFilterAll(f => !f)}
              style={{ padding:"7px 12px", border:"1px solid #e2e8f0", borderRadius:"8px",
                background:filterAll?"#eff6ff":"white", color:filterAll?"#2563eb":"#64748b",
                cursor:"pointer", fontSize:"12px", fontWeight:700 }}>
              {filterAll ? "全年" : "單月"}
            </button>
            {!filterAll && (
              <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}
                style={{ border:"1px solid #e2e8f0", borderRadius:"8px", padding:"7px 10px", fontSize:"13px" }}>
                {Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>{m} 月</option>)}
              </select>
            )}
          </div>

          {/* 總收入 */}
          <div style={{ background:"linear-gradient(135deg,#1e3a5f,#2563eb)", borderRadius:"16px", padding:"20px", color:"white", textAlign:"center" }}>
            <div style={{ fontSize:"12px", color:"rgba(255,255,255,.65)", marginBottom:"4px" }}>
              {filterYear} 年{filterAll ? "" : ` ${filterMonth} 月`}　總收入
            </div>
            <div style={{ fontSize:"34px", fontWeight:900 }}>NT$ {grandTotal.toLocaleString()}</div>
            <div style={{ fontSize:"12px", color:"rgba(255,255,255,.55)", marginTop:"4px" }}>{records.length} 筆記錄</div>
          </div>

          {/* 按方案 */}
          <div style={{ background:"white", border:"1px solid #e2e8f0", borderRadius:"12px", padding:"14px" }}>
            <div style={{ fontSize:"13px", fontWeight:900, color:"#1e293b", marginBottom:"10px" }}>按方案分析</div>
            {PLANS.map(p => {
              const cnt = records.filter(r => r.plan === p.id).length;
              const total = planTotals[p.id] || 0;
              return (
                <div key={p.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:"1px solid #f1f5f9" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                    <span style={{ background:"#eff6ff", color:"#2563eb", fontSize:"11px", padding:"2px 8px", borderRadius:"6px", fontWeight:700 }}>{p.id}</span>
                    <span style={{ fontSize:"12px", color:"#94a3b8" }}>{cnt} 筆</span>
                  </div>
                  <span style={{ fontWeight:700, fontSize:"14px", color: total ? "#0f172a" : "#cbd5e1" }}>
                    NT$ {total.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>

          {/* 按付款方式 */}
          <div style={{ background:"white", border:"1px solid #e2e8f0", borderRadius:"12px", padding:"14px" }}>
            <div style={{ fontSize:"13px", fontWeight:900, color:"#1e293b", marginBottom:"10px" }}>按付款方式</div>
            {PAY_METHODS.map(m => (
              <div key={m} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid #f1f5f9" }}>
                <span style={{ fontSize:"13px", color:"#475569" }}>{m}</span>
                <span style={{ fontWeight:700, fontSize:"14px", color: payTotals[m] ? "#0f172a" : "#cbd5e1" }}>
                  NT$ {(payTotals[m] || 0).toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          {/* 各月（全年模式才顯示）*/}
          {filterAll && (
            <div style={{ background:"white", border:"1px solid #e2e8f0", borderRadius:"12px", padding:"14px" }}>
              <div style={{ fontSize:"13px", fontWeight:900, color:"#1e293b", marginBottom:"10px" }}>各月收入</div>
              {Array.from({length:12},(_,i)=>i+1).map(m => (
                <div key={m} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid #f1f5f9" }}>
                  <span style={{ fontSize:"13px", color:"#475569" }}>{m} 月</span>
                  <span style={{ fontWeight:700, fontSize:"14px", color: monthlyTotals[m] ? "#0f172a" : "#cbd5e1" }}>
                    NT$ {(monthlyTotals[m] || 0).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          <button onClick={exportCSV}
            style={{ padding:"12px", borderRadius:"12px", background:"#f0fdf4", color:"#15803d",
              border:"1px solid #86efac", cursor:"pointer", fontSize:"14px", fontWeight:700 }}>
            ↓ 匯出 CSV
          </button>
        </div>
      )}
    </div>
  );
}
