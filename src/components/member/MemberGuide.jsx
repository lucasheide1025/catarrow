// src/components/member/MemberGuide.jsx
export default function MemberGuide({ onBack }) {
  return (
    <div className="p-4 flex flex-col gap-4 pb-8">
      {onBack && (
        <button onClick={onBack} className="text-gray-500 text-sm self-start">← 返回</button>
      )}

      {/* 標題 */}
      <div className="rounded-2xl p-5 text-white" style={{ background:"linear-gradient(135deg,#1e3a8a,#0e7490)" }}>
        <div className="text-xs tracking-widest text-cyan-200 font-black mb-1">CATARROW</div>
        <div className="text-2xl font-black mb-1">📘 系統使用說明</div>
        <div className="text-cyan-100 text-sm">貓小隊射箭場積分系統操作指引</div>
      </div>

      {/* 底部導覽 */}
      <Section icon="🗂️" title="底部導覽">
        <Row icon="🏠" label="首頁" desc="通知、最新消息、快捷入口" />
        <Row icon="🏆" label="比賽" desc="查看比賽、報名、記分、打怪、決鬥" />
        <Row icon="🎯" label="練習" desc="自填練習記錄" />
        <Row icon="📊" label="排行" desc="全員積分排行榜" />
        <Row icon="👤" label="我的" desc="個人資料與所有功能入口" />
      </Section>

      {/* 比賽與記分 */}
      <Section icon="🏆" title="比賽與記分">
        <Step n="1" text="進入「比賽」分頁，點選想參加的比賽" />
        <Step n="2" text="點「報名」完成報名" />
        <Step n="3" text="比賽開放後，點「開始記分」逐回合輸入成績" />
        <Note text="年度檢定需等教練審核後才算正式成績，審核中無法刷分" />
      </Section>

      {/* 打怪 */}
      <Section icon="🐉" title="打怪模式">
        <Step n="1" text="「比賽」分頁 → 選擇打怪難度" />
        <Step n="2" text="分配攻防屬性後進入戰鬥" />
        <Step n="3" text="打倒怪物可能掉落素材，進入「材料背包」查看" />
        <Note text="難度依積分等級解鎖，積分越高可挑戰越強的怪" />
      </Section>

      {/* 決鬥 */}
      <Section icon="⚔️" title="決鬥模式">
        <Step n="1" text="「比賽」分頁 → 決鬥模式" />
        <Step n="2" text="建立房間，將房間號碼告知對手" />
        <Step n="3" text="對手加入後自動開始，採回合制計算傷害" />
        <Note text="支援 1v1 或組隊對戰，決鬥成績計入成就" />
      </Section>

      {/* 組隊 */}
      <Section icon="👥" title="組隊模式">
        <Step n="1" text="「我的」→「組隊模式」" />
        <Step n="2" text="建立或加入房間（輸入房間號碼）" />
        <Step n="3" text="等候隊友加入後開始任務或戰鬥" />
        <Note text="組隊進行中時頁面頂部會出現橫幅，點一下可回到房間" />
      </Section>

      {/* 我的頁面 */}
      <Section icon="👤" title="「我的」功能一覽">
        <div className="grid grid-cols-2 gap-2 mt-1">
          {[
            ["🎖️","成就圖鑑","查看解鎖進度"],
            ["📓","學習紀錄","教練回饋"],
            ["📊","成績歷史","所有比賽記錄"],
            ["✉️","留言教練","私訊對話"],
            ["🎒","材料背包","打怪掉落素材"],
            ["🃏","怪物卡片","收藏與裝備加成"],
            ["📖","怪物圖鑑","擊殺記錄"],
            ["🏅","對外比賽","申報外部成績"],
          ].map(([ic, lb, dc]) => (
            <div key={lb} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <div className="text-xl mb-1">{ic}</div>
              <div className="text-gray-700 font-bold text-xs">{lb}</div>
              <div className="text-gray-400 text-xs mt-0.5">{dc}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* 射手證 */}
      <Section icon="🎯" title="年度檢定 ＆ 射手證">
        <p className="text-gray-600 text-sm leading-relaxed">
          完成年度檢定並通過教練審核後，可取得射手證。<br />
          藍證為初階，金證為最高階。射手證記錄你的弓組與成績。
        </p>
        <Note text="在「比賽」分頁找到年度檢定活動，選弓種進入即可" />
      </Section>

      {/* 積分 */}
      <Section icon="⭐" title="積分怎麼累積？">
        {[
          "參加比賽並取得好成績",
          "解鎖成就圖鑑",
          "教練發放徽章獎勵",
          "完成打怪任務",
        ].map(t => (
          <div key={t} className="flex items-start gap-2 text-sm text-gray-600 py-1">
            <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
            <span>{t}</span>
          </div>
        ))}
      </Section>

      {/* 常見問題 */}
      <Section icon="❓" title="常見問題">
        <QA q="記分記錯了怎麼辦？" a="聯絡教練請他幫你修改。" />
        <QA q="組隊房間號碼在哪裡？" a="建立房間後畫面上會顯示，截圖傳給隊友即可。" />
        <QA q="射手證要怎麼申請？" a="通過年度檢定後，向教練索取專屬射手證號。" />
        <QA q="成就解鎖後有什麼效果？" a="解鎖成就會增加圖鑑收集進度，部分稀有成就會公告給全員。" />
      </Section>
    </div>
  );
}

function Section({ icon, title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-2">
      <div className="text-gray-800 font-black text-sm mb-1">{icon} {title}</div>
      {children}
    </div>
  );
}
function Row({ icon, label, desc }) {
  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-lg w-7 text-center">{icon}</span>
      <div>
        <div className="text-gray-700 font-bold text-xs">{label}</div>
        <div className="text-gray-400 text-xs">{desc}</div>
      </div>
    </div>
  );
}
function Step({ n, text }) {
  return (
    <div className="flex items-start gap-2.5 py-1">
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center mt-0.5">{n}</span>
      <span className="text-gray-600 text-sm">{text}</span>
    </div>
  );
}
function Note({ text }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 mt-1">
      <span className="text-amber-700 text-xs">💡 {text}</span>
    </div>
  );
}
function QA({ q, a }) {
  return (
    <div className="py-2 border-b border-gray-50 last:border-0">
      <div className="text-gray-700 font-bold text-xs mb-1">Q：{q}</div>
      <div className="text-gray-500 text-xs leading-relaxed">A：{a}</div>
    </div>
  );
}
