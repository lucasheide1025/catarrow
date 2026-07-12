# Design

## 1. 隱藏戰鬥畫面「離開」按鈕（`DungeonBattleRoom.jsx`）

第 1352 行附近：

```jsx
{!expeditionMode && (
  <button onClick={handleLeave}
    style={{ background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.18)", color:"rgba(255,255,255,0.55)", borderRadius:7, padding:"1px 8px", fontSize:11, cursor:"pointer" }}>
    離開
  </button>
)}
```

`expeditionMode` prop 本來就存在，不需要新增 state。地圖層級「撤退」二次確認流程完全不動。

## 2. `expeditionDb.js` 新增單人遠征持久化函式

比照 `dungeonDb.js` 的 `setActiveDungeon`/`clearActiveDungeon` 命名風格：

```js
// members/{memberId}.activeExpedition = { family, difficultyTier, isHidden, floorsCleared, startedAt } | 不存在
export async function setActiveExpeditionProgress(memberId, { family, difficultyTier, isHidden, floorsCleared }) {
  try {
    await updateDoc(doc(db, "members", memberId), {
      activeExpedition: { family, difficultyTier, isHidden: !!isHidden, floorsCleared, startedAt: serverTimestamp() },
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}

export async function clearActiveExpeditionProgress(memberId) {
  try {
    await updateDoc(doc(db, "members", memberId), { activeExpedition: deleteField() });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// 中斷結算：沿用既有 calculateExpeditionRewards + grantExpeditionRewards + saveExpeditionRecord
export async function settleAbandonedExpedition(memberId, { family, difficultyTier, isHidden, floorsCleared }) {
  const rewards = calculateExpeditionRewards({ difficultyTier, floorsCleared, won: false });
  await grantExpeditionRewards(memberId, rewards).catch(() => {});
  await saveExpeditionRecord(memberId, {
    family, difficulty: difficultyTier, isHidden, floorsCleared, won: false,
    coins: rewards.coins, arrowDew: rewards.arrowDew, archerXP: rewards.archerXP,
    settledFromDisconnect: true,
  }).catch(() => {});
  await clearActiveExpeditionProgress(memberId);
  return { ok: true, rewards };
}
```

`setActiveExpeditionProgress` 用 `updateDoc`（不是 `setDoc merge`），因為 `activeExpedition` 是整個物件覆寫，語意上每次樓層推進都是「取代」不是「合併」。

## 3. `DungeonExpedition.jsx` 掛接持久化

- 進入元件（`useEffect`，`[]` deps）：呼叫一次 `setActiveExpeditionProgress(myId, {family, difficultyTier, isHidden, floorsCleared:0})`。
- `floorsCleared` 改變時（現有的 `setFloorsCleared`/`handleDescend`-equivalent 呼叫點，樓層推進處）：追加呼叫 `setActiveExpeditionProgress` 更新最新 `floorsCleared`（不需要每次都 await，`.catch(()=>{})` fire-and-forget，比照現有寫法慣例）。
- `handleFinish()`（1057行）成功結算後：追加呼叫 `clearActiveExpeditionProgress(myId)`。
- `handleAbandon()`（1013行，真正撤退確認後才會呼叫）：追加呼叫 `clearActiveExpeditionProgress(myId)`（撤退視同放棄，不留殘餘進度紀錄，跟舊系統「主動放棄不結算」的既有語意一致，這裡刻意不用 `settleAbandonedExpedition`，因為那是留給「非自願中斷」用的）。

## 4. `DungeonLobby.jsx` 單人遠征復原 banner

比照既有的 `reconnectRoom`（組隊，51-61行）：

```js
const [soloRecovery, setSoloRecovery] = useState(null); // profile.activeExpedition | null

useEffect(() => {
  if (profile?.activeExpedition) setSoloRecovery(profile.activeExpedition);
}, [profile?.activeExpedition]);

async function handleSettleSolo() {
  if (!soloRecovery) return;
  const { settleAbandonedExpedition } = await import("../../lib/expeditionDb");
  const res = await settleAbandonedExpedition(myId, soloRecovery);
  setSoloRecovery(null);
  if (res.ok) {
    // 用既有 toast 機制提示（沿用 shared/UI useToast，比照 VillageGoalBanner 這次的作法）
  }
}
```

Banner 只有一個「結算並領取」按鈕（不像組隊 banner 有「重新連結」——單人模式刻意不做地圖復原，見 PRD 排除項）。文案：「偵測到中斷的單人遠征，已完成 {floorsCleared} 層，點擊結算領取獎勵。」

`profile` 從 `useAuth()` 即時訂閱，`activeExpedition` 欄位變化會自動反映，不需要額外訂閱。

## 5. `TeamExpeditionBattle.jsx` 卡死保護

新增兩個 `useEffect`，仿照 `DungeonBattleRoom.jsx` 358-373 行的既有模式：

```js
// 房主：地圖協調狀態卡住 20 秒 → 自動清除 activeRoomId/roomConfirms/currentEvent，讓房主能重新操作
useEffect(() => {
  if (!isHost || !teamRoom?.activeRoomId) return;
  const t = setTimeout(() => {
    updateTeamExpeditionRoom(teamRoomId, {
      activeRoomId: null, roomConfirms: {}, roomChoices: {}, currentEvent: null,
    }).catch(() => {});
  }, 20000);
  return () => clearTimeout(t);
}, [teamRoom?.activeRoomId, isHost, teamRoomId]);

// 非房主：等待房主超過 20 秒 → 顯示提示 + 安全退出選項（本地離開，不動 Firestore members）
const [showStuckHint, setShowStuckHint] = useState(false);
useEffect(() => {
  setShowStuckHint(false);
  if (isHost) return;
  const t = setTimeout(() => setShowStuckHint(true), 20000);
  return () => clearTimeout(t);
}, [teamRoom?.activeRoomId, teamRoom?.currentBattleRoomId, teamRoom?.expeditionMapState?.phase, isHost]);
```

`showStuckHint` 為 true 時，在畫面上疊一個提示條：「等待房主動作中，若長時間沒反應可能是連線問題。」+「暫時返回大廳」按鈕，onClick 只呼叫 `onComplete?.()`（跟正常結算完成走同一個回調，只是清掉本地畫面，**不呼叫** `leaveTeamExpeditionRoom`/`handleAbandon`），玩家之後可以從 `DungeonLobby.jsx` 既有的 `reconnectRoom` banner 重新連回來。

## firestore.rules

`members` collection 的 `allow update` hasOnly 白名單（23-38行）加入 `"activeExpedition"`。
