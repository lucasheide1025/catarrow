export function ArcadeShell({ screen, children, compact = false }) {
  return (
    <main id="arcade-main" className={`arcade-stage arcade-game-shell${compact ? " is-compact" : ""}`} data-arcade-screen={screen}>
      <div className="arcade-wrap">{children}</div>
    </main>
  );
}

export function ArcadeBrand({ subtitle }) {
  return (
    <header className="arcade-topbar arcade-marquee">
      <div className="arcade-logo">
        <div className="arcade-logo-badge" aria-hidden="true">🏹</div>
        <div>
          <div className="arcade-logo-title">貓弓魔法機台</div>
          <div className="arcade-logo-sub">{subtitle}</div>
        </div>
      </div>
      <span className="arcade-online"><i aria-hidden="true" /> LOCAL READY</span>
    </header>
  );
}

export function ArcadePlayerBar({ profile, cat, level, xp, xpMax, progress, onReset }) {
  return (
    <header className="arcade-player-bar">
      <img src={cat?.image} alt="" width="42" height="42" />
      <div className="arcade-player-copy">
        <strong>{profile.nickname}</strong>
        <span>{cat?.name}同行中 · Lv.{level}</span>
      </div>
      <div className="arcade-player-xp" aria-label={`經驗值 ${xp} / ${xpMax}`}>
        <span style={{ width: `${progress}%` }} />
      </div>
      <b className="arcade-player-coins">🪙 {profile.coins || 0}</b>
      <button type="button" className="arcade-icon-button" onClick={onReset} aria-label="清除本機進度">⚙</button>
    </header>
  );
}

export function ArcadeActionDock({ children, note }) {
  return (
    <div className="arcade-action-dock">
      {children}
      {note ? <small>{note}</small> : null}
    </div>
  );
}

export function DungeonCarousel({ dungeons, onSelect }) {
  return (
    <section aria-labelledby="arcade-dungeons-title">
      <div className="arcade-section-heading">
        <div>
          <span>QUEST POSTERS</span>
          <h2 id="arcade-dungeons-title">選擇地下城</h2>
        </div>
        <small>左右滑動選關</small>
      </div>
      <div className="arcade-dungeon-carousel">
        {dungeons.map((d, index) => (
          <article key={d.id} className={`arcade-dungeon-poster theme-${d.id}`}>
            <div className="arcade-poster-number">0{index + 1}</div>
            <span className="arcade-dungeon-icon" aria-hidden="true">{d.icon}</span>
            <div className="arcade-poster-copy">
              <span className="arcade-dungeon-diff">{d.difficulty}</span>
              <h3>{d.name}</h3>
              <p>{d.desc}</p>
            </div>
            <button type="button" onClick={() => onSelect(d.id)} aria-label={`進入${d.name}`}>
              進入關卡 <span aria-hidden="true">→</span>
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
