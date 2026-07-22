import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  clearActiveTitle, equipCard, refreshCardCollection, setActiveTitle,
  setMythicCardStat, setWorldBossCardStat, subscribeCardCollection,
  unequipCard, upgradeCard,
} from "../../lib/db";
import { calcEquippedBonus, resolveEquippedCards } from "../../lib/monsterCards";
import { FAMILY_SET_BONUSES, calcFamilySetStatus } from "../../lib/cardTalents";
import { sfxBuff, sfxError, sfxLevelUp } from "../../lib/sound";
import CardCollectionPrototype from "./cards/CardCollectionPrototype";

const EMPTY_COLLECTION = { cards:{}, wbCards:{}, equipped:[] };

export default function CardCollectionModern({ guestProfile }) {
  const { profile:authProfile } = useAuth();
  const profile=guestProfile||authProfile;
  const [collection, setCollection] = useState(EMPTY_COLLECTION);
  const [collectionReady, setCollectionReady] = useState(false);
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef(null);

  useEffect(() => {
    if (!profile?.id) return undefined;
    setCollectionReady(false);
    return subscribeCardCollection(profile.id, data => { setCollection(data); setCollectionReady(true); });
  }, [profile?.id]);

  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  const showNotice = useCallback(message => {
    clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = setTimeout(() => setNotice(""), 2500);
  }, []);

  const refresh = useCallback(() => {
    if (profile?.id) return refreshCardCollection(profile.id, setCollection);
    return Promise.resolve();
  }, [profile?.id]);

  const handleEquip = useCallback(async view => {
    if (!profile?.id) return;
    const key = view.source === "wb" ? view.cardId : view.monsterId;
    const result = view.equipped
      ? await unequipCard(profile.id, key, view.source || "monster")
      : await equipCard(profile.id, key, view.source || "monster");
    if (!result?.ok) { sfxError(); showNotice(result?.reason || "操作失敗"); return; }
    await refresh();
    showNotice(view.equipped ? "已卸下卡片" : "已裝備卡片");
  }, [profile?.id, refresh, showNotice]);

  const handleUpgrade = useCallback(async view => {
    if (!profile?.id || view.source === "wb") return;
    const result = await upgradeCard(profile.id, view.monsterId);
    if (!result?.ok) { sfxError(); showNotice(result?.reason || "升星失敗"); return; }
    sfxLevelUp();
    await refresh();
    showNotice(`升星成功，目前 ${result.newStars}★`);
  }, [profile?.id, refresh, showNotice]);

  const handlePickStat = useCallback(async (view, stat) => {
    if (!profile?.id) return;
    if (view.source === "wb") await setWorldBossCardStat(profile.id, view.cardId, stat);
    else await setMythicCardStat(profile.id, view.monsterId, stat);
    sfxBuff();
    await refresh();
    showNotice(`已設定 ${stat.toUpperCase()} 屬性`);
  }, [profile?.id, refresh, showNotice]);

  const handleSetTitle = useCallback(async view => {
    if (!profile?.id || view.source !== "wb") return;
    if (view.activeTitle) await clearActiveTitle(profile.id);
    else await setActiveTitle(profile.id, view.cardId);
    await refresh();
    showNotice(view.activeTitle ? "已取消展示稱號" : "已設定展示稱號");
  }, [profile?.id, refresh, showNotice]);

  const bonus = useMemo(() => calcEquippedBonus(resolveEquippedCards(collection)), [collection]);
  const ownedCount = Object.keys(collection.cards || {}).length + Object.keys(collection.wbCards || {}).length;

  return <div style={{minHeight:"100%",background:"linear-gradient(180deg,#07101d,#0b1220)",paddingBottom:24}}>
    <header style={{margin:12,padding:"16px",borderRadius:18,background:"linear-gradient(135deg,#312e81,#172554)",border:"1px solid rgba(129,140,248,.35)",color:"#fff"}}>
      <div style={{fontSize:11,fontWeight:900,letterSpacing:".12em",color:"#c7d2fe"}}>冒險卡片圖鑑</div>
      <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:12,marginTop:4}}>
        <div style={{fontSize:22,fontWeight:900}}>已收藏 {ownedCount} 張</div>
        <div style={{fontSize:11,color:"#a5b4fc"}}>每組最多顯示 6 張</div>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:12}}>
        <span style={pillStyle}>❤️ HP +{bonus.hp || 0}</span>
        <span style={pillStyle}>⚔️ ATK +{bonus.atk || 0}</span>
        <span style={pillStyle}>🛡️ DEF +{bonus.def || 0}</span>
      </div>
      {/* 族系套裝狀態（同族怪物卡 2/4 張觸發） */}
      {(() => {
        const cards = collection.cards || {};
        const views = (collection.equipped || [])
          .map(item => (typeof item === "string" ? { key: item, source: "monster" } : item))
          .filter(item => item.source !== "wb")
          .map(item => cards[item.key] ? { monsterId: item.key, family: cards[item.key].family, source: "monster" } : null)
          .filter(Boolean);
        const sets = calcFamilySetStatus(views);
        if (!sets.length) return <div style={{marginTop:8,fontSize:10,color:"#a5b4fc"}}>💡 裝備同族卡 2／4 張可觸發族系套裝效果</div>;
        return <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
          {sets.map(set => (
            <span key={set.family} style={{...pillStyle, border:`1px solid ${set.tier2?"rgba(52,211,153,.5)":"rgba(255,255,255,.12)"}`, color:set.tier2?"#6ee7b7":"#94a3b8"}}>
              {FAMILY_SET_BONUSES[set.family]?.name}（{set.count}）{set.tier4?`✦ ${set.text2}＋${set.text4}`:set.tier2?`✦ ${set.text2}`:`（2張啟動）`}
            </span>
          ))}
        </div>;
      })()}
    </header>
    {notice && <div role="status" style={{margin:"0 12px 8px",padding:"9px 12px",borderRadius:10,textAlign:"center",background:"rgba(16,185,129,.12)",border:"1px solid rgba(52,211,153,.35)",color:"#6ee7b7",fontWeight:900,fontSize:12}}>{notice}</div>}
    <CardCollectionPrototype
      memberId={profile?.id}
      collection={collection}
      collectionReady={collectionReady}
      onEquip={handleEquip}
      onUpgrade={handleUpgrade}
      onPickStat={handlePickStat}
      onSetTitle={handleSetTitle}
    />
  </div>;
}

const pillStyle = {padding:"5px 9px",borderRadius:999,background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.12)",fontSize:11,fontWeight:900};
