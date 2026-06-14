// src/components/admin/AdminEquipItems.jsx — 後台虛擬裝備品項管理
import { useState, useEffect } from "react";
import { subscribeEquipItems, createEquipItem, updateEquipItem, deleteEquipItem } from "../../lib/db";
import { EQUIP_SLOT_DEFS } from "../../lib/constants";

const EMPTY_FORM = { slotId: "bow", name: "", brand: "", desc: "" };

export default function AdminEquipItems() {
  const [items,   setItems]   = useState([]);
  const [form,    setForm]    = useState(EMPTY_FORM);
  const [editId,  setEditId]  = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState("");
  const [selSlot, setSelSlot] = useState("all");

  useEffect(() => subscribeEquipItems(setItems), []);

  function showMsg(text) { setMsg(text); setTimeout(() => setMsg(""), 3000); }

  function handleEdit(item) {
    setEditId(item.id);
    setForm({ slotId: item.slotId, name: item.name || "", brand: item.brand || "", desc: item.desc || "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCancel() {
    setEditId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSave() {
    if (!form.name.trim()) return showMsg("❌ 請輸入品項名稱");
    setSaving(true);
    const payload = {
      slotId: form.slotId,
      name:   form.name.trim(),
      brand:  form.brand.trim(),
      desc:   form.desc.trim(),
    };
    const result = editId
      ? await updateEquipItem(editId, payload)
      : await createEquipItem({ ...payload, order: items.filter(i => i.slotId === form.slotId).length });
    setSaving(false);
    if (result.ok) {
      showMsg(editId ? "✅ 已更新" : "✅ 已新增");
      setForm(EMPTY_FORM);
      setEditId(null);
    } else {
      showMsg(`❌ ${result.reason}`);
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`確定要刪除「${name}」？`)) return;
    const r = await deleteEquipItem(id);
    showMsg(r.ok ? "已刪除" : `❌ ${r.reason}`);
    if (editId === id) handleCancel();
  }

  const displayItems = selSlot === "all" ? items : items.filter(i => i.slotId === selSlot);

  // 按 slotId 分組，並依 EQUIP_SLOT_DEFS 順序排列
  const grouped = EQUIP_SLOT_DEFS.map(s => ({
    slot:  s,
    items: displayItems.filter(i => i.slotId === s.id),
  })).filter(g => selSlot === "all" || g.slot.id === selSlot);

  return (
    <div className="p-4 pb-10">
      <div className="font-black text-base text-slate-800 mb-4">⚔️ 裝備品項管理</div>

      {/* ── 新增 / 編輯表單 ─────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-5">
        <div className="text-sm font-bold text-slate-700 mb-3">
          {editId ? "✏️ 編輯品項" : "➕ 新增品項"}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <div className="text-[11px] text-slate-500 mb-1">槽位 *</div>
            <select
              value={form.slotId}
              onChange={e => setForm(f => ({ ...f, slotId: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white">
              {EQUIP_SLOT_DEFS.map(s => (
                <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 mb-1">品牌</div>
            <input
              value={form.brand}
              onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
              placeholder="Hoyt"
              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm" />
          </div>
        </div>

        <div className="mb-2">
          <div className="text-[11px] text-slate-500 mb-1">品項名稱 *</div>
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="例：Hoyt 競技弓"
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm" />
        </div>

        <div className="mb-3">
          <div className="text-[11px] text-slate-500 mb-1">描述</div>
          <input
            value={form.desc}
            onChange={e => setForm(f => ({ ...f, desc: e.target.value }))}
            placeholder="例：精品競技弓，適合進階選手"
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm" />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-sm font-black disabled:opacity-40 active:scale-95 transition-transform">
            {saving ? "儲存中…" : editId ? "更新品項" : "新增品項"}
          </button>
          {editId && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold border border-slate-200">
              取消
            </button>
          )}
        </div>

        {msg && (
          <div className="mt-2 text-center text-xs text-slate-600 font-bold">{msg}</div>
        )}
      </div>

      {/* ── 槽位篩選 Tabs ──────────────────────────────── */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        <button
          onClick={() => setSelSlot("all")}
          className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${
            selSlot === "all"
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-slate-500 border-slate-200"
          }`}>
          全部 ({items.length})
        </button>
        {EQUIP_SLOT_DEFS.map(s => {
          const count = items.filter(i => i.slotId === s.id).length;
          return (
            <button key={s.id}
              onClick={() => setSelSlot(s.id)}
              className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                selSlot === s.id
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-500 border-slate-200"
              }`}>
              {s.icon} {s.name} ({count})
            </button>
          );
        })}
      </div>

      {/* ── 品項列表 ───────────────────────────────────── */}
      {grouped.every(g => g.items.length === 0) && (
        <div className="text-center text-slate-400 text-sm py-10">
          <div className="text-3xl mb-2">📦</div>
          尚未新增任何裝備品項，請從上方表單新增
        </div>
      )}

      {grouped.map(({ slot, items: slotItems }) => {
        if (slotItems.length === 0) return null;
        return (
          <div key={slot.id} className="mb-5">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-base">{slot.icon}</span>
              <span className="text-xs font-black text-slate-600">{slot.name}</span>
              <span className="text-[10px] text-slate-400 ml-1">
                ({slotItems.length} 項)
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {slotItems.map(item => (
                <div key={item.id}
                  className={`flex items-center gap-3 bg-white rounded-xl border px-3 py-2.5 shadow-sm transition-all ${
                    editId === item.id ? "border-blue-400 bg-blue-50/30" : "border-slate-200"
                  }`}>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-slate-800">{item.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {[item.brand, item.desc].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <button
                    onClick={() => handleEdit(item)}
                    className="shrink-0 text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 font-bold border border-blue-100 active:scale-95">
                    編輯
                  </button>
                  <button
                    onClick={() => handleDelete(item.id, item.name)}
                    className="shrink-0 text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-500 font-bold border border-red-100 active:scale-95">
                    刪除
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
