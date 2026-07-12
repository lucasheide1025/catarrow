const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '..', 'src', 'components', 'dungeon', 'DungeonBattleRoom.jsx');
let s = fs.readFileSync(filePath, 'utf8');

// Find the RoundResultOverlay function
const fnStart = s.indexOf('function RoundResultOverlay');
if (fnStart === -1) { console.log('ERROR: Could not find RoundResultOverlay'); process.exit(1); }

// Find the end of the file
const fnEnd = s.lastIndexOf('\n', s.length - 2);

// The old function
const oldFunc = s.substring(fnStart, fnEnd);

const newFunc = `function RoundResultOverlay({ entry, room, status, isBossRoom, isMapMode, onContinue }) {
  const [countdown, setCountdown] = useState(5);
  const monsterKilled  = entry.monsterHPAfter <= 0;
  const allMembersDead = Object.values(room?.members || {}).every(m => !m.alive);
  const partyWiped     = (status === "completed" && room?.result === "lose") || allMembersDead;
  // 地圖模式：只有 Boss 房算最終通關；普通房間通關不算
  const finalWin       = status === "completed" && room?.result === "win" && (!isMapMode || isBossRoom);
  const floorCleared   = monsterKilled && !finalWin;

  // 5 秒倒數計時
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  let title, icon, btnLabel, btnColor;
  if (partyWiped) {
    const killer = room?.monster ? \`\${room.monster.icon}\${room.monster.name}\` : "怪物";
    icon = "💀"; title = \`被《\${killer}》擊殺！\`; btnLabel = "查看結果"; btnColor = "bg-rose-600";
  } else if (finalWin) {
    icon = "🏆"; title = isMapMode ? "Boss 擊倒！\\n地下城完全攻略！" : \`第 \${room.currentFloor} 層通關！\\n地下城完全攻略！\`;
    btnLabel = "🎉 查看結算"; btnColor = "bg-gradient-to-r from-amber-500 to-orange-500";
  } else if (floorCleared) {
    icon = "✨"; title = isMapMode ? "房間通關！" : \`第 \${room.currentFloor} 層通關！\`;
    btnLabel = isMapMode ? "查看結算" : "選擇路線 →"; btnColor = "bg-gradient-to-r from-indigo-500 to-purple-600";
  } else {
    icon = "⚔️"; title = \`第 \${entry.round} 回合結束\`; btnLabel = "下一回合"; btnColor = "bg-slate-700";
  }

  const canContinue = countdown <= 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-5 gap-5 text-white"
      style={{ background: "rgba(15,23,42,0.97)" }}>
      <div className="text-6xl">{icon}</div>
      <div className="text-2xl font-black text-center whitespace-pre-line">{title}</div>

      {/* 本回合傷害摘要 */}
      <div className="w-full max-w-sm bg-white/8 border border-white/10 rounded-2xl p-4 space-y-2">
        <div className="text-xs text-slate-400 font-bold mb-2 flex justify-between">
          <span>本回合總傷害</span>
          <span className="text-amber-300 font-black">{entry.totalDmg?.toLocaleString()}</span>
        </div>
        {(entry.playerLog || []).map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="text-slate-400 flex-1 truncate">{p.name}</span>
            <span className="text-[11px] text-slate-500 font-mono">
              {(p.arrowBreakdown || []).map(a => a.label).join(" ")}
            </span>
            <span className="font-black text-amber-300 min-w-[36px] text-right">{p.dmg}</span>
            {p.crits > 0 && <span className="text-yellow-400 text-xs">💥</span>}
            {p.ctr  > 0 && <span className="text-rose-400 text-xs">-{p.ctr}</span>}
          </div>
        ))}
        {!monsterKilled && (
          <div className="flex justify-between text-xs text-slate-400 border-t border-white/10 pt-2 mt-1">
            <span>怪物剩餘 HP</span>
            <span className="text-rose-300 font-bold">{room.monsterHP?.toLocaleString()}</span>
          </div>
        )}
      </div>

      <button onClick={canContinue ? onContinue : undefined}
        disabled={!canContinue}
        className={\`w-full max-w-sm py-4 rounded-2xl font-black text-lg text-white shadow-lg active:scale-95 transition-all \${
          canContinue ? btnColor : "bg-slate-700/50 text-slate-400 cursor-not-allowed"
        }\`}>
        {canContinue ? btnLabel : \`⏳ \${countdown} 秒後可繼續\`}
      </button>
    </div>
  );
}
`;

s = s.substring(0, fnStart) + newFunc + '\n';
fs.writeFileSync(filePath, s);
console.log('OK - RoundResultOverlay replaced with 5s delay version');
