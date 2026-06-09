// src/components/shared/Equipment.jsx
import { useState } from "react";

// ─── 弓種定義 ──────────────────────────────────────────────
export const BOW_CATEGORIES = [
  { value: "recurve_full", label: "競技反曲弓（全配）", icon: "🎯" },
  { value: "recurve_bare", label: "競技反曲弓（裸弓）", icon: "🏹" },
  { value: "compound",     label: "美式獵弓",           icon: "🦅" },
  { value: "traditional",  label: "傳統弓",             icon: "🌿" },
];

// ─── 射手防具套組定義（最多3套）──────────────────────────────
export const MAX_ARMOR_SETS = 3;
export function newArmorSet() {
  return {
    id: `armor_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
    type: "armor",
    label: "",
    chestGuard:  { name: "", model: "", color: "" },
    armGuard:    { name: "", model: "", color: "" },
    fingerGuard: { name: "", model: "", color: "" },
    quiver:      { name: "", model: "", color: "" },
  };
}

// ─── 加成飾品套組定義（最多3套）──────────────────────────────
export const MAX_ACCESSORY_SETS = 3;
export function newAccessorySet() {
  return {
    id: `acc_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
    type: "accessory",
    label: "",
    tSquare:    { name: "", model: "" },
    arrowDoctor:{ name: "", model: "" },
    toolKit:    { name: "", model: "" },
    bowBag:     { name: "", model: "", color: "" },
    bowStand:   { name: "", model: "", color: "" },
  };
}

const ARMOR_ITEMS = [
  { key: "chestGuard",  label: "護胸",   hasColor: true  },
  { key: "armGuard",    label: "護臂",   hasColor: true  },
  { key: "fingerGuard", label: "護指",   hasColor: true  },
  { key: "quiver",      label: "箭袋",   hasColor: true  },
];
const ACCESSORY_ITEMS = [
  { key: "tSquare",     label: "T尺",     hasColor: true  },
  { key: "arrowDoctor", label: "箭尾醫生",hasColor: false },
  { key: "toolKit",     label: "工具包",  hasColor: false },
  { key: "bowBag",      label: "弓包",    hasColor: true  },
  { key: "bowStand",    label: "弓架",    hasColor: true  },
];

// 箭矢欄位（四種弓共用）
const ARROW_FIELDS = [
  { key: "arrBrand",   label: "箭矢品牌" },
  { key: "arrModel",   label: "箭矢型號" },
  { key: "arrSpine",   label: "箭矢橈度（Spine）" },
  { key: "arrHeadW",   label: "箭頭重量" },
  { key: "arrHeadT",   label: "箭頭型態" },
  { key: "arrDiam",    label: "箭桿口徑" },
  { key: "arrLen",     label: "箭桿長度" },
  { key: "nockColor",  label: "箭尾顏色" },
  { key: "fletchMain", label: "主羽片顏色" },
  { key: "fletchSub",  label: "副羽片顏色" },
  { key: "arrWeight",  label: "箭總重量" },
];

