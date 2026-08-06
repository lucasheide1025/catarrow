// src/lib/dungeonEventVotes.js — 地下城特殊事件的「全員投票」計票規則（純函式）
//
// 背景：特殊事件（DungeonEvent 的二選一）原本只有房主能選，隊員只能看
// 「等待房主選擇事件結果…」。改成全員各投一票，票多的選項套用到全隊。
//
// 計票規則（與 prd.md R4 一致）：
//   1. 只有存活隊員（alive !== false）的票有效
//   2. 票數相同（平票）時，房主的票權重 ×2 打破僵局
//   3. 沒有票（或沒有存活隊員）時 winner 為 null，由呼叫端決定怎麼處理

export function tallyEventVotes({ members = {}, choices = {}, hostId = "" } = {}) {
  const activeIds = Object.entries(members || {})
    .filter(([, m]) => m && m.alive !== false)
    .map(([id]) => id);

  const votes = {};
  for (const id of activeIds) {
    const choice = choices[id];
    if (choice === undefined || choice === null || choice === "") continue;
    votes[id] = choice;
  }

  if (activeIds.length === 0 || Object.keys(votes).length === 0) {
    return { winner: null, tally: {}, votes };
  }

  const count = (withHostTiebreak) => {
    const tally = {};
    for (const [id, choice] of Object.entries(votes)) {
      const weight = withHostTiebreak && id === hostId ? 2 : 1;
      tally[choice] = (tally[choice] || 0) + weight;
    }
    return tally;
  };

  let tally = count(false);
  const maxVotes = Math.max(...Object.values(tally));
  const leaders = Object.entries(tally).filter(([, v]) => v === maxVotes).map(([c]) => c);

  let winnerKey;
  if (leaders.length === 1) {
    winnerKey = leaders[0];
  } else if (hostId && votes[hostId] !== undefined) {
    tally = count(true);
    const max = Math.max(...Object.values(tally));
    winnerKey = Object.entries(tally).find(([, v]) => v === max)?.[0] || leaders[0];
  } else {
    winnerKey = leaders[0];
  }

  // 物件 key 一律是字串：還原成投票者原本寫入的型別（數字選項就回數字）
  const winner = Object.values(votes).find(v => String(v) === String(winnerKey)) ?? winnerKey;

  return { winner, tally, votes };
}

export function allActiveMembersVoted({ members = {}, choices = {} } = {}) {
  const activeIds = Object.entries(members || {})
    .filter(([, m]) => m && m.alive !== false)
    .map(([id]) => id);
  if (activeIds.length === 0) return false;
  return activeIds.every(id => {
    const choice = choices[id];
    return choice !== undefined && choice !== null && choice !== "";
  });
}
