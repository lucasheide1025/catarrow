// src/components/cat/CatBuddyContext.jsx
// 事件系統：讓戰鬥畫面通知全局 CatBuddy 切換動畫/講話
//
// 用法（戰鬥畫面）：
//   const emitCatEvent = useCatBuddyEvent();
//   emitCatEvent({ animation: "happy", duration: 1000, speech: "Nice shot!" });
//
// CatBuddy 內部：
//   const pendingEvent = useCatBuddySubscriber();

import { createContext, useContext, useRef, useCallback, useState, useEffect } from "react";

const CatBuddyCtx = createContext(null);

export function CatBuddyProvider({ children }) {
  // 使用 ref + state 組合：ref 保持最新值，state 觸發 re-render
  const pendingRef = useRef(null);
  const [pending, setPending] = useState(null);
  const listenersRef = useRef([]);

  const emitEvent = useCallback((event) => {
    const evt = {
      ...event,
      id: Date.now() + Math.random(),
      ts: Date.now(),
    };
    pendingRef.current = evt;
    setPending(evt);
    // 也通知 listener-based 訂閱者
    listenersRef.current.forEach(fn => fn(evt));
  }, []);

  const subscribe = useCallback((fn) => {
    listenersRef.current.push(fn);
    return () => {
      listenersRef.current = listenersRef.current.filter(f => f !== fn);
    };
  }, []);

  return (
    <CatBuddyCtx.Provider value={{ emitEvent, subscribe, pendingRef, pending }}>
      {children}
    </CatBuddyCtx.Provider>
  );
}

// 給戰鬥畫面用的 hook — 發射事件
export function useCatBuddyEvent() {
  const ctx = useContext(CatBuddyCtx);
  if (!ctx) return () => {};
  return ctx.emitEvent;
}

// 給 CatBuddy 元件用的 hook — 事件監聽器
export function useCatBuddySubscriber(callback) {
  const ctx = useContext(CatBuddyCtx);
  const fnRef = useRef(callback);
  fnRef.current = callback;

  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe((evt) => {
      fnRef.current?.(evt);
    });
  }, [ctx]);
}

// 取得最新的事件（給 CatBuddy 讀取 current event）
export function useLatestCatEvent() {
  const ctx = useContext(CatBuddyCtx);
  return ctx?.pending || null;
}
