import React, { useState } from 'react';
import { useCatalog } from '../../context/CatalogContext';

export const FlipbookViewer = () => {
  const { flipbookPages, products, getFormattedPrice, setQuickViewProduct } = useCatalog();
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [activeHotspotProduct, setActiveHotspotProduct] = useState(null);

  const currentPage = flipbookPages[currentPageIndex];

  const handleHotspotClick = (productId) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      setActiveHotspotProduct(product);
    }
  };

  return (
    <div className="flex-1 bg-slate-950 p-6 flex flex-col items-center justify-between min-h-[650px] relative">
      {/* 上方導航列 */}
      <div className="w-full flex items-center justify-between text-slate-400 text-xs mb-4">
        <span className="font-semibold text-amber-400">
          📖 弓箭電子畫冊 Lookbook (第 {currentPageIndex + 1} / {flipbookPages.length} 頁)
        </span>
        <div className="space-x-2">
          <button
            disabled={currentPageIndex === 0}
            onClick={() => setCurrentPageIndex((prev) => Math.max(0, prev - 1))}
            className="px-3 py-1 bg-slate-900 border border-slate-800 rounded disabled:opacity-30 hover:text-white"
          >
            ◀ 上一頁
          </button>
          <button
            disabled={currentPageIndex === flipbookPages.length - 1}
            onClick={() => setCurrentPageIndex((prev) => Math.min(flipbookPages.length - 1, prev + 1))}
            className="px-3 py-1 bg-slate-900 border border-slate-800 rounded disabled:opacity-30 hover:text-white"
          >
            下一頁 ▶
          </button>
        </div>
      </div>

      {/* 畫冊主體 (呈現雜誌大圖與 Hotspots) */}
      <div className="relative max-w-4xl w-full aspect-[16/10] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 flex items-center justify-center group">
        <img
          src={currentPage.imageUrl}
          alt={currentPage.title}
          className="w-full h-full object-cover"
        />

        {/* 頁面標題浮水印 */}
        <div className="absolute top-4 left-4 bg-slate-950/70 backdrop-blur border border-slate-800 text-white px-4 py-2 rounded-xl">
          <div className="text-xs text-amber-400 font-bold uppercase tracking-wider">FEATURED CATALOG</div>
          <div className="text-sm font-semibold">{currentPage.title}</div>
        </div>

        {/* Hotspots 熱點標籤 📌 */}
        {currentPage.hotspots?.map((hs) => (
          <div
            key={hs.id}
            style={{ left: `${hs.x}%`, top: `${hs.y}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
          >
            <button
              onClick={() => handleHotspotClick(hs.productId)}
              className="relative group/hs flex items-center justify-center"
            >
              {/* 脈衝動態效果 */}
              <span className="absolute w-8 h-8 rounded-full bg-amber-500/40 animate-ping" />
              <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center shadow-lg border border-white hover:scale-125 transition-transform">
                📌
              </span>

              {/* Hover 時浮現的小標籤 */}
              <span className="absolute left-8 bg-slate-950/90 text-slate-200 text-xs px-2.5 py-1 rounded border border-slate-700 whitespace-nowrap opacity-0 group-hover/hs:opacity-100 transition-opacity pointer-events-none">
                {hs.label}
              </span>
            </button>
          </div>
        ))}

        {/* 點擊 Hotspot 後出現的彈性 Mini 卡片 */}
        {activeHotspotProduct && (
          <div className="absolute bottom-6 right-6 bg-slate-900/95 backdrop-blur border border-amber-500/40 text-slate-100 p-4 rounded-xl shadow-2xl max-w-sm w-full z-20 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded uppercase">
                {activeHotspotProduct.brand}
              </span>
              <button
                onClick={() => setActiveHotspotProduct(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕ 關閉
              </button>
            </div>
            <div className="flex gap-3">
              <img
                src={activeHotspotProduct.mainImage}
                alt={activeHotspotProduct.name}
                className="w-16 h-16 object-cover rounded-lg bg-slate-950 border border-slate-800"
              />
              <div className="flex-1">
                <div className="text-xs font-semibold text-slate-100 line-clamp-1">
                  {activeHotspotProduct.name}
                </div>
                <div className="text-amber-400 font-bold text-sm mt-1">
                  {getFormattedPrice(activeHotspotProduct)}
                </div>
                <button
                  onClick={() => {
                    setQuickViewProduct(activeHotspotProduct);
                    setActiveHotspotProduct(null);
                  }}
                  className="mt-2 text-[11px] bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-slate-950 font-semibold px-2 py-1 rounded transition-colors w-full text-center"
                >
                  檢視完整規格與換算
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="text-xs text-slate-500 mt-4">
        💡 提示：點擊圖片上的 📌 浮動圖標即可開啟商品細節與即時匯率換算
      </div>
    </div>
  );
};
