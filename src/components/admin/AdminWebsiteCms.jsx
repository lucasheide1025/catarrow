import { useEffect, useMemo, useRef, useState } from "react";
import {
  EMPTY_CMS_CONTENT,
  WEBSITE_CMS_PAGES,
  loadWebsiteContent,
  publishWebsiteContent,
  saveWebsiteDraft,
  uploadWebsiteImage,
} from "../../lib/websiteCms";

const PUBLIC_ORIGIN = "https://archery.catgroup.com.tw";
const cloneEmpty = () => ({ text: {}, images: {} });

function previewUrl(page) {
  const local = window.location.hostname === "localhost"
    ? "http://127.0.0.1:4173/website"
    : PUBLIC_ORIGIN;
  return `${local}${page.path}${page.path.includes("?") ? "&" : "?"}cmsPreview=1&pageId=${page.id}`;
}

export default function AdminWebsiteCms() {
  const [pageId, setPageId] = useState(WEBSITE_CMS_PAGES[0].id);
  const [manifest, setManifest] = useState({ text: [], images: [] });
  const [content, setContent] = useState(cloneEmpty);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const frameRef = useRef(null);
  const page = useMemo(() => WEBSITE_CMS_PAGES.find(item => item.id === pageId), [pageId]);

  useEffect(() => {
    let active = true;
    setManifest({ text: [], images: [] });
    setSelected(null);
    loadWebsiteContent(pageId)
      .then(data => { if (active) setContent(data.draft || cloneEmpty()); })
      .catch(error => { if (active) setNotice(`載入失敗：${error.message}`); });
    return () => { active = false; };
  }, [pageId]);

  useEffect(() => {
    const receive = event => {
      if (event.data?.type !== "CAT_ARCHERY_CMS_MANIFEST" || event.data.pageId !== pageId) return;
      setManifest({ text: event.data.text || [], images: event.data.images || [] });
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [pageId]);

  useEffect(() => {
    frameRef.current?.contentWindow?.postMessage({
      type: "CAT_ARCHERY_CMS_PREVIEW",
      pageId,
      content,
      selected,
    }, "*");
  }, [content, pageId, selected]);

  const updateText = (key, value) => setContent(current => ({
    ...current,
    text: { ...current.text, [key]: value },
  }));
  const updateImage = (key, patch) => setContent(current => ({
    ...current,
    images: { ...current.images, [key]: { ...(current.images[key] || {}), ...patch } },
  }));
  const run = async (label, action) => {
    setBusy(true);
    setNotice("");
    try {
      await action();
      setNotice(`${label}完成`);
    } catch (error) {
      setNotice(`${label}失敗：${error.message}`);
    } finally {
      setBusy(false);
    }
  };
  const resetDraft = () => {
    setContent({ ...EMPTY_CMS_CONTENT, text: {}, images: {} });
    setNotice("已在畫面恢復預設內容，按「儲存草稿」或「發布」才會保存");
  };

  return (
    <div className="p-4 md:p-6 text-slate-100">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl font-black">🌐 官網內容管理</h1>
            <p className="text-sm text-slate-400 mt-1">點選欄位編輯，草稿不影響訪客；只有按下發布才會更新官網。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={resetDraft} disabled={busy} className="px-4 py-2 rounded-xl bg-slate-700 font-bold text-sm">恢復預設</button>
            <button onClick={() => run("儲存草稿", () => saveWebsiteDraft(pageId, content))} disabled={busy}
              className="px-4 py-2 rounded-xl bg-indigo-600 font-bold text-sm">{busy ? "處理中…" : "儲存草稿"}</button>
            <button onClick={() => run("發布", () => publishWebsiteContent(pageId, content))} disabled={busy}
              className="px-4 py-2 rounded-xl bg-emerald-600 font-black text-sm">🚀 發布官網</button>
          </div>
        </div>

        {notice && <div className="mb-4 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-200">{notice}</div>}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-3">
          {WEBSITE_CMS_PAGES.map(item => <button key={item.id} onClick={() => setPageId(item.id)}
            className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold border ${pageId === item.id ? "bg-orange-500 border-orange-400 text-white" : "bg-slate-900 border-slate-700 text-slate-300"}`}>
            {item.label}
          </button>)}
        </div>

        <div className="grid lg:grid-cols-[380px_minmax(0,1fr)] gap-4">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-3 max-h-[72vh] overflow-y-auto">
            <div className="font-bold mb-3">{page.label}可編輯內容</div>
            {!manifest.text.length && !manifest.images.length && (
              <div className="text-sm text-amber-300 bg-amber-500/10 rounded-xl p-3">等待右側官網預覽載入。正式網站尚未包含編輯標記時，需先發布本次程式版本。</div>
            )}
            <div className="space-y-3">
              {manifest.text.map(item => {
                const value = content.text[item.key] ?? item.value;
                return <label key={item.key} onClick={() => setSelected(item.key)} className="block">
                  <span className="block text-xs font-bold text-slate-400 mb-1">{item.label}</span>
                  <textarea value={value} rows={Math.min(5, Math.max(2, Math.ceil(value.length / 28)))}
                    onChange={event => updateText(item.key, event.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-orange-400" />
                </label>;
              })}
              {manifest.images.map(item => {
                const image = content.images[item.key] || {};
                const src = image.src || item.src;
                return <div key={item.key} onClick={() => setSelected(item.key)} className="rounded-xl border border-slate-700 p-3">
                  <div className="text-xs font-bold text-slate-400 mb-2">{item.label}</div>
                  <img src={src} alt="" className="w-full max-h-36 object-contain rounded-lg bg-white/5 mb-2" />
                  <input value={image.src || ""} placeholder="圖片網址（留空使用原圖）"
                    onChange={event => updateImage(item.key, { src: event.target.value })}
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs mb-2" />
                  <input value={image.alt ?? item.alt} placeholder="圖片替代文字"
                    onChange={event => updateImage(item.key, { alt: event.target.value })}
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs mb-2" />
                  <label className="block text-center cursor-pointer rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold">
                    上傳替換圖片
                    <input type="file" accept="image/*" className="hidden" onChange={async event => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      await run("圖片上傳", async () => updateImage(item.key, { src: await uploadWebsiteImage(pageId, file, item.key) }));
                      event.target.value = "";
                    }} />
                  </label>
                </div>;
              })}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-2 min-h-[70vh]">
            <div className="text-xs text-slate-400 px-2 py-1">即時預覽（點左側欄位即可在這裡看到變更）</div>
            <iframe ref={frameRef} key={pageId} src={previewUrl(page)} title={`${page.label}預覽`}
              className="w-full h-[70vh] rounded-xl bg-white border-0" onLoad={() => {
                frameRef.current?.contentWindow?.postMessage({ type: "CAT_ARCHERY_CMS_REQUEST", pageId }, "*");
              }} />
          </div>
        </div>
      </div>
    </div>
  );
}

