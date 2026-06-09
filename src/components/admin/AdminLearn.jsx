// src/components/admin/AdminLearn.jsx
import { useState, useEffect, useRef } from "react";
import {
  getMembers, subscribeLearnLogs, updateLearnLog, addLearnLog
} from "../../lib/db";
import { useAuth } from "../../hooks/useAuth";
import { today, fmtDT, calcAge } from "../../lib/constants";
import { Card, Btn, Inp, TA, ST, Spinner, Empty, SearchBar, useToast } from "../shared/UI";

export default function AdminLearn() {
  const { profile } = useAuth();
  const { toast, ToastContainer } = useToast();

  const [members, setMembers]       = useState([]);
  const [loadingMem, setLoadingMem] = useState(true);
  const [search, setSearch]         = useState("");
  const [selId, setSelId]           = useState(null);
  const [logs, setLogs]             = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [replyId, setReplyId]       = useState(null);
  const [addingFor, setAddingFor]   = useState(null);
  const unsubRef = useRef(null);

  // 載入會員列表
  useEffect(() => {
    getMembers().then(ms => {
      setMembers(ms);
      setLoadingMem(false);
    });
  }, []);

  // 切換選中的會員時重新訂閱紀錄
  useEffect(() => {
    // 先取消上一個訂閱
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    if (!selId) { setLogs([]); return; }

    setLoadingLogs(true);
    setLogs([]);

    const unsub = subscribeLearnLogs(selId, (data) => {
      setLogs(data.filter(l => !l.deleted));
      setLoadingLogs(false);
    });
    unsubRef.current = unsub;
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, [selId]);

  // 篩選會員（搜尋）
  const filteredMembers = members.filter(m => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.name?.toLowerCase().includes(q) ||
      m.nickname?.toLowerCase().includes(q) ||
      String(m.archerNo || "").includes(q)
    );
  });

  const selMember = members.find(m => m.id === selId);

  // 計算每個會員的待回饋數（只在已載入時）
  function pendingBadge(memberId) {
    // 只有選中的會員才顯示準確數字
    if (memberId !== selId) return null;
    const p = logs.filter(l => !l.coachNote).length;
    return p > 0 ? p : null;
  }

  async function saveCoachNote(logId, note) {
    await updateLearnLog(logId, {
      coachNote: note,
      coachRepliedAt: new Date().toISOString(),
      coachId: profile.id,
      coachName: profile.name,
    }, profile.id);
    toast("回饋已儲存 ✓");
    setReplyId(null);
  }

  async function addCoachEntry(form) {
    await addLearnLog(selId, {
      date: form.date,
      studentNote: "",
      coachNote: form.coachNote,
      coachAdded: true,
      coachId: profile.id,
      coachName: profile.name,
    });
    toast("教練紀錄已新增 ✓");
    setAddingFor(null);
  }

  async function deleteLog(logId) {
    if (!window.confirm("確認刪除此筆紀錄？")) return;
    await updateLearnLog(logId, { deleted: true }, profile.id);
    toast("已刪除");
  }

  if (loadingMem) return <Spinner />;

  return (
    <div className="flex h-screen" style={{ fontFamily: "sans-serif" }}>
      <ToastContainer />

      {/* ── 左側：會員列表 ── */}
      <div className="w-56 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col" style={{ height: "calc(100vh - 56px)" }}>
        <div className="p-3 border-b border-gray-100">
          <div className="text-xs font-bold text-gray-500 mb-2">👥 選擇射手</div>
          <SearchBar value={search} onChange={setSearch} placeholder="搜尋…" />
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredMembers.length === 0 && (
            <p className="text-gray-400 text-xs text-center py-6">沒有符合的射手</p>
          )}
          {filteredMembers.map(m => {
            const pending = pendingBadge(m.id);
            const isSelected = selId === m.id;
            return (
              <button key={m.id} onClick={() => { setSelId(m.id); setReplyId(null); setAddingFor(null); }}
                className={`w-full text-left px-3 py-3 border-b border-gray-50 transition-colors flex items-center justify-between gap-2
                  ${isSelected ? "bg-blue-50 border-l-4 border-l-blue-500" : "hover:bg-gray-50"}`}>
                <div className="min-w-0">
                  <div className={`text-sm font-bold truncate ${isSelected ? "text-blue-700" : "text-gray-700"}`}>
                    {m.nickname || m.name}
                  </div>
                  <div className="text-xs text-gray-400 truncate">{m.name}</div>
                  <div className="text-xs text-gray-300">射齡 {calcAge(m.joinDate)}</div>
                </div>
                {pending && (
                  <span className="flex-shrink-0 bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {pending}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 右側：學習紀錄 ── */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-4 flex flex-col gap-4">
        {!selId && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <div className="text-5xl mb-3">📓</div>
            <div className="text-base font-bold text-gray-500 mb-1">請從左側選擇射手</div>
            <div className="text-sm">查看並管理學習紀錄</div>
          </div>
        )}

        {selId && selMember && (
          <>
            {/* 標題 + 新增按鈕 */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-gray-800 font-black text-lg">
                  {selMember.nickname || selMember.name} 的學習紀錄
                </div>
                <div className="text-gray-400 text-xs">
                  {selMember.name}　射齡 {calcAge(selMember.joinDate)}
                  {logs.filter(l => !l.coachNote).length > 0 && (
                    <span className="ml-2 text-orange-500 font-bold">
                      ⚠️ {logs.filter(l => !l.coachNote).length} 則待回饋
                    </span>
                  )}
                </div>
              </div>
              <Btn v="warn" size="sm" onClick={() => { setAddingFor(selId); setReplyId(null); }}>
                + 教練新增
              </Btn>
            </div>

            {/* 教練新增表單 */}
            {addingFor === selId && (
              <CoachAddEntry
                onSave={addCoachEntry}
                onCancel={() => setAddingFor(null)}
              />
            )}

            {/* 紀錄列表 */}
            {loadingLogs && <Spinner />}

            {!loadingLogs && logs.length === 0 && (
              <Empty icon="📓" message="尚無學習紀錄" />
            )}

            {!loadingLogs && logs.map(log => (
              <LogCard
                key={log.id}
                log={log}
                isReplying={replyId === log.id}
                onStartReply={() => { setReplyId(log.id); setAddingFor(null); }}
                onSaveReply={saveCoachNote}
                onCancelReply={() => setReplyId(null)}
                onDelete={() => deleteLog(log.id)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ── 單筆紀錄卡片 ─────────────────────────────────────────────
function LogCard({ log, isReplying, onStartReply, onSaveReply, onCancelReply, onDelete }) {
  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-700 text-sm">📅 {log.date}</span>
          {log.coachAdded && (
            <span className="text-xs bg-orange-100 text-orange-600 font-bold px-2 py-0.5 rounded-full">教練新增</span>
          )}
          {!log.coachNote && (
            <span className="text-xs bg-yellow-100 text-yellow-700 font-bold px-2 py-0.5 rounded-full">待回饋</span>
          )}
        </div>
        <button onClick={onDelete} className="text-red-300 hover:text-red-500 text-xs font-medium">刪除</button>
      </div>

      {/* 學生紀錄 */}
      {log.studentNote ? (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">學</div>
            <span className="text-xs font-bold text-gray-400">學生紀錄</span>
            <span className="text-gray-300 text-xs">{fmtDT(log.createdAt)}</span>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">
            {log.studentNote}
          </div>
        </div>
      ) : null}

      {/* 教練回饋 */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">教</div>
          <span className="text-xs font-bold text-gray-400">教練回饋</span>
          {log.coachRepliedAt && <span className="text-gray-300 text-xs">{fmtDT(log.coachRepliedAt)}</span>}
          {!isReplying && (
            <button onClick={onStartReply} className="ml-auto text-blue-600 text-xs font-bold hover:text-blue-800">
              {log.coachNote ? "編輯" : "新增回饋"}
            </button>
          )}
        </div>

        {isReplying ? (
          <CoachReplyForm log={log} onSave={onSaveReply} onCancel={onCancelReply} />
        ) : log.coachNote ? (
          <div className="bg-orange-50 rounded-xl p-3 text-gray-700 text-sm whitespace-pre-wrap leading-relaxed border border-orange-100">
            {log.coachNote}
          </div>
        ) : (
          <div className="text-gray-300 text-xs text-center py-3 border border-dashed border-gray-200 rounded-lg">
            尚未填寫教練回饋
          </div>
        )}
      </div>
    </Card>
  );
}

// ── 教練回饋表單 ─────────────────────────────────────────────
function CoachReplyForm({ log, onSave, onCancel }) {
  const [txt, setTxt] = useState(log.coachNote || "");
  return (
    <div className="bg-orange-50 rounded-xl p-3 border border-orange-200 flex flex-col gap-2">
      <TA value={txt} onChange={e => setTxt(e.target.value)} rows={4}
        placeholder="輸入教練回饋內容…" />
      <div className="flex gap-2">
        <Btn v="secondary" size="sm" className="flex-1" onClick={onCancel}>取消</Btn>
        <Btn v="warn" size="sm" className="flex-1" onClick={() => onSave(log.id, txt)} disabled={!txt.trim()}>
          儲存回饋
        </Btn>
      </div>
    </div>
  );
}

// ── 教練新增紀錄表單 ──────────────────────────────────────────
function CoachAddEntry({ onSave, onCancel }) {
  const [form, setForm] = useState({ date: today(), coachNote: "" });
  return (
    <Card className="p-4 border-orange-200 bg-orange-50 flex flex-col gap-3">
      <div className="text-orange-600 text-xs font-bold">📝 教練新增指導紀錄</div>
      <Inp label="日期" type="date" value={form.date}
        onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
      <TA label="指導內容" value={form.coachNote} rows={5}
        placeholder="輸入今天的指導內容、觀察重點、下次練習目標…"
        onChange={e => setForm(p => ({ ...p, coachNote: e.target.value }))} />
      <div className="flex gap-2">
        <Btn v="secondary" className="flex-1" onClick={onCancel}>取消</Btn>
        <Btn v="warn" className="flex-1" onClick={() => onSave(form)} disabled={!form.coachNote.trim()}>
          新增紀錄
        </Btn>
      </div>
    </Card>
  );
}