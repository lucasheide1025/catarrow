// src/components/cat/CatBuddy.jsx
// 全局浮動貓貓伴侶 — 會到處跑、講話、偶爾擋畫面
// 用法：在 MemberApp / AdminApp 的 root div 內加入 <CatBuddy />

import { useState, useEffect, useRef, useCallback } from "react";
import CatAnimator from "./CatAnimator";
import { useCatAnimationAccess } from "../../hooks/useCatAnimationAccess";
import { useCatCompanion } from "../../hooks/useCatCompanion";
import { useCatBuddySubscriber } from "./CatBuddyContext";
import { getCatSpeech, getRandomContext, getCatDescription, getBattleSpeech } from "./catSpeeches";

// ── CSS 動畫 ──────────────────────────────────────────────
const BUDDY_CSS = `
@keyframes cb-float-in {
  0% { opacity: 0; transform: translateY(20px) scale(0.8); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes cb-speech-in {
  0% { opacity: 0; transform: translateY(8px) scale(0.9); }
  60% { opacity: 1; transform: translateY(-2px) scale(1.02); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes cb-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
`;

// ── Utility: 隨機位置（避開中央區域 30-70%）
function randomEdgePosition() {
  const side = Math.floor(Math.random() * 4);
  const margin = 16;
  const w = typeof window !== "undefined" ? window.innerWidth : 400;
  const h = typeof window !== "undefined" ? window.innerHeight : 600;
  const bottomZone = h * 0.45; // 下方 45%
  const topZone = h * 0.1;     // 上方 10%

  switch (side) {
    case 0: // 左下
      return { left: margin + Math.random() * (w * 0.25), top: h * 0.5 + Math.random() * (bottomZone - 60) };
    case 1: // 右下
      return { left: w * 0.7 + Math.random() * (w * 0.25 - margin), top: h * 0.5 + Math.random() * (bottomZone - 60) };
    case 2: // 左中
      return { left: margin, top: topZone + Math.random() * (h * 0.35) };
    case 3: // 右中
      return { left: w * 0.85, top: topZone + Math.random() * (h * 0.35) };
    default:
      return { left: w - 120, top: h * 0.6 };
  }
}

// ── Utility: 偶爾擋畫面（移動到畫面中央偏右）
function blockPosition() {
  const w = typeof window !== "undefined" ? window.innerWidth : 400;
  const h = typeof window !== "undefined" ? window.innerHeight : 600;
  return { left: w * 0.35 + Math.random() * (w * 0.2), top: h * 0.25 + Math.random() * (h * 0.2) };
}