// ─── 各弓種欄位定義 ─────────────────────────────────────────
const BOW_FIELDS = {
  recurve_full: {
    sections: [
      { title: "弓組", fields: [
        { key: "bowBrand",  label: "弓身品牌" }, { key: "bowModel",  label: "弓身型號" },
        { key: "bowSize",   label: "弓身尺寸" }, { key: "limbBrand", label: "弓臂品牌" },
        { key: "limbModel", label: "弓臂型號" }, { key: "limbSize",  label: "弓臂尺寸（長/中/短）" },
        { key: "limbPound", label: "弓臂磅數" }, { key: "strLen",    label: "弓弦長度" },
        { key: "strStrand", label: "弓弦股數" }, { key: "strModel",  label: "弓弦型號" },
      ]},
      { title: "箭矢", fields: ARROW_FIELDS },
      { title: "安定桿組", fields: [
        { key: "stabModel", label: "安定桿組型號" }, { key: "mainRod", label: "主安定桿長度" },
        { key: "sideRod",   label: "側桿長度" },    { key: "extRod",  label: "延伸桿長度" },
        { key: "vbar",      label: "V-Bar 型號" },
      ]},
      { title: "瞄準器", fields: [{ key: "sightModel", label: "瞄準器型號" }] },
      { title: "箭座", fields: [
        { key: "arrowRestType",  label: "箭座類型" },
        { key: "arrowRestModel", label: "箭座型號" },
      ]},
      { title: "弦距", fields: [
        { key: "braceHeightTop",    label: "上弦距" },
        { key: "braceHeightMid",    label: "中弦距" },
        { key: "braceHeightBottom", label: "下弦距" },
      ]},
      { title: "避震", fields: [
        { key: "vibrationDamper", label: "箭震吸收器型號" },
      ]},
      { title: "配件 1", fields: [{ key: "acc1Weight", label: "配重塊總重量" }, { key: "acc1Damper", label: "減震球型號" }, { key: "acc1Other", label: "其他" }] },
      { title: "配件 2", fields: [{ key: "acc2Weight", label: "配重塊總重量" }, { key: "acc2Damper", label: "減震球型號" }, { key: "acc2Other", label: "其他" }] },
      { title: "配件 3", fields: [{ key: "acc3Weight", label: "配重塊總重量" }, { key: "acc3Damper", label: "減震球型號" }, { key: "acc3Other", label: "其他" }] },
      { title: "配件 4", fields: [{ key: "acc4Weight", label: "配重塊總重量" }, { key: "acc4Damper", label: "減震球型號" }, { key: "acc4Other", label: "其他" }] },
    ],
  },
  recurve_bare: {
    sections: [
      { title: "弓組", fields: [
        { key: "bowBrand",  label: "弓身品牌" }, { key: "bowModel",  label: "弓身型號" },
        { key: "bowSize",   label: "弓身尺寸" }, { key: "limbBrand", label: "弓臂品牌" },
        { key: "limbModel", label: "弓臂型號" }, { key: "limbSize",  label: "弓臂尺寸（長/中/短）" },
        { key: "limbPound", label: "弓臂磅數" }, { key: "strLen",    label: "弓弦長度" },
        { key: "strStrand", label: "弓弦股數" }, { key: "strModel",  label: "弓弦型號" },
      ]},
      { title: "箭矢", fields: ARROW_FIELDS },
      { title: "箭座", fields: [
        { key: "arrowRestType",  label: "箭座類型" },
        { key: "arrowRestModel", label: "箭座型號" },
      ]},
      { title: "弦距", fields: [
        { key: "braceHeightTop",    label: "上弦距" },
        { key: "braceHeightMid",    label: "中弦距" },
        { key: "braceHeightBottom", label: "下弦距" },
      ]},
      { title: "避震", fields: [
        { key: "vibrationDamper", label: "箭震吸收器型號" },
      ]},
      { title: "配件 1", fields: [{ key: "acc1Weight", label: "配重塊總重量" }, { key: "acc1Damper", label: "減震球型號" }, { key: "acc1Other", label: "其他" }] },
      { title: "配件 2", fields: [{ key: "acc2Weight", label: "配重塊總重量" }, { key: "acc2Damper", label: "減震球型號" }, { key: "acc2Other", label: "其他" }] },
      { title: "配件 3", fields: [{ key: "acc3Weight", label: "配重塊總重量" }, { key: "acc3Damper", label: "減震球型號" }, { key: "acc3Other", label: "其他" }] },
      { title: "配件 4", fields: [{ key: "acc4Weight", label: "配重塊總重量" }, { key: "acc4Damper", label: "減震球型號" }, { key: "acc4Other", label: "其他" }] },
    ],
  },
  compound: {
    sections: [
      { title: "弓組", fields: [
        { key: "bowBrand",  label: "弓身品牌" }, { key: "bowModel",  label: "弓身型號" },
        { key: "bowSize",   label: "弓身尺寸" }, { key: "limbBrand", label: "弓臂品牌" },
        { key: "limbModel", label: "弓臂型號" }, { key: "limbSize",  label: "弓臂尺寸（長/中/短）" },
        { key: "limbPound", label: "弓臂磅數" }, { key: "strLen",    label: "弓弦長度" },
        { key: "strStrand", label: "弓弦股數" }, { key: "strModel",  label: "弓弦型號" },
      ]},
      { title: "箭矢", fields: ARROW_FIELDS },
      { title: "箭座", fields: [
        { key: "arrowRestType",  label: "箭座類型" },
        { key: "arrowRestModel", label: "箭座型號" },
      ]},
      { title: "弦距", fields: [
        { key: "braceHeightTop",    label: "上弦距" },
        { key: "braceHeightMid",    label: "中弦距" },
        { key: "braceHeightBottom", label: "下弦距" },
      ]},
      { title: "避震", fields: [
        { key: "vibrationDamper", label: "箭震吸收器型號" },
      ]},
      { title: "配件 1", fields: [{ key: "acc1Weight", label: "配重塊總重量" }, { key: "acc1Damper", label: "減震球型號" }, { key: "acc1Other", label: "其他" }] },
      { title: "配件 2", fields: [{ key: "acc2Weight", label: "配重塊總重量" }, { key: "acc2Damper", label: "減震球型號" }, { key: "acc2Other", label: "其他" }] },
      { title: "配件 3", fields: [{ key: "acc3Weight", label: "配重塊總重量" }, { key: "acc3Damper", label: "減震球型號" }, { key: "acc3Other", label: "其他" }] },
      { title: "配件 4", fields: [{ key: "acc4Weight", label: "配重塊總重量" }, { key: "acc4Damper", label: "減震球型號" }, { key: "acc4Other", label: "其他" }] },
    ],
  },
  traditional: {
    sections: [
      { title: "弓組", fields: [
        { key: "bowBrand", label: "弓品牌" }, { key: "bowPound", label: "磅數" },
        { key: "bowSize",  label: "尺寸" },   { key: "bowType",  label: "弓名類別" },
        { key: "strLen",   label: "弦長" },
      ]},
      { title: "箭矢", fields: ARROW_FIELDS },
      { title: "配件", fields: [{ key: "acc1Other", label: "其他" }] },
    ],
  },
};

