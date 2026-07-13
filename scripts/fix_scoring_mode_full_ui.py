#!/usr/bin/env python3
"""Modify BattleScreen.jsx scoringMode branch to include full battle display."""

import sys
sys.stdout.reconfigure(encoding='utf-8')

path = "src/components/battle/BattleScreen.jsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# The scoringMode branch currently returns just the scoring panel + particles/arrowFlight
# We need to make it also show the full battle display (monster, player card, allies, background)

# Strategy: Instead of the simple scoringMode branch, render the full battle container
# but with the scoring panel pre-opened (no need for "射擊" button)

# Find the scoringMode branch
old_scoring = """  // ── 計分模式（只顯示計分層，無戰鬥容器）──
  if (scoringMode) {
    return (<div style={{position:\"relative\",width:380,maxWidth:\"92vw\",borderRadius:30,overflow:\"hidden\",boxShadow:\"0 20px 50px rgba(0,0,0,.5), 0 0 0 8px #0a0e18, 0 0 0 9px rgba(255,255,255,.06)\",userSelect:\"none\",background:\"#0a1018\"}}>
      {/* ── particles overlay ── */}
      {particles.length>0&&<div style={{position:\"absolute\",inset:0,zIndex:20,pointerEvents:\"none\",overflow:\"hidden\",borderRadius:30}}>{particles.map(p=><div key={p.id} style={{position:\"absolute\",left:`${p.x}%`,top:`${p.y}%`,width:p.sz,height:p.sz,borderRadius:\"50%\",background:p.cl,opacity:0,boxShadow:`0 0 6px ${p.cl}99`,animation:`particleBurst .75s ease-out ${p.dl}s forwards`,\"--dx\":`${p.dx}px`,\"--dy\":`${p.dy}px`}}/>)}</div>}
      {/* ── arrow flight ── */}
      {arrowFlight&&<div key={arrowFlight} style={{position:\"absolute\",zIndex:21,pointerEvents:\"none\",left:\"50%\",marginLeft:-14,bottom:\"28%\",fontSize:28,filter:\"drop-shadow(0 0 8px #fbbf24aa) drop-shadow(0 0 16px #fbbf2444)\",animation:\"arrowFly .5s ease-out forwards\"}}>🏹</div>}
      {isScoring&&(<div style={{background:\"linear-gradient(180deg,#101a2e,#0b1220)\",borderRadius:\"18px\",padding:\"16px 16px 20px\",boxShadow:\"0 -20px 50px rgba(0,0,0,.6)\"}}>
        <div style={{display:\"flex\",justifyContent:\"space-between\",alignItems:\"center\",marginBottom:10}}>
          <div style={{fontSize:14,fontWeight:900,color:battle.arrows.length>=arrowsPerRound?\"#f5b942\":\"#eef3fc\"}}>{\"\\u2705\"} 6 {battle.arrows.length>=arrowsPerRound?\"確認無誤後送出\":`箭已輸入，${battle.arrowIdx+1}`}</div>
          <div style={{fontSize:11,color:\"#9fb0cf\"}}>{Math.min(battle.arrows.length,arrowsPerRound)} / {arrowsPerRound}</div>
        </div>
        {scoreInput===\"target\"&&(<div style={{display:\"flex\",flexDirection:\"column\",alignItems:\"center\",marginBottom:10}}><TargetFace arrows={battle.arrows} onPick={battle.arrows.length<arrowsPerRound?handleScore:undefined}/><div style={{fontSize:11,color:\"#9fb0cf\",marginTop:4}}>點靶面對應環數計分</div></div>)}
        <div style={{display:\"flex\",gap:6,marginBottom:12,minHeight:36,alignItems:\"center\"}}>
          {Array.from({length:arrowsPerRound}).map((_,i)=>{const a=battle.arrows[i];return(<div key={i} style={{flex:1,height:34,borderRadius:9,border:a?(a.isCrit?\"1px solid #fbbf24\":\"1px solid rgba(255,255,255,.2)\"):(i===battle.arrowIdx?\"2px solid #f5b942\":\"1px dashed rgba(255,255,255,.16)\"),display:\"grid\",placeItems:\"center\",fontSize:14,fontWeight:900,color:a?\"#eaf6ff\":(i===battle.arrowIdx?\"#f5b942\":\"#6b7a99\"),background:a?(a.isCrit?\"rgba(251,191,36,.18)\":\"rgba(255,255,255,.08)\"):(i===battle.arrowIdx?\"rgba(245,185,66,.12)\":\"rgba(255,255,255,.03)\"),fontVariantNumeric:\"tabular-nums\",boxShadow:i===battle.arrowIdx?\"0 0 0 2px rgba(245,185,66,.3)\":\"none\"}}>{a?a.score:(i===battle.arrowIdx?\"\\u25bc\":\"\")}</div>)})}
        </div>
        {scoreInput===\"keypad\"&&<div style={{display:\"grid\",gridTemplateColumns:\"repeat(4,1fr)\",gap:8,opacity:battle.arrows.length>=arrowsPerRound?0.35:1,pointerEvents:battle.arrows.length>=arrowsPerRound?\"none\":\"auto\"}}>
          {scoreKeys.map(k=>(<button key={k} onClick={()=>handleScore(k)} style={{height:46,borderRadius:11,border:k===\"X\"?\"1px solid rgba(245,185,66,.4)\":k===\"M\"?\"1px solid rgba(239,83,80,.4)\":\"1px solid rgba(255,255,255,.12)\",background:\"rgba(255,255,255,.05)\",color:k===\"X\"?\"#f5b942\":k===\"M\"?\"#f87171\":\"#eef3fc\",fontSize:18,fontWeight:800,cursor:\"pointer\",fontVariantNumeric:\"tabular-nums\"}}>{k}</button>))}
        </div>}
        <div style={{display:\"flex\",gap:8,marginTop:10}}>
          <button onClick={handleUndo} disabled={battle.arrows.length===0} style={{flex:\"0 0 auto\",padding:\"0 16px\",height:46,borderRadius:11,border:\"1px solid rgba(255,255,255,.14)\",background:\"rgba(255,255,255,.05)\",color:battle.arrows.length===0?\"#5a6b8a\":\"#cbd6ea\",fontSize:14,fontWeight:800,cursor:battle.arrows.length===0?\"not-allowed\":\"pointer\"}}>刪除上一箭</button>
          <button onClick={handleScoringSubmit} disabled={battle.arrows.length<arrowsPerRound} style={{flex:1,height:46,borderRadius:11,border:\"none\",background:battle.arrows.length>=arrowsPerRound?\"linear-gradient(180deg,#ffcf5a,#f5a623)\":\"rgba(255,255,255,.06)\",color:battle.arrows.length>=arrowsPerRound?\"#3a2600\":\"#5a6b8a\",fontSize:16,fontWeight:900,cursor:battle.arrows.length>=arrowsPerRound?\"pointer\":\"not-allowed\",boxShadow:battle.arrows.length>=arrowsPerRound?\"0 6px 18px rgba(245,166,35,.4)\":\"none\"}}>{battle.arrows.length>=arrowsPerRound?\"送出這一回合\":`再輸入 ${arrowsPerRound-battle.arrows.length} 箭`}</button>
        </div>
      </div>)}
    </div>);
  }"""

