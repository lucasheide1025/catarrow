import React from 'react';
import { useCatalog } from '../../context/CatalogContext';

export const CatalogFilterSidebar = () => {
  const {
    selectedCategory,
    setSelectedCategory,
    filters,
    setFilters
  } = useCatalog();

  const categories = [
    { id: 'ALL', label: '🎯 全部商品 (All Archery)' },
    { id: 'Recurve', label: '🏹 反曲弓器材 (Recurve)' },
    { id: 'Riser', label: '└ 弓身 (Risers)', parent: 'Recurve' },
    { id: 'Limbs', label: '└ 弓臂 (Limbs)', parent: 'Recurve' },
    { id: 'Sight', label: '└ 瞄準器 (Sights)', parent: 'Recurve' },
    { id: 'Traditional', label: '🎯 傳統弓/裸弓 (Traditional & Barebow)' },
    { id: 'Arrows', label: '🎯 箭枝配件 (Arrows & Parts)' },
    { id: 'Gear', label: '🎒 護具周邊 (Gear & Accessories)' }
  ];

  const brands = ['ALL', 'Hoyt', 'Win&Win', 'Easton', 'Shibuya', 'Sanlida'];
  const interfaceOptions = ['ALL', 'ILF', 'Formula'];
  const handOptions = ['ALL', 'RH', 'LH'];

  return (
    <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 p-4 space-y-6 text-slate-300 shrink-0">
      {/* 分類樹選單 */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3">
          弓箭器材分類
        </h3>
        <ul className="space-y-1 text-sm">
          {categories.map((cat) => (
            <li key={cat.id}>
              <button
                onClick={() => setSelectedCategory(cat.id)}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {cat.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <hr className="border-slate-800" />

      {/* 品牌過濾 */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
          品牌 (Brand)
        </h3>
        <select
          value={filters.brand}
          onChange={(e) => setFilters({ ...filters, brand: e.target.value })}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
        >
          {brands.map((b) => (
            <option key={b} value={b}>
              {b === 'ALL' ? '全部品牌' : b}
            </option>
          ))}
        </select>
      </div>

      {/* 手別選擇 */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
          手別 (Handedness)
        </h3>
        <div className="grid grid-cols-3 gap-1">
          {handOptions.map((hand) => (
            <button
              key={hand}
              onClick={() => setFilters({ ...filters, handedness: hand })}
              className={`py-1 text-xs rounded border transition-colors ${
                filters.handedness === hand
                  ? 'bg-slate-800 text-amber-400 border-amber-500/40 font-bold'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              {hand === 'ALL' ? '全部' : hand}
            </button>
          ))}
        </div>
      </div>

      {/* 系統介面選擇 */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
          弓身/弓臂介面
        </h3>
        <div className="grid grid-cols-3 gap-1">
          {interfaceOptions.map((sys) => (
            <button
              key={sys}
              onClick={() => setFilters({ ...filters, interfaceSystem: sys })}
              className={`py-1 text-xs rounded border transition-colors ${
                filters.interfaceSystem === sys
                  ? 'bg-slate-800 text-amber-400 border-amber-500/40 font-bold'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              {sys}
            </button>
          ))}
        </div>
      </div>

      {/* 重置過濾器 */}
      <button
        onClick={() => {
          setSelectedCategory('ALL');
          setFilters({ brand: 'ALL', handedness: 'ALL', interfaceSystem: 'ALL', spine: 'ALL' });
        }}
        className="w-full text-center text-xs text-slate-500 hover:text-amber-400 transition-colors py-1"
      >
        🔄 重置所有過濾條件
      </button>
    </aside>
  );
};
