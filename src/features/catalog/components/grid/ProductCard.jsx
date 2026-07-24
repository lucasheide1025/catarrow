import React from 'react';
import { useCatalog } from '../../context/CatalogContext';

export const ProductCard = ({ product }) => {
  const {
    getFormattedPrice,
    setQuickViewProduct,
    toggleCompare,
    compareList,
    targetCurrency
  } = useCatalog();

  const isCompared = compareList.some((item) => item.id === product.id);
  const formattedPrice = getFormattedPrice(product);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-amber-500/50 transition-all duration-300 flex flex-col justify-between group shadow-lg">
      <div>
        {/* 圖片區塊 */}
        <div className="relative aspect-square bg-slate-950 overflow-hidden cursor-pointer" onClick={() => setQuickViewProduct(product)}>
          <img
            src={product.mainImage}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
          {/* 頂部標籤區 */}
          <div className="absolute top-2 left-2 flex flex-wrap gap-1">
            {product.tags?.map((tag) => (
              <span
                key={tag}
                className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500 text-slate-950 shadow"
              >
                {tag}
              </span>
            ))}
            {product.source && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-800/80 backdrop-blur text-slate-300 border border-slate-700">
                {product.source}
              </span>
            )}
          </div>

          {/* 快速預覽視圖 Hover 按鈕 */}
          <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setQuickViewProduct(product);
              }}
              className="bg-amber-500 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs shadow hover:bg-amber-400 transition-colors"
            >
              🔍 快速預覽
            </button>
          </div>
        </div>

        {/* 商品內容區 */}
        <div className="p-4">
          <div className="text-xs font-semibold text-amber-500 mb-1">{product.brand}</div>
          <h3 className="text-sm font-medium text-slate-100 line-clamp-2 mb-2 group-hover:text-amber-400 transition-colors">
            {product.name}
          </h3>

          {/* 動態屬性標籤區 (優雅降級: 有才顯示) */}
          <div className="flex flex-wrap gap-1.5 my-2">
            {product.attributes?.interfaceSystem && (
              <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                {product.attributes.interfaceSystem} 介面
              </span>
            )}
            {product.attributes?.handedness && (
              <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                {product.attributes.handedness.join('/')}
              </span>
            )}
            {product.attributes?.spine && (
              <span className="text-[11px] bg-slate-800 font-mono text-amber-300 px-2 py-0.5 rounded border border-amber-500/20">
                Spine: {product.attributes.spine.slice(0, 3).join(', ')}...
              </span>
            )}
            {product.attributes?.drawWeightlbs && (
              <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                {Math.min(...product.attributes.drawWeightlbs)}~{Math.max(...product.attributes.drawWeightlbs)} lbs
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 底部價格與動作 */}
      <div className="p-4 pt-0 border-t border-slate-800/60 mt-2 flex items-center justify-between">
        <div>
          <div className="text-lg font-bold text-amber-400 tracking-tight">
            {formattedPrice}
          </div>
          {/* 外匯原價小字提醒 */}
          <div className="text-[10px] text-slate-500 font-mono">
            原計價: {product.baseCurrency} {product.basePrice}
          </div>
        </div>

        {/* 規格比對勾選按鈕 */}
        <button
          onClick={() => toggleCompare(product)}
          className={`text-xs px-2.5 py-1 rounded transition-colors border ${
            isCompared
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
          }`}
        >
          {isCompared ? '✓ 已加入比對' : '+ 加入比對'}
        </button>
      </div>
    </div>
  );
};