# New scoringMode branch: show full battle display (monster, player, allies) + scoring panel
new_scoring = """  // ── 計分模式（顯示完整戰鬥畫面 + 計分層）──
  if (scoringMode) {
    return (<div style={{position:\"relative\",width:380,maxWidth:\"92vw\",borderRadius:30,overflow:\"hidden\",boxShadow:\"0 20px 50px rgba(0,0,0,.5), 0 0 0 8px #0a0e18, 0 0 0 9px rgba(255,255,255,.06)\",userSelect:\"none\",background:\"#0a1018\"}}>
      {/* 背景 */}
      <img src={bgUrl} alt=\"\" style={{position:\"absolute\",inset:0,width:\"100%\",height:\"100%\",objectFit:\"cover\"}} onError={e=>{{e.target.style.display=\"none\"}}} />
      <div style={{position:\"absolute\",inset:0,zIndex:1,pointerEvents:\"none\",background:\"linear-gradient(180deg,rgba(4,7,13,.5),transparent 20%,transparent 55%,rgba(4,7,13,.72))\"}}>
        <div style={{position:\"absolute\",inset:0,boxShadow:\"inset 0 0 120px 20px rgba(0,0,0,.55)\"}} />
      </div>
      {/* 頂部資訊列 */}
      <div style={{position:\"absolute\",top:0,left:0,right:0,zIndex:5,display:\"flex\",alignItems:\"center\",justifyContent:\"center\",gap:8,padding:\"7px 14px\",fontSize:11,fontWeight:800,letterSpacing:\".02em\",color:\"#dbe6f8\",background:\"linear-gradient(180deg,rgba(6,10,18,.9),rgba(6,10,18,.35))\",borderBottom:\"1px solid rgba(255,255,255,.08)\"}}>
        <span style={{color:\"#fff\"}}>🎯 分數靶</span>
        <span style={{color:\"#6b7a99\"}}>·</span>
        <span>第 <b style={{color:battle.phase!==PHASE.IDLE?\"#f5b942\":\"#6b7a99\",fontVariantNumeric:\"tabular-nums\"}}>{battle.phase!==PHASE.IDLE?battle.round:\"—\"}</b> 回合</span>
        <BattleSoundIndicator compact />
      </div>
      {/* VS 進場 */}
      {isIntro&&(<div style={{position:\"absolute\",inset:0,zIndex:20,background:\"linear-gradient(135deg,#0f172a,#1e1b4b,#0f172a)\",display:\"flex\",flexDirection:\"column\",alignItems:\"center\",justifyContent:\"center\",gap:8}}>
        <div style={{width:\"100%\",display:\"flex\",alignItems:\"center\",justifyContent:\"space-around\",padding:\"0 16px\"}}>
          <div style={{display:\"flex\",flexDirection:\"column\",alignItems:\"center\",gap:6,animation:\"introArc .6s cubic-bezier(.34,1.56,.64,1) both\"}}>
            <CatSVG catId={player?.catId||\"diandian\"} size={80} />
            <div style={{fontSize:12,fontWeight:700,color:\"#c4b5fd\",textShadow:\"0 0 8px #7c3aed\"}}>{player?.name||\"\"}</div>
          </div>
          <div style={{animation:\"introVs .8s .4s cubic-bezier(.34,1.56,.64,1) both\"}}><div style={{fontSize:38,fontWeight:900,color:\"#fbbf24\",textShadow:\"0 0 24px #f59e0b, 0 0 48px #f59e0b\"}}>VS</div></div>
          <div style={{display:\"flex\",flexDirection:\"column\",alignItems:\"center\",gap:6,animation:\"introMon .6s cubic-bezier(.34,1.56,.64,1) both\"}}>
            <div style={{filter:\"drop-shadow(0 0 16px #ef4444)\"}}>{renderMonster ? renderMonster(80, monster) : <MonsterSVG id={monster?.id} size={80}/>}</div>
            <div style={{fontSize:12,fontWeight:700,color:\"#fca5a5\",textShadow:\"0 0 8px #ef4444\"}}>{battle.monsterName||monster?.name||\"\"}</div>
          </div>
        </div>
        <div style={{marginTop:16,animation:\"introStart .5s 1.2s cubic-bezier(.34,1.56,.64,1) both\",opacity:0}}><div style={{fontSize:24,fontWeight:900,color:\"#fff\",textShadow:\"0 0 24px #fbbf24\",letterSpacing:4,textAlign:\"center\"}}>⚔️ 戰鬥開始！</div></div>
      </div>)}
      {/* 怪物 */}
      <div style={{position:\"absolute\",zIndex:2,top:52,right:\"4%\",width:\"47%\",display:\"flex\",flexDirection:\"column\",alignItems:\"center\",gap:7,filter:\"drop-shadow(0 16px 26px rgba(0,0,0,.6))\",animation:battle.phase===PHASE.IDLE?\"none\":\"bob 4.6s ease-in-out infinite\"}}>
        <div style={{width:\"100%\",borderRadius:18,overflow:\"hidden\",boxShadow:battle.phase!==PHASE.IDLE?`0 0 0 2px ${familyColor}59, 0 0 26px ${familyColor}47`:\"0 0 0 2px rgba(255,255,255,.12)\"}}>{renderMonster ? renderMonster(180, monster) : <MonsterSVG id={monster?.id} size={180}/>}</div>
        <div style={{width:\"88%\"}}>
          <div style={{display:\"flex\",flexDirection:\"column\",gap:3}}>
            <div style={{display:\"flex\",justifyContent:\"space-between\",alignItems:\"center\",fontSize:11,fontWeight:800,textShadow:\"0 2px 6px #000\"}}>
              <b style={{color:\"#fff\",fontSize:12.5}}>{battle.phase!==PHASE.IDLE?battle.monsterName:monster?.name}</b>
            </div>
          </div>
          <div style={{height:7,borderRadius:99,background:\"rgba(0,0,0,.55)\",overflow:\"hidden\",boxShadow:\"inset 0 0 0 1px rgba(255,255,255,.14)\"}}><div style={{width:`${battle.phase!==PHASE.IDLE?Math.max(0,(battle.monsterHp/battle.monsterMaxHp)*100):100}%`,height:\"100%\",borderRadius:99,background:\"linear-gradient(90deg,#ff7a7a,#e03b3b)\",transition:\"width .4s ease-out\"}}/></div>
          <div style={{display:\"flex\",justifyContent:\"space-between\",fontSize:8.5,color:\"#6b7a99\",fontWeight:700,marginTop:2,fontVariantNumeric:\"tabular-nums\"}}><span>HP</span><span><b style={{color:battle.phase!==PHASE.IDLE?\"#dce8fb\":\"#6b7a99\"}}>{battle.phase!==PHASE.IDLE?battle.monsterHp.toLocaleString():\"?\"}</b> / {battle.phase!==PHASE.IDLE?battle.monsterMaxHp.toLocaleString():\"?\"}</span></div>
        </div>
      </div>
      {/* 隊友 + 玩家 */}
      <div style={{position:\"absolute\",left:12,bottom:14,zIndex:4,display:\"flex\",flexDirection:\"column\",gap:8,alignItems:\"flex-start\"}}>
        {allies.length>0&&(<div style={{width:180,display:\"flex\",flexWrap:\"wrap\",gap:7,background:\"rgba(9,14,25,.4)\",border:\"1px solid rgba(255,255,255,.08)\",borderRadius:14,padding:7}}>
          {allies.map((mate,i)=><div key={i} style={{position:\"relative\",width:38}}>
            <div style={{width:38,height:38,borderRadius:11,overflow:\"hidden\",boxShadow:`0 4px 10px rgba(0,0,0,.55), inset 0 0 0 2px ${mate.isFront||mate.role===\"front\"?\"#ffb454\":\"#7dd3fc\"}`,filter:!mate.alive?\"grayscale(1) brightness(.45)\":\"none\"}}><CatSVG catId={mate.catId} size={38}/></div>
            <div style={{height:4,borderRadius:99,background:\"rgba(0,0,0,.6)\",marginTop:3,overflow:\"hidden\"}}><div style={{width:`${Math.max(0,(mate.hp/mate.maxHP)*100)}%`,height:\"100%\",background:\"linear-gradient(90deg,#5ff0a3,#22b866)\"}}/></div>
            <div style={{position:\"absolute\",top:-5,right:-5,width:17,height:17,borderRadius:99,display:\"grid\",placeItems:\"center\",fontSize:10,fontWeight:900,background:mate.done||mate.ready?\"#22c866\":\"rgba(245,185,66,.2)\",boxShadow:mate.done||mate.ready?\"0 0 0 2px #0b1220\":\"0 0 0 2px rgba(245,185,66,.45)\",color:mate.done||mate.ready?\"#0a1f12\":\"#f5b942\"}}>{mate.done||mate.ready?\"✓\":\"⏳\"}</div>
          </div>)}
        </div>)}
        {/* 玩家卡 */}
        {(()=>{{const curDmg=battle.lastArrowDmg||0;return(<div style={{width:180,background:\"rgba(9,14,25,.62)\",border:`2px solid ${battle.lastArrowCrit?\"#f5b942\":\"#4cc9f0\"}`,borderRadius:15,padding:\"6px 9px\",backdropFilter:\"blur(8px)\",boxShadow:`0 6px 18px rgba(0,0,0,.45), 0 0 ${battle.lastArrowCrit?20:14}px ${battle.lastArrowCrit?\"rgba(245,185,66,.75)\":\"transparent\"}`}}>
          <div style={{display:\"flex\",gap:8,alignItems:\"center\"}}>
            <div style={{width:44,height:44,borderRadius:11,overflow:\"hidden\",flexShrink:0,boxShadow:\"0 4px 12px rgba(0,0,0,.5), inset 0 0 0 2px #4cc9f0\"}}><CatSVG catId={player?.catId||\"diandian\"} size={44}/></div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:\"flex\",alignItems:\"center\",gap:4,fontSize:12,fontWeight:900}}>{player?.name||\"\"}<span style={{fontSize:7.5,fontWeight:900,color:\"#241400\",background:\"#f5b942\",borderRadius:4,padding:\"1px 4px\"}}>你</span></div>
              <div style={{height:5,borderRadius:99,background:\"rgba(0,0,0,.55)\",overflow:\"hidden\",marginTop:3,boxShadow:\"inset 0 0 0 1px rgba(255,255,255,.14)\"}}><div style={{width:`${Math.max(0,((battle.playerHp||player?.hp||100)/(battle.playerMaxHp||player?.maxHp||100))*100)}%`,height:\"100%\",borderRadius:99,background:\"linear-gradient(90deg,#5ff0a3,#22b866)\",transition:\"width .4s ease-out\"}}/></div>
            </div>
          </div>
          {battle.lastArrowDmg>0&&<div style={{fontSize:10,fontWeight:900,color:battle.lastArrowCrit?\"#fbbf24\":\"#ff7a7a\",marginTop:4,textAlign:\"center\"}}>上箭：{battle.lastArrowPart} · {battle.lastArrowDmg}{battle.lastArrowCrit?\" 💥\":\"\"}</div>}
        </div>);}}()}
      </div>
      {/* particles overlay */}
      {particles.length>0&&<div style={{position:\"absolute\",inset:0,zIndex:15,pointerEvents:\"none\",overflow:\"hidden\"}}>{particles.map(p=><div key={p.id} style={{position:\"absolute\",left:`${p.x}%`,top:`${p.y}%`,width:p.sz,height:p.sz,borderRadius:\"50%\",background:p.cl,opacity:0,boxShadow:`0 0 6px ${p.cl}99`,animation:`particleBurst .75s ease-out ${p.dl}s forwards`,\"--dx\":`${p.dx}px`,\"--dy\":`${p.dy}px`}}/>)}</div>}
      {/* arrow flight */}
      {arrowFlight&&<div key={arrowFlight} style={{position:\"absolute\",zIndex:16,pointerEvents:\"none\",left:\"50%\",marginLeft:-14,bottom:\"28%\",fontSize:28,filter:\"drop-shadow(0 0 8px #fbbf24aa) drop-shadow(0 0 16px #fbbf2444)\",animation:\"arrowFly .5s ease-out forwards\"}}>🏹</div>}
      {/* 計分層 */}
      {isScoring&&(<div style={{position:\"absolute\",inset:0,zIndex:10,background:\"rgba(4,7,13,.68)\",backdropFilter:\"blur(2px)\",display:\"flex\",flexDirection:\"column\",justifyContent:\"flex-end\"}}>
        <div style={{background:\"linear-gradient(180deg,#101a2e,#0b1220)\",borderRadius:\"18px 18px 0 0\",padding:\"16px 16px 20px\",boxShadow:\"0 -20px 50px rgba(0,0,0,.6)\",animation:\"rise .28s cubic-bezier(.2,.9,.3,1)\"}}>
          <div style={{display:\"flex\",justifyContent:\"space-between\",alignItems:\"center\",marginBottom:10}}>
            <div style={{fontSize:14,fontWeight:900,color:battle.arrows.length>=arrowsPerRound?\"#f5b942\":\"#eef3fc\"}}>{\"\\u2705\"} {arrowsPerRound} 箭{battle.arrows.length>=arrowsPerRound?\"，送出":`，第 ${battle.arrowIdx+1} 箭`}</div>
            <div style={{fontSize:11,color:\"#9fb0cf\"}}>{Math.min(battle.arrows.length,arrowsPerRound)} / {arrowsPerRound}</div>
          </div>
          {scoreInput===\"target\"&&(<div style={{display:\"flex\",flexDirection:\"column\",alignItems:\"center\",marginBottom:10}}><TargetFace arrows={battle.arrows} onPick={battle.arrows.length<arrowsPerRound?handleScore:undefined}/><div style={{fontSize:11,color:\"#9fb0cf\",marginTop:4}}>👆 點靶面對應環數</div></div>)}
          <div style={{display:\"flex\",gap:6,marginBottom:12,minHeight:36,alignItems:\"center\"}}>
            {Array.from({{length:arrowsPerRound}}).map((_,i)=>{{const a=battle.arrows[i];return(<div key={i} style={{flex:1,height:34,borderRadius:9,border:a?(a.isCrit?\"1px solid #fbbf24\":\"1px solid rgba(255,255,255,.2)\"):(i===battle.arrowIdx?\"2px solid #f5b942\":\"1px dashed rgba(255,255,255,.16)\"),display:\"grid\",placeItems:\"center\",fontSize:14,fontWeight:900,color:a?\"#eaf6ff\":(i===battle.arrowIdx?\"#f5b942\":\"#6b7a99\"),background:a?(a.isCrit?\"rgba(251,191,36,.18)\":\"rgba(255,255,255,.08)\"):(i===battle.arrowIdx?\"rgba(245,185,66,.12)\":\"rgba(255,255,255,.03)\"),fontVariantNumeric:\"tabular-nums\",boxShadow:i===battle.arrowIdx?\"0 0 0 2px rgba(245,185,66,.3)\":\"none\"}}>{a?a.score:(i===battle.arrowIdx?\"\\u25bc\":\"\")}</div>)}})}
          </div>
          {scoreInput===\"keypad\"&&<div style={{display:\"grid\",gridTemplateColumns:\"repeat(4,1fr)\",gap:8,opacity:battle.arrows.length>=arrowsPerRound?0.35:1,pointerEvents:battle.arrows.length>=arrowsPerRound?\"none\":\"auto\"}}>
            {scoreKeys.map(k=>(<button key={k} onClick={()=>handleScore(k)} style={{height:46,borderRadius:11,border:k===\"X\"?\"1px solid rgba(245,185,66,.4)\":k===\"M\"?\"1px solid rgba(239,83,80,.4)\":\"1px solid rgba(255,255,255,.12)\",background:\"rgba(255,255,255,.05)\",color:k===\"X\"?\"#f5b942\":k===\"M\"?\"#f87171\":\"#eef3fc\",fontSize:18,fontWeight:800,cursor:\"pointer\",fontVariantNumeric:\"tabular-nums\"}}>{k}</button>))}
          </div>}
          <div style={{display:\"flex\",gap:8,marginTop:10}}>
            <button onClick={handleUndo} disabled={battle.arrows.length===0} style={{flex:\"0 0 auto\",padding:\"0 16px\",height:46,borderRadius:11,border:\"1px solid rgba(255,255,255,.14)\",background:\"rgba(255,255,255,.05)\",color:battle.arrows.length===0?\"#5a6b8a\":\"#cbd6ea\",fontSize:14,fontWeight:800,cursor:battle.arrows.length===0?\"not-allowed\":\"pointer\"}}>⌫ 刪除</button>
            <button onClick={handleScoringSubmit} disabled={battle.arrows.length<arrowsPerRound} style={{flex:1,height:46,borderRadius:11,border:\"none\",background:battle.arrows.length>=arrowsPerRound?\"linear-gradient(180deg,#ffcf5a,#f5a623)\":\"rgba(255,255,255,.06)\",color:battle.arrows.length>=arrowsPerRound?\"#3a2600\":\"#5a6b8a\",fontSize:16,fontWeight:900,cursor:battle.arrows.length>=arrowsPerRound?\"pointer\":\"not-allowed\",boxShadow:battle.arrows.length>=arrowsPerRound?\"0 6px 18px rgba(245,166,35,.4)\":\"none\"}}>{battle.arrows.length>=arrowsPerRound?\"送出這一回合\":`${arrowsPerRound-battle.arrows.length} 箭`}</button>
          </div>
        </div>
      </div>)}
      <style>{`@keyframes bob{{50%{{transform:translateY(-8px)}}}}@keyframes rise{{from{{transform:translateY(60px);opacity:0}}}}@keyframes particleBurst{{0%{{opacity:1;transform:translate(0,0) scale(1)}}100%{{opacity:0;transform:translate(var(--dx),var(--dy)) scale(.3)}}}}@keyframes arrowFly{{0%{{opacity:0;transform:translateY(40px) scale(.4) rotate(-25deg)}}25%{{opacity:1;transform:translateY(0) scale(1.15) rotate(5deg)}}60%{{opacity:1;transform:translateY(-30px) scale(1) rotate(-3deg)}}100%{{opacity:0;transform:translateY(-80px) scale(.7) rotate(10deg)}}}}`}</style>
    </div>);
  }"""

if old_scoring in content:
    content = content.replace(old_scoring, new_scoring)
    print("✅ Replaced scoringMode branch with full battle display")
else:
    print("❌ Could not find scoringMode branch - checking partial match")
    # Try a simpler match
    if "// ── 計分模式（只顯示計分層，無戰鬥容器）──" in content:
        print("   Found the comment marker, but exact string doesn't match")
    else:
        print("   Could not find scoringMode comment at all")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
