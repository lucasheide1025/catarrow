import { useEffect, useMemo, useState } from "react";
import { collection, doc, limit, onSnapshot, query } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import app, { db } from "../../lib/firebase";
import { Btn, Card, Inp, Sel, Spinner, TA } from "../shared/UI";

const functions = getFunctions(app, "asia-east1");
const saveConfigFn = httpsCallable(functions, "saveMarketingEmailConfig");
const previewAudienceFn = httpsCallable(functions, "previewMarketingAudience");
const createCampaignFn = httpsCallable(functions, "createMarketingCampaign");
const startCampaignFn = httpsCallable(functions, "startMarketingCampaign");
const pauseCampaignFn = httpsCallable(functions, "pauseMarketingCampaign");
const resumeCampaignFn = httpsCallable(functions, "resumeMarketingCampaign");

const DEFAULT_CONFIG = { enabled:false, hourlyLimit:20, dailyLimit:100, trackingEnabled:true };
const DEFAULT_FORM = { name:"", audience:"all", subject:"", text:"", html:"", trackingEnabled:true };
const AUDIENCE_OPTIONS = [
  { value:"all", label:"學籍學生 + 訪客" },
  { value:"official", label:"只有學籍學生" },
  { value:"guest", label:"只有訪客" },
];

const STATUS_LABELS = {
  draft:"草稿", queued:"建立佇列中", running:"寄送中", paused:"已暫停", completed:"已完成",
};

function formatDate(value) {
  const date = value?.toDate?.();
  return date ? date.toLocaleString("zh-TW", { hour12:false }) : "—";
}

function escapedTextHtml(text) {
  const safe = String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  return `<div style="font-family:Arial,'Noto Sans TC',sans-serif;white-space:pre-wrap;line-height:1.7;padding:20px">${safe}</div>`;
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-0.5 text-lg font-black text-slate-100">{Number(value || 0).toLocaleString()}</div>
    </div>
  );
}

