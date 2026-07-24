import React, { useState } from 'react';
import { useCatalog } from '../../context/CatalogContext';
import { TaobaoConfigModal } from './TaobaoConfigModal';

export const CatalogHeader = () => {
  const {
    viewMode,
    setViewMode,
    targetCurrency,
    setTargetCurrency,
    syncTaobaoStore,
    clearCatalog,
    isScrapingTaobao,
    searchQuery,
    setSearchQuery
  } = useCatalog();

  const [isTaobaoModalOpen, setIsTaobaoModalOpen] = useState(false);

  return (
    <header className="bg-slate-900 border-b border-slate-800 p-4 text-white">
      <div className="max-w-7xl mx-mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* 左側標題與預覽標籤 */}
        <div className="flex items-center space-x-3">
          <div className="bg-amber-500 text-slate-950 font-bold px-2.5 py-1 rounded text-xs tracking-wider uppercase">
            ARCHERY CATALOG
          </div>
          <h1 className="text-xl font-bold tracking-wide">專業弓箭器材型錄</h1>
          <span className="text-xs bg-slate-800 text-amber-400 px-2 py-0.5 rounded border border-amber-500/30">
            預覽模式 (Isolated Route)
          </span>
        </div>

        {/* 搜尋框 */}
        <div className="w-full md:w-64">
          <input
            type="text"
            placeholder="搜尋弓身、弓臂、Spine 撓度..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        {/* 右側控制區: 淘寶同步 / 幣別切換 / 視圖切換 */}
        <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
          {/* 淘寶店鋪全店機動同步與設定按鈕 */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center">
              <button
                onClick={() => setIsTaobaoModalOpen(true)}
                disabled={isScrapingTaobao}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-l-lg text-xs font-medium border transition-all ${
                  isScrapingTaobao
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                    : 'bg-red-950/40 text-red-300 border-red-800/60 hover:bg-red-900/60'
                }`}
              >
                <span>{isScrapingTaobao ? '🔄 同步中...' : '🕷️ 淘寶全店動態同步'}</span>
              </button>
              <button
                onClick={() => setIsTaobaoModalOpen(true)}
                title="設定淘寶店鋪網址或原始碼"
                className="px-2 py-1.5 bg-red-950/60 border-t border-b border-r border-red-800/60 rounded-r-lg text-xs text-red-300 hover:bg-red-900/80 transition-colors"
              >
                ⚙️
              </button>
            </div>

            {/* 🗑️ 一鍵清空型錄商品按鈕 */}
            <button
              onClick={() => {
                if (window.confirm('確定要清空型錄中的所有商品嗎？')) {
                  clearCatalog();
                }
              }}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-red-900/60 text-slate-400 hover:text-red-300 rounded-lg border border-slate-700 text-xs transition-colors"
              title="清空型錄"
            >
              🗑️ 清空
            </button>
          </div>

          <TaobaoConfigModal
            isOpen={isTaobaoModalOpen}
            onClose={() => setIsTaobaoModalOpen(false)}
          />

          {/* 外匯幣別選擇器 */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {['TWD', 'CNY', 'USD', 'JPY'].map((curr) => (
              <button
                key={curr}
                onClick={() => setTargetCurrency(curr)}
                className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                  targetCurrency === curr
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {curr === 'TWD' ? 'NT$' : curr === 'CNY' ? '￥' : curr === 'USD' ? '$' : '¥'}
              </button>
            ))}
          </div>

          {/* 視圖切換 (Flipbook 畫冊 / Grid 網格) */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                viewMode === 'grid'
                  ? 'bg-slate-800 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🔲 卡片網格
            </button>
            <button
              onClick={() => setViewMode('flipbook')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                viewMode === 'flipbook'
                  ? 'bg-slate-800 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📖 電子畫冊 (Flipbook)
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
