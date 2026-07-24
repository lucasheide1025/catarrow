import React, { useState } from 'react';
import { useCatalog } from '../../context/CatalogContext';

export const TaobaoConfigModal = ({ isOpen, onClose }) => {
  const { startTaobaoCrawlQueue, isScrapingTaobao, crawlProgress } = useCatalog();
  const [storeUrl, setStoreUrl] = useState('https://thxs.world.taobao.com/category.htm?appUid=RAzN8HB232So7A9R1nJWU12KS494Ak');
  const [syncMode, setSyncMode] = useState('all');
  const [slowCrawl, setSlowCrawl] = useState(true);
  const [rawHtmlText, setRawHtmlText] = useState('');
  const [activeTab, setActiveTab] = useState('url');
  const [scriptCopied, setScriptCopied] = useState(false);

  if (!isOpen) return null;

  // 100% 安全單行下載 HTML 腳本 (無字元斷行問題)
  const cleanScript = `var step=300;var timer=setInterval(function(){window.scrollBy(0,step);if((window.innerHeight+window.scrollY)>=document.body.scrollHeight){clearInterval(timer);window.scrollTo(0,0);var blob=new Blob([document.documentElement.outerHTML],{type:'text/html'});var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='taohua_archery_store.html';document.body.appendChild(a);a.click();document.body.removeChild(a);}},200);`;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(cleanScript);
    setScriptCopied(true);
    setTimeout(() => setScriptCopied(false), 3000);
  };

  const handleStartSync = () => {
    startTaobaoCrawlQueue({
      storeUrl,
      syncMode,
      slowCrawl,
      rawHtmlText: activeTab === 'raw_html' ? rawHtmlText : null
    });
  };

  const progressPercent = crawlProgress.total > 0
    ? Math.round((crawlProgress.current / crawlProgress.total) * 100)
    : 0;

  return (
    <div
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 text-slate-100 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 標題 */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-lg">🕷️</span>
            <h3 className="text-base font-bold text-white">淘寶店鋪全店自動爬蟲引擎</h3>
          </div>
          {!isScrapingTaobao && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xs bg-slate-800 p-1.5 rounded-full"
            >
              ✕
            </button>
          )}
        </div>

        {/* 實時爬取進度條 */}
        {isScrapingTaobao ? (
          <div className="py-6 space-y-4">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-amber-400">正在全店掃描與逐一寫入型錄中...</span>
              <span className="text-slate-300">{crawlProgress.current} / {crawlProgress.total} ({progressPercent}%)</span>
            </div>

            {/* 進度條 */}
            <div className="w-full bg-slate-950 rounded-full h-3 border border-slate-800 overflow-hidden">
              <div
                className="bg-amber-500 h-full transition-all duration-200"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* 爬蟲 Log 訊息 */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 min-h-[60px] flex items-center truncate">
              {crawlProgress.logName}
            </div>

            <div className="text-[11px] text-slate-500 text-center">
              💡 提示：您可隨時觀看背景頁面，商品正一張張即時新增至「太華玄聖」分類中！
            </div>
          </div>
        ) : (
          <>
            {/* 分頁切換 */}
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 mb-4 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('url')}
                className={`flex-1 py-1.5 rounded transition-colors ${
                  activeTab === 'url' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🔗 淘寶店鋪網址 (URL)
              </button>
              <button
                onClick={() => setActiveTab('raw_html')}
                className={`flex-1 py-1.5 rounded transition-colors ${
                  activeTab === 'raw_html' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                📋 頁面原始碼貼上 (備援)
              </button>
            </div>

            {activeTab === 'url' ? (
              <div className="space-y-4 text-xs">
                {/* 檔案上傳選擇器 (直接解析下載的 taohua_archery_store.html) */}
                <div className="p-3 bg-slate-950 border border-amber-500/40 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-amber-300 text-xs">📁 匯入已下載的店鋪 HTML 檔案</span>
                    <span className="text-[10px] text-amber-400/80">最推薦，全店 100% 寫入</span>
                  </div>
                  <input
                    type="file"
                    accept=".html,.htm"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          setRawHtmlText(event.target.result);
                          setActiveTab('raw_html');
                        };
                        reader.readAsText(file);
                      }
                    }}
                    className="w-full text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-400 cursor-pointer"
                  />
                  <div className="text-[10px] text-slate-400">
                    選擇剛才自動下載的 <code className="text-amber-300 font-mono">taohua_archery_store.html</code> 檔案，系統自動讀取與剖析。
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">
                    淘寶店鋪連結 (例如: 太華玄聖):
                  </label>
                  <input
                    type="text"
                    value={storeUrl}
                    onChange={(e) => setStoreUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <span className="text-[10px] text-amber-400/80 mt-1 block">
                    ✓ 已成功偵測店鋪：太華玄聖 (thxs.world.taobao.com)
                  </span>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">爬取與同步模式:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSyncMode('all')}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        syncMode === 'all'
                          ? 'bg-amber-500/10 border-amber-500 text-amber-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="font-bold mb-0.5">🛍️ 全店商品逐一抓取</div>
                      <div className="text-[10px] text-slate-400">自動掃描全店分類並即時匯入完整規格</div>
                    </button>
                    <button
                      onClick={() => setSyncMode('price_only')}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        syncMode === 'price_only'
                          ? 'bg-amber-500/10 border-amber-500 text-amber-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="font-bold mb-0.5">🔄 機動更新最新價格</div>
                      <div className="text-[10px] text-slate-400">比對最新人民幣售價與外匯匯率</div>
                    </button>
                  </div>
                </div>

                {/* 擬人慢速防淘寶封鎖 Toggle */}
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-200">🛡️ 擬人化慢速防封鎖 (Anti-Bot Protection)</div>
                    <div className="text-[10px] text-slate-400">隨機間隔 1.2~2.5 秒延遲，模擬人類瀏覽，避免淘寶風控 IP</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={slowCrawl}
                    onChange={(e) => setSlowCrawl(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </div>

                {/* 一鍵複製下載腳本按鈕 */}
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-amber-300 text-xs">🚀 淘寶全店 100% 完整抓取腳本</span>
                    <button
                      onClick={handleCopyScript}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shadow"
                    >
                      {scriptCopied ? '✓ 已複製腳本！' : '📋 點擊複製無斷行腳本'}
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    點擊複製後，到「太華玄聖」淘寶分頁按 F12 貼上 Console，即可自動滾動並下載 <code className="text-amber-300 font-mono">taohua_archery_store.html</code>！
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                <label className="block text-slate-400 font-semibold">
                  太華玄聖 淘寶頁面原始碼貼上:
                </label>
                <textarea
                  rows={6}
                  value={rawHtmlText}
                  onChange={(e) => setRawHtmlText(e.target.value)}
                  placeholder="可直接貼上淘寶商品頁內容..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-amber-500"
                />
              </div>
            )}

            {/* 底部按鈕 */}
            <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end space-x-2">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleStartSync}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold shadow transition-colors"
              >
                🚀 開始執行全店爬取 (太華玄聖)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
