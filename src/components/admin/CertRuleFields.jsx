// src/components/admin/CertRuleFields.jsx
// 年度檢定的「規則欄位」——建立檢定賽與建立後改規則共用同一份表單。
//
// 為什麼要抽出來：舊版只有 AddCertModal 能設定這些欄位，後台改不了已建立的檢定賽；
// 補上編輯功能時如果再刻一份一模一樣的表單，兩份遲早長歪（就像價目表被手抄成好幾份）。
//
// ⚠️ 這裡**只放規則**（距離／箭數／回合／最高環數／有無脫靶／各弓種門檻分數），
// 不含年份與週期：年份/週期決定成績會寫進哪一期的 certRecords，改掉等於換一場比賽，
// 會讓已審核的成績錯位，所以編輯時不開放。
import { CERT_DEFAULT_SCORES, CERT_LEVELS } from "../../lib/constants";
import { Inp } from "../shared/UI";

export const CERT_BOW_LABELS = {
  recurve_full: "競技反曲弓（全配）",
  recurve_bare: "競技反曲弓（裸弓）",
  compound:     "美式獵弓",
  traditional:  "傳統弓",
};

export function defaultCertScores() {
  return {
    recurve_full: { ...CERT_DEFAULT_SCORES.recurve_full },
    recurve_bare: { ...CERT_DEFAULT_SCORES.recurve_bare },
    compound:     { ...CERT_DEFAULT_SCORES.compound     },
    traditional:  { ...CERT_DEFAULT_SCORES.traditional  },
  };
}

// value: { distance, arrowCount, roundCount, maxScore, hasMiss, scores }
// onChange(patch) — 只回傳有變動的欄位，由呼叫端自己 merge 進 state。
export default function CertRuleFields({ value, onChange }) {
  const scores = value.scores || defaultCertScores();

  function setScore(bowType, level, val) {
    onChange({
      scores: { ...scores, [bowType]: { ...scores[bowType], [level]: Number(val) } },
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-4 gap-3">
        <Inp label="射程距離（米）" type="number" min="1" value={value.distance}
          onChange={e => onChange({ distance: Number(e.target.value) })} />
        <Inp label="箭數/回" type="number" min="1" value={value.arrowCount}
          onChange={e => onChange({ arrowCount: Number(e.target.value) })} />
        <Inp label="回合數" type="number" min="1" value={value.roundCount}
          onChange={e => onChange({ roundCount: Number(e.target.value) })} />
        <Inp label="最高環數" type="number" min="1" value={value.maxScore}
          onChange={e => onChange({ maxScore: Number(e.target.value) })} />
      </div>

      <label className="flex items-center gap-2 text-gray-600 text-xs font-bold">
        <input type="checkbox" checked={!!value.hasMiss}
          onChange={e => onChange({ hasMiss: e.target.checked })} />
        計分表含「脫靶（M）」
      </label>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-gray-600 text-xs font-bold">各弓種達標分數設定</div>
          <button type="button" onClick={() => onChange({ scores: defaultCertScores() })}
            className="text-xs text-blue-600 font-bold hover:text-blue-800">↺ 還原預設值</button>
        </div>
        <div className="flex flex-col gap-4">
          {Object.entries(CERT_BOW_LABELS).map(([bk, blabel]) => (
            <div key={bk} className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                <div className="text-gray-700 text-sm font-bold">{blabel}</div>
              </div>
              <div className="p-3 grid grid-cols-3 gap-2">
                {(CERT_LEVELS[bk] || []).map(lv => (
                  <div key={lv} className="flex flex-col gap-1">
                    <label className="text-xs text-gray-400 font-semibold">{lv}</label>
                    <input type="number" min="0" value={scores[bk]?.[lv] ?? ""}
                      onChange={e => setScore(bk, lv, e.target.value)}
                      className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 text-sm text-center font-bold focus:outline-none focus:border-blue-400" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