export const MAX_EQUIP_SETS = 10;

export function newEquipSet(bowCategory = "recurve_bare") {
  return {
    id: `eq_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
    bowCategory,
    label: "",
    isDefault: false,
    fields: {},
  };
}

export function normalizeEquipment(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object" && !raw.bowCategory) {
    const sets = [];
    if (raw.bowBrand || raw.bowModel) {
      sets.push({
        id: "legacy_bow", bowCategory: "recurve_bare",
        label: "主要弓組", isDefault: true,
        fields: {
          bowBrand: raw.bowBrand || "", bowModel: raw.bowModel || "",
          limbBrand: raw.limbBrand || "", limbSize: raw.limbSize || "",
          arrBrand: raw.arrowBrand || "", arrModel: raw.arrowModel || "",
          arrLen: raw.arrowLength || "", fletchMain: raw.fletchColor || "",
        },
      });
    }
    return sets;
  }
  return [];
}

// 從 profile 抓防具套組
export function normalizeArmor(raw) {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.filter(s => s.type === "armor");
}

// 從 profile 抓飾品套組
export function normalizeAccessory(raw) {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.filter(s => s.type === "accessory");
}

// ─── 弓組管理元件 ───────────────────────────────────────────
export function EquipmentManager({ value, onChange, readOnly = false }) {
  const sets = Array.isArray(value) ? value : normalizeEquipment(value);
  const [adding, setAdding]     = useState(false);
  const [editId, setEditId]     = useState(null);
  const [expandId, setExpandId] = useState(null);

  function addSet(bowCategory) {
    if (sets.length >= MAX_EQUIP_SETS) return;
    const s = newEquipSet(bowCategory);
    if (sets.length === 0) s.isDefault = true;
    onChange([...sets, s]);
    setEditId(s.id);
    setAdding(false);
  }
  function updateSet(id, updates) { onChange(sets.map(s => s.id !== id ? s : { ...s, ...updates })); }
  function updateField(id, key, val) { onChange(sets.map(s => s.id !== id ? s : { ...s, fields: { ...s.fields, [key]: val } })); }
  function setDefault(id) { onChange(sets.map(s => ({ ...s, isDefault: s.id === id }))); }
  function removeSet(id) {
    const next = sets.filter(s => s.id !== id);
    if (next.length > 0 && !next.some(s => s.isDefault)) next[0].isDefault = true;
    onChange(next);
    if (editId === id) setEditId(null);
  }
  const catMap = Object.fromEntries(BOW_CATEGORIES.map(b => [b.value, b]));

  return (
    <div className="flex flex-col gap-3">
      {sets.length === 0 && !adding && (
        <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm">尚未新增任何裝備組</div>
      )}
      {sets.map(set => {
        const cat = catMap[set.bowCategory] || BOW_CATEGORIES[0];
        const isExpanded = expandId === set.id;
        const isEditing  = editId === set.id;
        const sections   = BOW_FIELDS[set.bowCategory]?.sections || [];
        return (
          <div key={set.id} className={`border rounded-2xl overflow-hidden transition-all ${set.isDefault ? "border-blue-300 bg-blue-50/30" : "border-gray-200 bg-white"}`}>
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="text-xl">{cat.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-gray-800 font-bold text-sm">{set.label || cat.label}</span>
                  {set.isDefault && <span className="text-xs bg-blue-600 text-white font-bold px-2 py-0.5 rounded-full">⭐ 預設</span>}
                </div>
                <div className="text-gray-400 text-xs">{cat.label}</div>
              </div>
              {!readOnly && (
                <div className="flex gap-1.5 flex-shrink-0">
                  {!set.isDefault && (
                    <button onClick={() => setDefault(set.id)} className="text-xs text-blue-500 border border-blue-200 bg-white px-2 py-1 rounded-lg hover:bg-blue-50">設預設</button>
                  )}
                  <button onClick={() => setEditId(isEditing ? null : set.id)}
                    className={`text-xs px-2 py-1 rounded-lg border ${isEditing ? "bg-orange-500 text-white border-orange-500" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                    {isEditing ? "完成" : "編輯"}
                  </button>
                  <button onClick={() => removeSet(set.id)} className="text-xs text-red-400 border border-red-200 bg-white px-2 py-1 rounded-lg hover:bg-red-50">刪除</button>
                </div>
              )}
              <button onClick={() => setExpandId(isExpanded ? null : set.id)} className="text-gray-400 text-sm px-1 flex-shrink-0">{isExpanded ? "▲" : "▼"}</button>
            </div>
            {isEditing && (
              <div className="px-4 pb-2">
                <input value={set.label} onChange={e => updateSet(set.id, { label: e.target.value })}
                  placeholder="自訂名稱（例如：比賽用弓、練習組）"
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-700 text-sm focus:outline-none focus:border-blue-400 placeholder-gray-300" />
              </div>
            )}
            {(isExpanded || isEditing) && (
              <div className="border-t border-gray-100 px-4 pb-4 pt-3 flex flex-col gap-4">
                {sections.map(sec => (
                  <div key={sec.title}>
                    <div className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />{sec.title}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {sec.fields.map(f => (
                        isEditing ? (
                          <div key={f.key} className="flex flex-col gap-0.5">
                            <label className="text-xs text-gray-400">{f.label}</label>
                            <input value={set.fields?.[f.key] || ""} onChange={e => updateField(set.id, f.key, e.target.value)}
                              placeholder={`輸入${f.label}…`}
                              className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-700 text-sm focus:outline-none focus:border-blue-400 placeholder-gray-300" />
                          </div>
                        ) : set.fields?.[f.key] ? (
                          <div key={f.key} className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                            <div className="text-gray-400 text-xs">{f.label}</div>
                            <div className="text-gray-700 text-sm font-medium">{set.fields[f.key]}</div>
                          </div>
                        ) : null
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {!readOnly && sets.length < MAX_EQUIP_SETS && (
        adding ? (
          <div className="border-2 border-dashed border-blue-200 rounded-2xl p-4">
            <div className="text-gray-600 text-xs font-bold mb-3">選擇弓種</div>
            <div className="grid grid-cols-2 gap-2">
              {BOW_CATEGORIES.map(cat => (
                <button key={cat.value} onClick={() => addSet(cat.value)}
                  className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl p-3 hover:border-blue-400 hover:bg-blue-50 transition-all text-left">
                  <span className="text-2xl">{cat.icon}</span>
                  <span className="text-gray-700 text-sm font-medium leading-tight">{cat.label}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setAdding(false)} className="text-gray-400 text-xs mt-3 w-full text-center">取消</button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)}
            className="w-full py-3 border-2 border-dashed border-blue-200 rounded-2xl text-blue-500 text-sm font-bold hover:border-blue-400 hover:bg-blue-50 transition-all">
            + 新增裝備組（{sets.length} / {MAX_EQUIP_SETS}）
          </button>
        )
      )}
    </div>
  );
}

// ─── 射手防具管理元件 ────────────────────────────────────────
export function ArmorManager({ value = [], onChange, readOnly = false }) {
  const sets = Array.isArray(value) ? value.filter(s => s.type === "armor") : [];
  const [editId, setEditId] = useState(null);
  const [expandId, setExpandId] = useState(null);

  function addSet() {
    if (sets.length >= MAX_ARMOR_SETS) return;
    const s = newArmorSet();
    onChange([...sets, s]);
    setEditId(s.id);
  }
  function updateLabel(id, label) { onChange(sets.map(s => s.id !== id ? s : { ...s, label })); }
  function updateItem(id, itemKey, field, val) {
    onChange(sets.map(s => s.id !== id ? s : { ...s, [itemKey]: { ...s[itemKey], [field]: val } }));
  }
  function removeSet(id) {
    onChange(sets.filter(s => s.id !== id));
    if (editId === id) setEditId(null);
  }

  return (
    <div className="flex flex-col gap-3">
      {sets.length === 0 && (
        <div className="text-center py-4 border-2 border-dashed border-orange-200 rounded-xl text-gray-400 text-sm">尚未新增防具套組</div>
      )}
      {sets.map((set, idx) => {
        const isEditing  = editId === set.id;
        const isExpanded = expandId === set.id;
        return (
          <div key={set.id} className="border border-orange-200 rounded-2xl overflow-hidden bg-orange-50/20">
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="text-xl">🛡️</span>
              <div className="flex-1 min-w-0">
                <span className="text-gray-800 font-bold text-sm">{set.label || `防具套組 ${idx + 1}`}</span>
              </div>
              {!readOnly && (
                <div className="flex gap-1.5 flex-shrink-0">
                  <button onClick={() => setEditId(isEditing ? null : set.id)}
                    className={`text-xs px-2 py-1 rounded-lg border ${isEditing ? "bg-orange-500 text-white border-orange-500" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                    {isEditing ? "完成" : "編輯"}
                  </button>
                  <button onClick={() => removeSet(set.id)} className="text-xs text-red-400 border border-red-200 bg-white px-2 py-1 rounded-lg hover:bg-red-50">刪除</button>
                </div>
              )}
              <button onClick={() => setExpandId(isExpanded ? null : set.id)} className="text-gray-400 text-sm px-1">{isExpanded ? "▲" : "▼"}</button>
            </div>
            {isEditing && (
              <div className="px-4 pb-2">
                <input value={set.label} onChange={e => updateLabel(set.id, e.target.value)}
                  placeholder="套組名稱（例如：比賽用防具）"
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-700 text-sm focus:outline-none focus:border-orange-400 placeholder-gray-300" />
              </div>
            )}
            {(isExpanded || isEditing) && (
              <div className="border-t border-orange-100 px-4 pb-4 pt-3 flex flex-col gap-3">
                {ARMOR_ITEMS.map(item => (
                  <div key={item.key}>
                    <div className="text-xs font-bold text-gray-500 mb-1.5">{item.label}</div>
                    <div className="grid grid-cols-3 gap-2">
                      {["name", "model", ...(item.hasColor ? ["color"] : [])].map(field => {
                        const fieldLabel = field === "name" ? "名稱" : field === "model" ? "型號" : "顏色";
                        const val = set[item.key]?.[field] || "";
                        return isEditing ? (
                          <div key={field} className="flex flex-col gap-0.5">
                            <label className="text-xs text-gray-400">{fieldLabel}</label>
                            <input value={val} onChange={e => updateItem(set.id, item.key, field, e.target.value)}
                              placeholder={fieldLabel}
                              className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 text-sm focus:outline-none focus:border-orange-400 placeholder-gray-300" />
                          </div>
                        ) : val ? (
                          <div key={field} className="bg-white rounded-lg px-2 py-1.5 border border-gray-100">
                            <div className="text-gray-400 text-xs">{fieldLabel}</div>
                            <div className="text-gray-700 text-sm font-medium">{val}</div>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {!readOnly && sets.length < MAX_ARMOR_SETS && (
        <button onClick={addSet}
          className="w-full py-3 border-2 border-dashed border-orange-200 rounded-2xl text-orange-500 text-sm font-bold hover:border-orange-400 hover:bg-orange-50 transition-all">
          + 新增防具套組（{sets.length} / {MAX_ARMOR_SETS}）
        </button>
      )}
    </div>
  );
}

// ─── 加成飾品管理元件 ────────────────────────────────────────
export function AccessoryManager({ value = [], onChange, readOnly = false }) {
  const sets = Array.isArray(value) ? value.filter(s => s.type === "accessory") : [];
  const [editId, setEditId] = useState(null);
  const [expandId, setExpandId] = useState(null);

  function addSet() {
    if (sets.length >= MAX_ACCESSORY_SETS) return;
    const s = newAccessorySet();
    onChange([...sets, s]);
    setEditId(s.id);
  }
  function updateLabel(id, label) { onChange(sets.map(s => s.id !== id ? s : { ...s, label })); }
  function updateItem(id, itemKey, field, val) {
    onChange(sets.map(s => s.id !== id ? s : { ...s, [itemKey]: { ...s[itemKey], [field]: val } }));
  }
  function removeSet(id) {
    onChange(sets.filter(s => s.id !== id));
    if (editId === id) setEditId(null);
  }

  return (
    <div className="flex flex-col gap-3">
      {sets.length === 0 && (
        <div className="text-center py-4 border-2 border-dashed border-purple-200 rounded-xl text-gray-400 text-sm">尚未新增飾品套組</div>
      )}
      {sets.map((set, idx) => {
        const isEditing  = editId === set.id;
        const isExpanded = expandId === set.id;
        return (
          <div key={set.id} className="border border-purple-200 rounded-2xl overflow-hidden bg-purple-50/20">
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="text-xl">✨</span>
              <div className="flex-1 min-w-0">
                <span className="text-gray-800 font-bold text-sm">{set.label || `飾品套組 ${idx + 1}`}</span>
              </div>
              {!readOnly && (
                <div className="flex gap-1.5 flex-shrink-0">
                  <button onClick={() => setEditId(isEditing ? null : set.id)}
                    className={`text-xs px-2 py-1 rounded-lg border ${isEditing ? "bg-purple-500 text-white border-purple-500" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                    {isEditing ? "完成" : "編輯"}
                  </button>
                  <button onClick={() => removeSet(set.id)} className="text-xs text-red-400 border border-red-200 bg-white px-2 py-1 rounded-lg hover:bg-red-50">刪除</button>
                </div>
              )}
              <button onClick={() => setExpandId(isExpanded ? null : set.id)} className="text-gray-400 text-sm px-1">{isExpanded ? "▲" : "▼"}</button>
            </div>
            {isEditing && (
              <div className="px-4 pb-2">
                <input value={set.label} onChange={e => updateLabel(set.id, e.target.value)}
                  placeholder="套組名稱（例如：比賽用配件）"
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-700 text-sm focus:outline-none focus:border-purple-400 placeholder-gray-300" />
              </div>
            )}
            {(isExpanded || isEditing) && (
              <div className="border-t border-purple-100 px-4 pb-4 pt-3 flex flex-col gap-3">
                {ACCESSORY_ITEMS.map(item => (
                  <div key={item.key}>
                    <div className="text-xs font-bold text-gray-500 mb-1.5">{item.label}</div>
                    <div className="grid grid-cols-3 gap-2">
                      {["name", "model", ...(item.hasColor ? ["color"] : [])].map(field => {
                        const fieldLabel = field === "name" ? "名稱" : field === "model" ? "型號" : "顏色";
                        const val = set[item.key]?.[field] || "";
                        return isEditing ? (
                          <div key={field} className="flex flex-col gap-0.5">
                            <label className="text-xs text-gray-400">{fieldLabel}</label>
                            <input value={val} onChange={e => updateItem(set.id, item.key, field, e.target.value)}
                              placeholder={fieldLabel}
                              className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 text-sm focus:outline-none focus:border-purple-400 placeholder-gray-300" />
                          </div>
                        ) : val ? (
                          <div key={field} className="bg-white rounded-lg px-2 py-1.5 border border-gray-100">
                            <div className="text-gray-400 text-xs">{fieldLabel}</div>
                            <div className="text-gray-700 text-sm font-medium">{val}</div>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {!readOnly && sets.length < MAX_ACCESSORY_SETS && (
        <button onClick={addSet}
          className="w-full py-3 border-2 border-dashed border-purple-200 rounded-2xl text-purple-500 text-sm font-bold hover:border-purple-400 hover:bg-purple-50 transition-all">
          + 新增飾品套組（{sets.length} / {MAX_ACCESSORY_SETS}）
        </button>
      )}
    </div>
  );
}

// ─── 向下相容舊名稱 ─────────────────────────────────────────
export function EquipmentEditor({ value, onChange }) {
  return <EquipmentManager value={value} onChange={onChange} readOnly={false} />;
}
export function EquipmentViewer({ equipment }) {
  return <EquipmentManager value={equipment} onChange={() => {}} readOnly={true} />;
}
export function getDefaultBowType(equipment) {
  const sets = normalizeEquipment(equipment);
  const def = sets.find(s => s.isDefault) || sets[0];
  return def?.bowCategory || "recurve_bare";
}