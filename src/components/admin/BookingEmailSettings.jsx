import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import app, { db } from "../../lib/firebase";
import {
  BOOKING_EMAIL_TEMPLATE_META, DEFAULT_BOOKING_EMAIL_CONFIG, mergeBookingEmailConfig,
  renderBookingEmailPreview,
} from "../../lib/bookingEmailConfig";
import { Btn, Card, Inp, Spinner } from "../shared/UI";

const functions = getFunctions(app, "asia-east1");

function invalidTokens(templateId, template) {
  const allowed = new Set(BOOKING_EMAIL_TEMPLATE_META[templateId].tokens);
  const values = [template.subject, template.text];
  const found = values.flatMap(value => [...String(value || "").matchAll(/{{([^{}]+)}}/g)].map(match => match[1]));
  const invalid = found.filter(token => !allowed.has(token));
  const remainder = values.map(value => String(value || "").replace(/{{[^{}]+}}/g, "")).join("");
  if (remainder.includes("{{") || remainder.includes("}}")) invalid.push("格式不完整");
  return [...new Set(invalid)];
}

export default function BookingEmailSettings({ toast }) {
  const [config, setConfig] = useState(null);
  const [selectedId, setSelectedId] = useState("studentConfirmed");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    getDoc(doc(db, "bookingEmailConfig", "main"))
      .then(snapshot => setConfig(mergeBookingEmailConfig(snapshot.exists() ? snapshot.data() : {})))
      .catch(error => {
        console.error("讀取 Email 設定失敗", error);
        toast("讀取 Email 設定失敗", "error");
        setConfig(mergeBookingEmailConfig());
      });
  }, [toast]);

  const selected = config?.templates[selectedId];
  const badTokens = useMemo(() => selected ? invalidTokens(selectedId, selected) : [], [selectedId, selected]);

  function updateConfig(patch) { setConfig(current => ({ ...current, ...patch })); }
  function updateTemplate(patch) {
    setConfig(current => ({
      ...current,
      templates: { ...current.templates, [selectedId]: { ...current.templates[selectedId], ...patch } },
    }));
  }
  function insertToken(token) { updateTemplate({ text: `${selected.text}${selected.text.endsWith("\n") || !selected.text ? "" : " "}{{${token}}}` }); }

  function validate() {
    if (!config.coachTo.trim() || config.coachBcc.some(email => !email.trim())) return "請填寫有效的教練 Email";
    if (!Number.isInteger(Number(config.dailyLimit)) || Number(config.dailyLimit) < 1 || Number(config.dailyLimit) > 50) return "每日上限必須是 1 到 50";
    for (const [id, template] of Object.entries(config.templates)) {
      if (!template.subject.trim() || template.subject.trim().length > 200) return `${BOOKING_EMAIL_TEMPLATE_META[id].label}主旨須為 1–200 字`;
      if (!template.text.trim() || template.text.trim().length > 10000) return `${BOOKING_EMAIL_TEMPLATE_META[id].label}內文須為 1–10000 字`;
      const invalid = invalidTokens(id, template);
      if (invalid.length) return `${BOOKING_EMAIL_TEMPLATE_META[id].label}含不支援變數：${invalid.join("、")}`;
    }
    return "";
  }

  async function save() {
    const error = validate();
    if (error) { toast(error, "error"); return; }
    setBusy("save");
    try {
      await httpsCallable(functions, "saveBookingEmailConfig")({ ...config, dailyLimit: Number(config.dailyLimit) });
      toast("Email 設定已儲存 ✓");
    } catch (err) { toast(`儲存失敗：${err?.message || "未知錯誤"}`, "error"); }
    setBusy("");
  }

  async function sendTest() {
    const error = validate();
    if (error) { toast(error, "error"); return; }
    setBusy("test");
    try {
      const requestId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const result = await httpsCallable(functions, "sendBookingEmailTest")({ requestId, templateId: selectedId, config: { ...config, dailyLimit: Number(config.dailyLimit) } });
      toast(result.data.queued ? `測試信已送往 ${result.data.recipient} ✓` : "這封測試信已經送出");
    } catch (err) { toast(`測試信失敗：${err?.message || "未知錯誤"}`, "error"); }
    setBusy("");
  }

  if (!config) return <Spinner />;

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4 flex flex-col gap-3">
        <div className="font-bold text-white">通知設定</div>
        <label className="flex items-center justify-between gap-3 text-sm text-slate-200">
          <span><b>預約狀態 Email</b><span className="block text-xs text-slate-500">開啟後，新預約、改期與取消會即時寄信</span></span>
          <input type="checkbox" className="w-5 h-5 accent-blue-500" checked={config.enabled} onChange={event => updateConfig({ enabled: event.target.checked })} />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm text-slate-200">
          <span><b>兩週未預約提醒</b><span className="block text-xs text-slate-500">排程功能完成並確認 dry-run 名單後再開啟</span></span>
          <input type="checkbox" className="w-5 h-5 accent-blue-500" checked={config.inactivityEnabled} onChange={event => updateConfig({ inactivityEnabled: event.target.checked })} />
        </label>
        <Inp label="每日提醒上限（1–50）" type="number" min="1" max="50" value={config.dailyLimit} onChange={event => updateConfig({ dailyLimit: event.target.value })} />
        <Inp label="主要教練收件者（To）" type="email" value={config.coachTo} onChange={event => updateConfig({ coachTo: event.target.value })} />
        <Inp label="其他教練（BCC，以逗號分隔）" value={config.coachBcc.join(", ")} onChange={event => updateConfig({ coachBcc: event.target.value.split(",").map(value => value.trim()).filter(Boolean) })} />
      </Card>

      <Card className="p-4 flex flex-col gap-3">
        <div className="font-bold text-white">純文字範本</div>
        <label htmlFor="booking-email-template" className="text-xs text-slate-400">選擇範本</label>
        <select id="booking-email-template" className="bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-white" value={selectedId} onChange={event => setSelectedId(event.target.value)}>
          {Object.entries(BOOKING_EMAIL_TEMPLATE_META).map(([id, meta]) => <option key={id} value={id}>{meta.label}</option>)}
        </select>
        <Inp label="主旨" value={selected.subject} maxLength={200} onChange={event => updateTemplate({ subject: event.target.value })} />
        <label className="text-xs text-slate-400">內文
          <textarea className="mt-1 w-full min-h-56 bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-sm text-white leading-relaxed" maxLength={10000} value={selected.text} onChange={event => updateTemplate({ text: event.target.value })} />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {BOOKING_EMAIL_TEMPLATE_META[selectedId].tokens.map(token => (
            <button key={token} type="button" onClick={() => insertToken(token)} className="rounded-lg bg-blue-500/15 border border-blue-400/25 px-2 py-1 text-xs text-blue-300">{`{{${token}}}`}</button>
          ))}
        </div>
        {badTokens.length > 0 && <div role="alert" className="text-red-400 text-xs">不支援的變數：{badTokens.join("、")}</div>}
        <div className="rounded-xl bg-black/20 border border-white/10 p-3">
          <div className="text-xs font-bold text-slate-400 mb-2">範例預覽</div>
          <div className="text-white font-bold text-sm">{renderBookingEmailPreview(selected.subject)}</div>
          <div className="text-slate-300 text-sm whitespace-pre-wrap mt-2">{renderBookingEmailPreview(selected.text)}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn v="secondary" size="sm" onClick={() => updateTemplate(DEFAULT_BOOKING_EMAIL_CONFIG.templates[selectedId])}>恢復此範本預設值</Btn>
          <Btn v="secondary" size="sm" disabled={!!busy} onClick={sendTest}>{busy === "test" ? "寄送中…" : "寄測試信"}</Btn>
          <Btn v="primary" size="sm" disabled={!!busy} onClick={save}>{busy === "save" ? "儲存中…" : "儲存全部設定"}</Btn>
        </div>
      </Card>
    </div>
  );
}