export default function AdminMarketingEmail() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [campaigns, setCampaigns] = useState([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [audienceStats, setAudienceStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, "marketingEmailConfig", "main"), snap => {
      setConfig({ ...DEFAULT_CONFIG, ...(snap.exists() ? snap.data() : {}) });
    }, err => setError(err.message));
    const unsubCampaigns = onSnapshot(query(collection(db, "marketingCampaigns"), limit(50)), snap => {
      const rows = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      rows.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setCampaigns(rows);
      setLoading(false);
    }, err => { setError(err.message); setLoading(false); });
    return () => { unsubConfig(); unsubCampaigns(); };
  }, []);

  const previewHtml = useMemo(
    () => form.html.trim() || escapedTextHtml(form.text),
    [form.html, form.text],
  );

  async function run(key, action) {
    setBusy(key);
    setError("");
    setNotice("");
    try { return await action(); }
    catch (err) {
      const message = err?.message || String(err);
      setError(message);
      throw err;
    } finally { setBusy(""); }
  }

  async function saveConfig() {
    await run("config", async () => {
      const result = await saveConfigFn({
        enabled:config.enabled === true,
        hourlyLimit:Number(config.hourlyLimit),
        dailyLimit:Number(config.dailyLimit),
        trackingEnabled:config.trackingEnabled !== false,
      });
      setConfig(prev => ({ ...prev, ...(result.data?.config || {}) }));
      setNotice("Email 寄送設定已儲存。");
    });
  }

  async function previewAudience() {
    await run("preview", async () => {
      const result = await previewAudienceFn({ audience:form.audience });
      setAudienceStats(result.data?.stats || null);
      setNotice("已重新計算目前可寄送人數；不會把完整 Email 名單下載到前端。");
    });
  }

  async function createCampaign() {
    await run("create", async () => {
      const result = await createCampaignFn(form);
      setNotice(`Campaign 已建立為草稿：${result.data?.campaignId || ""}`);
      setForm(DEFAULT_FORM);
      setAudienceStats(null);
    });
  }

  async function startCampaign(campaign) {
    if (!window.confirm(`確定開始「${campaign.name}」？系統只會將 marketingOptIn=true 的收件人加入佇列。`)) return;
    await run(`start:${campaign.id}`, async () => {
      const result = await startCampaignFn({ campaignId:campaign.id });
      setNotice(`已建立寄送佇列，共 ${Number(result.data?.queued || 0).toLocaleString()} 個唯一 Email。`);
    });
  }

  async function pauseCampaign(campaign) {
    await run(`pause:${campaign.id}`, async () => {
      await pauseCampaignFn({ campaignId:campaign.id });
      setNotice(`「${campaign.name}」已暫停，後續整點不會繼續排入寄送。`);
    });
  }

  async function resumeCampaign(campaign) {
    await run(`resume:${campaign.id}`, async () => {
      await resumeCampaignFn({ campaignId:campaign.id });
      setNotice(`「${campaign.name}」已恢復。`);
    });
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4 pb-24">
      <Card className="p-4 md:p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-100">📧 Email 通知</h2>
            <p className="mt-1 text-sm text-slate-400">優惠、活動與比賽資訊的分批寄送後台。寄件沿用 Firebase Trigger Email。</p>
          </div>
          <div className={`rounded-full px-3 py-1 text-xs font-bold ${config.enabled ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-700/70 text-slate-400"}`}>
            {config.enabled ? "排程已啟用" : "排程已停用"}
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-6 text-amber-100">
          <b>同意制：</b>只有資料庫內 <code>marketingOptIn=true</code> 的學籍學生或訪客才會進入寄送名單；「有 Email」本身不代表已同意接收優惠或行銷通知。兒童帳號永遠排除。
        </div>
        <div className="mt-3 rounded-xl border border-sky-500/20 bg-sky-500/10 p-3 text-xs leading-6 text-sky-100">
          <b>開信統計：</b>Apple Mail Privacy Protection、Gmail/其他圖片代理可能預先載入或代載圖片，因此開信率只能看趨勢，不能當成精準的真人閱讀率。
        </div>
      </Card>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
      {notice && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{notice}</div>}

      <Card className="p-4 md:p-5">
        <h3 className="font-black text-slate-100">寄送節流設定</h3>
        <p className="mt-1 text-xs text-slate-500">每小時／每日上限是正常的寄送節流與成本控制，不用來繞過郵件服務商的垃圾郵件限制。</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Inp label="每小時最多排入寄送" type="number" min="1" max="100" value={config.hourlyLimit} onChange={e => setConfig(c => ({ ...c, hourlyLimit:e.target.value }))} />
          <Inp label="每天最多排入寄送" type="number" min="1" max="1000" value={config.dailyLimit} onChange={e => setConfig(c => ({ ...c, dailyLimit:e.target.value }))} />
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-300">
          <label className="flex items-center gap-2"><input type="checkbox" checked={config.enabled === true} onChange={e => setConfig(c => ({ ...c, enabled:e.target.checked }))} /> 啟用每小時排程</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={config.trackingEnabled !== false} onChange={e => setConfig(c => ({ ...c, trackingEnabled:e.target.checked }))} /> 允許 Campaign 開信統計</label>
        </div>
        <div className="mt-4"><Btn onClick={saveConfig} disabled={busy === "config"}>{busy === "config" ? "儲存中…" : "儲存設定"}</Btn></div>
      </Card>

      <Card className="p-4 md:p-5">
        <h3 className="font-black text-slate-100">建立 Campaign</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Inp label="Campaign 名稱" placeholder="例如：9/19 會內賽通知" value={form.name} onChange={e => setForm(f => ({ ...f, name:e.target.value }))} />
          <Sel label="收件對象" options={AUDIENCE_OPTIONS} value={form.audience} onChange={e => { setForm(f => ({ ...f, audience:e.target.value })); setAudienceStats(null); }} />
        </div>
        <div className="mt-3"><Inp label="Email 主旨" placeholder="貓小隊射箭場｜9/19 會內賽開始報名" value={form.subject} onChange={e => setForm(f => ({ ...f, subject:e.target.value }))} /></div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <TA label="純文字內容" rows={10} value={form.text} onChange={e => setForm(f => ({ ...f, text:e.target.value }))} placeholder="建議一定填寫，部分郵件客戶端會優先顯示純文字版本。" />
          <TA label="HTML 內容（可選）" rows={10} value={form.html} onChange={e => setForm(f => ({ ...f, html:e.target.value }))} placeholder="留空時會把純文字安全轉成 HTML。" />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.trackingEnabled !== false} onChange={e => setForm(f => ({ ...f, trackingEnabled:e.target.checked }))} /> 此 Campaign 使用開信趨勢統計</label>

        <div className="mt-4 flex flex-wrap gap-2">
          <Btn v="secondary" onClick={previewAudience} disabled={busy === "preview"}>{busy === "preview" ? "計算中…" : "預覽收件人數"}</Btn>
          <Btn onClick={createCampaign} disabled={busy === "create"}>{busy === "create" ? "建立中…" : "建立草稿"}</Btn>
        </div>

        {audienceStats && (
          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-6">
            <Stat label="掃描帳號" value={audienceStats.scanned} />
            <Stat label="可寄唯一 Email" value={audienceStats.eligible} />
            <Stat label="未同意" value={audienceStats.notOptedIn} />
            <Stat label="Email 無效" value={audienceStats.invalid} />
            <Stat label="永久拒收" value={audienceStats.suppressed} />
            <Stat label="重複 Email" value={audienceStats.duplicate} />
          </div>
        )}

        {(form.html.trim() || form.text.trim()) && (
          <div className="mt-5">
            <div className="mb-2 text-xs font-bold text-slate-400">內容預覽（sandboxed iframe）</div>
            <iframe title="Email HTML 預覽" sandbox="" srcDoc={previewHtml} className="h-72 w-full rounded-xl border border-white/10 bg-white" />
          </div>
        )}
      </Card>

      <Card className="p-4 md:p-5">
        <h3 className="font-black text-slate-100">Campaign 紀錄</h3>
        <div className="mt-4 space-y-3">
          {campaigns.length === 0 && <div className="py-8 text-center text-sm text-slate-500">目前沒有 Campaign。</div>}
          {campaigns.map(campaign => {
            const stats = campaign.stats || {};
            const actionBusy = busy.endsWith(`:${campaign.id}`);
            return (
              <div key={campaign.id} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-black text-slate-100">{campaign.name}</div>
                      <span className="rounded-full bg-slate-700/70 px-2 py-0.5 text-[11px] font-bold text-slate-300">{STATUS_LABELS[campaign.status] || campaign.status}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{campaign.subject} · {AUDIENCE_OPTIONS.find(o => o.value === campaign.audience)?.label || campaign.audience} · {formatDate(campaign.createdAt)}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {campaign.status === "draft" && <Btn size="sm" onClick={() => startCampaign(campaign)} disabled={actionBusy}>開始寄送</Btn>}
                    {campaign.status === "running" && <Btn size="sm" v="warn" onClick={() => pauseCampaign(campaign)} disabled={actionBusy}>暫停</Btn>}
                    {campaign.status === "paused" && <Btn size="sm" v="success" onClick={() => resumeCampaign(campaign)} disabled={actionBusy}>恢復</Btn>}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  <Stat label="佇列" value={stats.queued} />
                  <Stat label="寄送成功" value={stats.sent} />
                  <Stat label="失敗" value={stats.failed} />
                  <Stat label="開信趨勢" value={stats.opened} />
                  <Stat label="退訂" value={stats.unsubscribed} />
                  <Stat label="拒收排除" value={stats.suppressed} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