// ══════════════════════════════════════════════════════════
// 主元件
// ══════════════════════════════════════════════════════════
export default function CatBuddy({ defaultVisible = true }) {
  const { visible, enabled } = useCatAnimationAccess();
  const { hasCat, catId, catName } = useCatCompanion();

  const [showBuddy, setShowBuddy] = useState(defaultVisible);
  const [position, setPosition] = useState(() => randomEdgePosition());
  const [animState, setAnimState] = useState("idle");
  const [speech, setSpeech] = useState(null);
  const [speechVisible, setSpeechVisible] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const moveTimerRef = useRef(null);
  const speechTimerRef = useRef(null);
  const eventAnimTimeoutRef = useRef(null);
  const blockChanceRef = useRef(0);

  // ── 清除計時器 ──────────────────────────────────────────
  const clearTimers = useCallback(() => {
    if (moveTimerRef.current) { clearTimeout(moveTimerRef.current); moveTimerRef.current = null; }
    if (speechTimerRef.current) { clearTimeout(speechTimerRef.current); speechTimerRef.current = null; }
    if (eventAnimTimeoutRef.current) { clearTimeout(eventAnimTimeoutRef.current); eventAnimTimeoutRef.current = null; }
  }, []);

  // ── 顯示對話泡泡 ────────────────────────────────────────
  const showSpeech = useCallback((text, duration = 4000) => {
    setSpeech(text);
    setSpeechVisible(true);
    if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
    speechTimerRef.current = setTimeout(() => {
      setSpeechVisible(false);
      setTimeout(() => setSpeech(null), 300);
    }, duration);
  }, []);

  // ── 貓貓移動 ────────────────────────────────────────────
  const moveCat = useCallback(() => {
    if (!hasCat || !catId) return;

    // 5% 機率擋畫面
    const willBlock = Math.random() < 0.05 && !isBlocking;
    if (willBlock) {
      setIsBlocking(true);
      setPosition(blockPosition());
      setAnimState("alert");
      const text = getCatSpeech(catId, "block");
      showSpeech(text, 2500);
      setTimeout(() => {
        setIsBlocking(false);
        setAnimState("idle");
        // 擋完後回到邊緣
        setPosition(randomEdgePosition());
      }, 3000);
    } else {
      setAnimState(Math.random() < 0.3 ? "happy" : "idle");
      setPosition(randomEdgePosition());
      // 偶爾講話
      if (Math.random() < 0.35) {
        const ctx = getRandomContext();
        const text = getCatSpeech(catId, ctx);
        showSpeech(text, 3500);
      }
    }
  }, [hasCat, catId, isBlocking, showSpeech]);

  // ── 週期性移動 ──────────────────────────────────────────
  useEffect(() => {
    if (!visible || !enabled || !hasCat || !showBuddy) return;
    const schedule = () => {
      const delay = 6000 + Math.random() * 12000; // 6-18 秒移動一次
      moveTimerRef.current = setTimeout(() => {
        moveCat();
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimers();
  }, [visible, enabled, hasCat, showBuddy, moveCat, clearTimers]);

  // ── 閒置對話（移動間隔中隨機講話）─────────────────────
  useEffect(() => {
    if (!visible || !enabled || !hasCat || !catId || !showBuddy) return;
    const talk = () => {
      const delay = 15000 + Math.random() * 25000; // 15-40 秒
      speechTimerRef.current = setTimeout(() => {
        if (Math.random() < 0.6 && !speechVisible) {
          const ctx = getRandomContext();
          const text = getCatSpeech(catId, ctx);
          showSpeech(text, 3000);
        }
        talk();
      }, delay);
    };
    talk();
    return () => { if (speechTimerRef.current) clearTimeout(speechTimerRef.current); };
  }, [visible, enabled, hasCat, catId, showBuddy, speechVisible, showSpeech]);

  // ── 訂閱戰鬥事件 ────────────────────────────────────────
  useCatBuddySubscriber((event) => {
    if (!event || !event.animation) return;
    const anim = event.animation;
    const duration = event.duration || 1500;
    const ctx = event.context || (anim === "victory" ? "victory" : anim === "miss" ? "lose" : "encourage");

    // 清除之前的計時器
    if (eventAnimTimeoutRef.current) clearTimeout(eventAnimTimeoutRef.current);

    // 臨時覆蓋動畫狀態
    setAnimState(anim);

    // 如果有台詞，顯示對話泡泡
    if (event.speech && catId) {
      showSpeech(event.speech, duration);
    } else if (anim && catId) {
      // 自動產生戰鬥相關台詞
      const text = getBattleSpeech(catId, ctx);
      showSpeech(text, duration);
    }

    // 計時器恢復閒置
    eventAnimTimeoutRef.current = setTimeout(() => {
      setAnimState("idle");
      eventAnimTimeoutRef.current = null;
    }, duration);
  });

  // ── 切換動畫狀態（滑鼠懸浮、離開）────────────────────
  useEffect(() => {
    if (!isHovered || !hasCat) return;
    // 懸浮時貓貓看向你
    setAnimState("happy");
    return () => setAnimState("idle");
  }, [isHovered, hasCat]);

  // ── 權限檢查 ──────────────────────────────────────────
  if (!visible || !enabled || !hasCat || !showBuddy) return null;

  // ── 實際尺寸 ──────────────────────────────────────────
  const catSize = isBlocking ? 96 : isHovered ? 80 : 64;
  const speechMaxW = isBlocking ? 220 : 180;

  return (
    <>
      <style>{BUDDY_CSS}</style>

      {/* 貓貓本體 */}
      <div
        style={{
          position: "fixed",
          left: position.left,
          top: position.top,
          zIndex: isBlocking ? 9999 : 999,
          cursor: "pointer",
          animation: "cb-float-in 0.5s cubic-bezier(.34,1.56,.64,1)",
          transition: "left 1.2s cubic-bezier(.22,.68,.4,1), top 1.2s cubic-bezier(.22,.68,.4,1)",
          pointerEvents: "auto",
          userSelect: "none",
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => {
          if (!speechVisible && catId) {
            const text = getCatSpeech(catId, "tease");
            showSpeech(text, 3000);
          }
          setShowInfo(true);
          setTimeout(() => setShowInfo(false), 5000);
        }}
      >
        {/* 貓貓動畫 */}
        <CatAnimator
          catId={catId}
          animation={animState}
          size={catSize}
          visible={true}
          enabled={true}
        />

        {/* 貓名標籤（hover 時顯示） */}
        {isHovered && (
          <div style={{
            position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)",
            fontSize: 10, fontWeight: 900, color: "rgba(255,255,255,0.7)",
            whiteSpace: "nowrap", textShadow: "0 1px 4px rgba(0,0,0,0.5)",
          }}>
            {catName}
          </div>
        )}
      </div>

      {/* 對話泡泡 */}
      {speech && speechVisible && (
        <div
          style={{
            position: "fixed",
            left: position.left + (isBlocking ? 8 : -20),
            top: position.top - (isBlocking ? 16 : 8),
            zIndex: isBlocking ? 10000 : 1000,
            maxWidth: speechMaxW,
            padding: "8px 14px",
            borderRadius: 14,
            background: isBlocking
              ? "linear-gradient(135deg, #f43f5e, #e11d48)"
              : "rgba(15,23,42,0.92)",
            border: isBlocking
              ? "1px solid rgba(244,63,94,0.5)"
              : "1px solid rgba(255,255,255,0.12)",
            boxShadow: isBlocking
              ? "0 4px 20px rgba(244,63,94,0.4)"
              : "0 4px 16px rgba(0,0,0,0.3)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            lineHeight: 1.4,
            textAlign: "center",
            whiteSpace: "pre-wrap",
            pointerEvents: "none",
            animation: "cb-speech-in 0.25s ease-out",
            backdropFilter: "blur(6px)",
          }}
        >
          {isBlocking && <span style={{ marginRight: 4 }}>🚧</span>}
          {speech}
        </div>
      )}

      {/* 角色資訊卡（點擊後短暫顯示） */}
      {showInfo && catId && (
        <div
          style={{
            position: "fixed",
            left: position.left + catSize + 8,
            top: Math.max(10, position.top - 20),
            zIndex: 1000,
            maxWidth: 260,
            padding: "10px 14px",
            borderRadius: 12,
            background: "rgba(6,10,18,0.94)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            color: "#e2e8f0",
            fontSize: 11,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            pointerEvents: "none",
            animation: "cb-speech-in 0.2s ease-out",
            backdropFilter: "blur(8px)",
          }}
        >
          {getCatDescription(catId)}
        </div>
      )}

      {/* 關閉/隱藏按鈕（hover 時出現） */}
      {isHovered && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowBuddy(false); }}
          style={{
            position: "fixed",
            left: position.left + catSize - 8,
            top: position.top - 6,
            zIndex: 1001,
            width: 20,
            height: 20,
            borderRadius: "50%",
            border: "none",
            background: "rgba(0,0,0,0.5)",
            color: "rgba(255,255,255,0.6)",
            fontSize: 12,
            lineHeight: "20px",
            textAlign: "center",
            cursor: "pointer",
            padding: 0,
          }}
        >
          ✕
        </button>
      )}

      {/* 擋畫面提示 */}
      {isBlocking && (
        <div
          style={{
            position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
            zIndex: 9998,
            padding: "6px 16px",
            borderRadius: 20,
            background: "rgba(244,63,94,0.15)",
            border: "1px solid rgba(244,63,94,0.3)",
            color: "#fb7185",
            fontSize: 11,
            fontWeight: 700,
            animation: "cb-bounce 1.5s ease-in-out infinite",
            pointerEvents: "none",
          }}
        >
          🐱 貓貓在搗蛋！
        </div>
      )}
    </>
  );
}
