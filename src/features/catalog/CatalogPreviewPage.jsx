import React from 'react';
import { CatalogProvider, useCatalog } from './context/CatalogContext';
import { CatalogHeader } from './components/common/CatalogHeader';
import { CatalogFilterSidebar } from './components/filter/CatalogFilterSidebar';
import { ProductCard } from './components/grid/ProductCard';
import { FlipbookViewer } from './components/flipbook/FlipbookViewer';
import { QuickViewModal } from './components/common/QuickViewModal';
import { CompareDrawer } from './components/grid/CompareDrawer';

const CatalogMainContent = () => {
  const {
    products,
    viewMode,
    selectedCategory,
    searchQuery,
    filters
  } = useCatalog();

  // 前端搜尋與過濾邏輯
  const filteredProducts = products.filter((p) => {
    // 關鍵字搜尋
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchBrand = p.brand.toLowerCase().includes(q);
      if (!matchName && !matchBrand) return false;
    }

    // 分類過濾
    if (selectedCategory !== 'ALL') {
      if (!p.categoryPath.includes(selectedCategory)) return false;
    }

    // 品牌過濾
    if (filters.brand !== 'ALL' && p.brand !== filters.brand) return false;

    // 手別過濾 (RH/LH)
    if (filters.handedness !== 'ALL') {
      if (!p.attributes?.handedness?.includes(filters.handedness)) return false;
    }

    // 介面系統過濾 (ILF/Formula)
    if (filters.interfaceSystem !== 'ALL') {
      if (p.attributes?.interfaceSystem !== filters.interfaceSystem) return false;
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 頂部控制列 */}
      <CatalogHeader />

      {/* 主內容區域 (側邊欄 + 內容視圖) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* 左側樹狀分類與篩選列 */}
        <CatalogFilterSidebar />

        {/* 右側視圖 (Flipbook 畫冊 或 Grid 網格) */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-950/60">
          {viewMode === 'flipbook' ? (
            <FlipbookViewer />
          ) : (
            <div>
              {/* 資訊過濾頭部 */}
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800 text-xs text-slate-400">
                <div>
                  共找到 <strong className="text-amber-400 font-bold">{filteredProducts.length}</strong> 件弓箭器材品項
                </div>
                <div className="flex items-center space-x-2">
                  <span>排序:</span>
                  <span className="text-slate-200 font-semibold">熱門 / 新品優先</span>
                </div>
              </div>

              {/* 卡片網格列表 */}
              {filteredProducts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 text-slate-500">
                  <div className="text-4xl mb-2">🎯</div>
                  <div>沒有符合目前過濾條件的弓箭器材</div>
                  <div className="text-xs mt-1">請嘗試調整左側篩選器或重置搜尋條件</div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* 彈窗與浮動比對面板 */}
      <QuickViewModal />
      <CompareDrawer />
    </div>
  );
};

export const CatalogPreviewPage = () => {
  return (
    <CatalogProvider>
      <CatalogMainContent />
    </CatalogProvider>
  );
};

export default CatalogPreviewPage;
