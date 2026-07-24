import React from 'react';
import { useCatalog } from '../../context/CatalogContext';

export const CompareDrawer = () => {
  const { compareList, setCompareList, toggleCompare, getFormattedPrice } = useCatalog();

  if (compareList.length === 0) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur-md border-t border-amber-500/40 p-4 z-40 text-slate-100 shadow-2xl">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-xs font-bold bg-amber-500 text-slate-950 px-2 py-0.5 rounded">
            SPEC COMPARISON
          </span>
          <span className="text-xs text-slate-300">
            已選擇 <strong className="text-amber-400">{compareList.length}</strong> 項商品進行規格對照
          </span>
        </div>

        {/* 商品縮圖列表 */}
        <div className="flex items-center space-x-3 overflow-x-auto py-1">
          {compareList.map((product) => (
            <div
              key={product.id}
              className="flex items-center space-x-2 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 shrink-0"
            >
              <img
                src={product.mainImage}
                alt={product.name}
                className="w-8 h-8 object-cover rounded"
              />
              <div className="text-[11px] max-w-[120px] truncate">
                <div className="font-semibold text-slate-200 truncate">{product.name}</div>
                <div className="text-amber-400 font-bold">{getFormattedPrice(product)}</div>
              </div>
              <button
                onClick={() => toggleCompare(product)}
                className="text-slate-500 hover:text-red-400 text-xs ml-1"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* 動作按鈕 */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCompareList([])}
            className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1"
          >
            清空
          </button>
        </div>
      </div>
    </div>
  );
};
