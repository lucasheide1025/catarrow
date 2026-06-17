// src/components/story/StoryBook.jsx — 故事本主元件
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import { STORY_CHAPTERS } from "../../lib/storyData";
import { getStoryChapterConfigs, isChapterUnlocked, buildAchievementContext } from "../../lib/storyDb";
import CatStoryBook from "../cat/CatStoryBook";

// ── 故事圖片（有就顯示，無就用佔位）───────────────────────────
function StoryImage({ src, accent }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div style={{
        width: "100%", aspectRatio: "16/9",
        background: `linear-gradient(135deg, #1e293b, #0f172a)`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 8,
      }}>
        <div style={{ fontSize: 40, opacity: 0.3 }}>🏹</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,.2)" }}>插圖製作中…</div>
      </div>
    );
  }
  return (
    <div style={{
      width: "100%",
      height: "320px", // 鎖定容器高度，確保不會無限撐開
      backgroundColor: "#000", // 背景填補顏色
      display: "flex",
      justifyContent: "center",
      alignItems: "center"
    }}>
      <img
        src={`/story/${src}`}
        alt=""
        onError={() => setFailed(true)}
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain", // 關鍵：保持比例，不裁切，完整顯示
          display: "block"
        }}
      />
    </div>
  );
}

// ── 沉浸式章節閱讀器 ─────────────────────────────────────────
function StoryReader({ chapter, onClose }) {
  // pageIdx = -1 代表標題頁
  const [pageIdx, setPageIdx] = useState(-1);
  const [fading,  setFading]  = useState(false);
  const touchStart = useRef(null);
  const total = chapter.pages.length;

  function goPage(next) {
    if (fading) return;
    setFading(true);
    setTimeout(() => { setPageIdx(next); setFading(false); }, 280);
  }

  function prev() { if (pageIdx > -1) goPage(pageIdx - 1); }
  function next() { if (pageIdx < total - 1) goPage(pageIdx + 1); }

  function onTouchStart(e) { touchStart.current = e.touches[0].clientX; }
  function onTouchEnd(e) {
    if (touchStart.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStart.current;
    touchStart.current = null;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) next(); else prev();
  }

  const page = pageIdx >= 0 ? chapter.pages[pageIdx] : null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 60,
        background: "#0f1923",
        display: "flex", flexDirection: "column",
        fontFamily: "sans-serif", color: "white",
        userSelect: "none",
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Header */}
      <div style={{
        flexShrink: 0,
        padding: "12px 16px",
        display: "flex", alignItems: "center", gap: 12,
        background: "rgba(0,0,0,.4)",
        backdropFilter: "blur(8px)",
      }}>
        <button onClick={onClose}
          style={{ background: "none", border: "none", color: "rgba(255,255,255,.6)", fontSize: 20, cursor: "pointer", padding: 0 }}>
          ←
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", letterSpacing: "0.08em" }}>{chapter.label}</div>
          <div style={{ fontSize: 14, fontWeight: 900 }}>{chapter.title}</div>
        </div>
        {pageIdx >= 0 && (
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", fontVariantNumeric: "tabular-nums" }}>
            {pageIdx + 1} / {total}
          </div>
        )}
      </div>

      {/* 主內容（帶 fade）*/}
      <div style={{
        flex: 1, overflow: "hidden", display: "flex", flexDirection: "column",
        opacity: fading ? 0 : 1, transition: "opacity 0.28s ease",
      }}>

        {/* ── 標題頁 ── */}
        {pageIdx === -1 && (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: "40px 32px", textAlign: "center",
            background: `linear-gradient(160deg, ${chapter.bg}ee, #0f1923)`,
          }}>
            <div style={{ fontSize: 13, letterSpacing: "0.2em", color: chapter.accent, fontWeight: 900, marginBottom: 8 }}>
              ── {chapter.label} ──
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.3, marginBottom: 24, maxWidth: 280 }}>
              {chapter.title}
            </div>
            {chapter.catName && (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.45)", marginBottom: 32 }}>
                收錄神貓：{chapter.catName}
              </div>
            )}
            <button onClick={() => goPage(0)}
              style={{
                padding: "14px 36px", background: chapter.accent, color: "#0f172a",
                border: "none", borderRadius: 30, fontWeight: 900, fontSize: 15,
                cursor: "pointer", letterSpacing: "0.05em",
              }}>
              開始閱讀
            </button>
          </div>
        )}

        {/* ── 內文頁 ── */}
        {pageIdx >= 0 && page && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* 插圖：key 強制換圖時完整重掛，避免舊圖殘留 */}
            <div style={{ flexShrink: 0 }}>
              <StoryImage key={page.img || pageIdx} src={page.img} accent={chapter.accent}/>
            </div>

            {/* 文字：逐行淡入 */}
            <style>{`
              @keyframes storyLineIn {
                from { opacity: 0; transform: translateY(8px); }
                to   { opacity: 1; transform: translateY(0); }
              }
            `}</style>
            <div style={{
              flex: 1, overflowY: "auto",
              padding: "24px 20px 100px",
              fontSize: 16, lineHeight: 2.0,
              color: "rgba(255,255,255,.85)",
              letterSpacing: "0.03em",
              fontFamily: `"Hiragino Mincho ProN", "Yu Mincho", "Georgia", serif`,
            }}>
              {(page.text || "").split("\n").map((line, i) => (
                <div key={`${pageIdx}-${i}`} style={{
                  opacity: 0,
                  animation: "storyLineIn 0.55s ease forwards",
                  animationDelay: `${i * 0.18}s`,
                  minHeight: line ? undefined : "1em",
                }}>
                  {line || " "}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 底部翻頁控制 */}
      {pageIdx >= 0 && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          padding: "16px 20px 28px",
          background: "linear-gradient(0deg, rgba(0,0,0,.85) 0%, transparent 100%)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <button
            onClick={prev}
            disabled={pageIdx === 0}
            style={{
              flex: 1, padding: "12px", border: "1px solid rgba(255,255,255,.15)",
              borderRadius: 12, background: "rgba(255,255,255,.08)",
              color: pageIdx === 0 ? "rgba(255,255,255,.2)" : "white",
              fontSize: 14, fontWeight: 900, cursor: pageIdx === 0 ? "default" : "pointer",
            }}>
            ‹ 上一頁
          </button>

          {/* 進度點 */}
          <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
            {chapter.pages.map((_, i) => (
              <div key={i} onClick={() => goPage(i)} style={{
                width: i === pageIdx ? 16 : 6, height: 6,
                borderRadius: 3, cursor: "pointer",
                background: i === pageIdx ? chapter.accent : "rgba(255,255,255,.2)",
                transition: "all 0.2s ease",
              }}/>
            ))}
          </div>

          {pageIdx < total - 1 ? (
            <button
              onClick={next}
              style={{
                flex: 1, padding: "12px",
                border: `1px solid ${chapter.accent}66`,
                borderRadius: 12, background: `${chapter.accent}22`,
                color: chapter.accent, fontSize: 14, fontWeight: 900, cursor: "pointer",
              }}>
              下一頁 ›
            </button>
          ) : (
            <button
              onClick={onClose}
              style={{
                flex: 1, padding: "12px",
                border: "none", borderRadius: 12,
                background: chapter.accent,
                color: "#0f172a", fontSize: 14, fontWeight: 900, cursor: "pointer",
              }}>
              ✓ 讀完了
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── 主線章節列表 ─────────────────────────────────────────────
function MainStoryList({ profile }) {
  const [configs,  setConfigs]  = useState({});
  const [achCtx,   setAchCtx]   = useState({});
  const [reading,  setReading]  = useState(null); // chapter object
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([
      getStoryChapterConfigs(),
      buildAchievementContext(profile),
    ]).then(([c, ctx]) => { setConfigs(c); setAchCtx(ctx); setLoading(false); });
  }, [profile?.id]); // eslint-disable-line

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center", color: "#64748b", fontSize: 14 }}>載入中…</div>
  );

  if (reading) return <StoryReader chapter={reading} onClose={() => setReading(null)}/>;

  return (
    <div style={{ padding: "16px 16px 100px" }}>
      {STORY_CHAPTERS.map(ch => {
        const unlocked = isChapterUnlocked(ch.key, configs[ch.key], profile, achCtx);
        const hint     = configs[ch.key]?.hintText || "";

        return (
          <div key={ch.key}
            onClick={() => unlocked && setReading(ch)}
            style={{
              marginBottom: 12, borderRadius: 16, overflow: "hidden",
              border: `1px solid ${unlocked ? ch.accent + "44" : "rgba(255,255,255,.06)"}`,
              background: unlocked
                ? `linear-gradient(135deg, ${ch.bg}cc, #0f172a)`
                : "rgba(255,255,255,.03)",
              cursor: unlocked ? "pointer" : "default",
              transition: "opacity 0.15s",
            }}>
            <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
              {/* 左側色塊 */}
              <div style={{
                width: 4, height: 44, borderRadius: 2, flexShrink: 0,
                background: unlocked ? ch.accent : "rgba(255,255,255,.1)",
              }}/>
              {/* 章節資訊 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: unlocked ? ch.accent : "rgba(255,255,255,.25)", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 3 }}>
                  {ch.label}
                </div>
                <div style={{ fontSize: 15, fontWeight: 900, color: unlocked ? "white" : "rgba(255,255,255,.3)", lineHeight: 1.2 }}>
                  {ch.title}
                </div>
                {!unlocked && hint && (
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,.25)", marginTop: 4 }}>🔒 {hint}</div>
                )}
                {!unlocked && !hint && ch.key !== "ch0" && (
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,.2)", marginTop: 4 }}>🔒 尚未解鎖</div>
                )}
                {ch.catName && unlocked && (
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", marginTop: 3 }}>🐱 {ch.catName}</div>
                )}
              </div>
              {/* 右側圖示 */}
              <div style={{ flexShrink: 0, fontSize: 20 }}>
                {unlocked ? "📖" : "🔒"}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── StoryBook 主元件（含 Tab）───────────────────────────────
export default function StoryBook({ onBack }) {
  const { profile } = useAuth();
  const [tab, setTab] = useState("main"); // "main" | "cats"

  return (
    <div style={{ minHeight: "100vh", background: "#0f1923", fontFamily: "sans-serif", color: "white" }}>
      {/* Header */}
      <div style={{
        padding: "14px 16px 0",
        background: "linear-gradient(180deg, #1e1b4b, #0f1923)",
        position: "sticky", top: 0, zIndex: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          {onBack && (
            <button onClick={onBack}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,.5)", fontSize: 20, cursor: "pointer", padding: 0 }}>
              ←
            </button>
          )}
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", letterSpacing: "0.1em" }}>CATARROW</div>
            <div style={{ fontSize: 20, fontWeight: 900 }}>📖 故事本</div>
          </div>
        </div>

        {/* Tab 切換 */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid rgba(255,255,255,.08)" }}>
          {[["main", "主線故事"], ["cats", "貓貓故事"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{
                flex: 1, padding: "10px 0", border: "none",
                background: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 900,
                color: tab === id ? "white" : "rgba(255,255,255,.35)",
                borderBottom: `2px solid ${tab === id ? "#c4b5fd" : "transparent"}`,
                transition: "all 0.2s",
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 內容 */}
      {tab === "main" && <MainStoryList profile={profile}/>}
      {tab === "cats" && (
        <div style={{ paddingTop: 8 }}>
          <CatStoryBook onBack={() => setTab("main")} embedded/>
        </div>
      )}
    </div>
  );
}
