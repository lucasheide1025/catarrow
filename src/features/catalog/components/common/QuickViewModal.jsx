import React from 'react';
import { useCatalog } from '../../context/CatalogContext';

export const QuickViewModal = () => {
  const {
    quickViewProduct,
    setQuickViewProduct,
    getFormattedPrice,
    targetCurrency
  } = useCatalog();

  if (!quickViewProduct) return null;

  const formattedPrice = getFormattedPrice(quickViewProduct);

  return (
    <div
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={() => setQuickViewProduct(null)}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 text-slate-100 shadow-2xl relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 關閉按鈕 */}
        <button
          onClick={() => setQuickViewProduct(null)}
          className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 p-1.5 rounded-full text-xs"
        >
          ✕ 關閉
        </button>

        <div className="flex flex-col md:flex-row gap-6">
          {/* 大圖區 */}
          <div className="w-full md:w-1/2 aspect-square bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
            <img
              src={quickViewProduct.mainImage}
              alt={quickViewProduct.name}
              className="w-full h-full object-cover"
            />
          </div>

          {/* 右側詳細資訊區 (彈性欄位優雅隱藏) */}
          <div className="w-full md:w-1/2 flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-1">
                {quickViewProduct.brand}
              </div>
              <h2 className="text-lg font-bold text-white mb-3">
                {quickViewProduct.name}
              </h2>

              {/* 價格資訊區 */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 mb-4">
                <div className="text-2xl font-black text-amber-400">
                  {formattedPrice}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  原廠標價: {quickViewProduct.baseCurrency} {quickViewProduct.basePrice} (自動匯率換算)
                </div>
              </div>

              {/* 屬性標籤 (有資料才顯示) */}
              {Object.keys(quickViewProduct.attributes || {}).length > 0 && (
                <div className="space-y-2 mb-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase">主要規格 (Attributes)</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {quickViewProduct.attributes.interfaceSystem && (
                      <span className="text-xs bg-slate-800 text-amber-300 px-2.5 py-1 rounded border border-slate-700">
                        介面: {quickViewProduct.attributes.interfaceSystem}
                      </span>
                    )}
                    {quickViewProduct.attributes.handedness && (
                      <span className="text-xs bg-slate-800 text-slate-200 px-2.5 py-1 rounded border border-slate-700">
                        手別: {quickViewProduct.attributes.handedness.join(', ')}
                      </span>
                    )}
                    {quickViewProduct.attributes.lengthInch && (
                      <span className="text-xs bg-slate-800 text-slate-200 px-2.5 py-1 rounded border border-slate-700">
                        長度: {quickViewProduct.attributes.lengthInch}"
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* 明細對照表 (如有) */}
              {quickViewProduct.specifications?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-1">詳細數據</h4>
                  <ul className="text-xs space-y-1 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80">
                    {quickViewProduct.specifications.map((spec, i) => (
                      <li key={i} className="flex justify-between text-slate-300">
                        <span className="text-slate-500">{spec.key}:</span>
                        <span>{spec.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* 底部按鈕 */}
            <div className="mt-6 pt-4 border-t border-slate-800 flex gap-2">
              <button className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2 rounded-xl text-xs shadow transition-colors">
                加入詢價 / 收藏清單
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
