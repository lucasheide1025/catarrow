// src/hooks/useCatAnimationAccess.js
// 控制 CatAnimator 的顯示權限：
// - 只有 admin（教練）能看到動畫
// - 提供 localStorage 開關讓教練自己關閉
//
// 用法：
//   const { visible, enabled, setEnabled } = useCatAnimationAccess();
//   if (!visible) return null;
//   <CatAnimator enabled={enabled} ... />

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";

const STORAGE_KEY = "catarrow_cat_animation_enabled";

export function useCatAnimationAccess() {
  const { role } = useAuth();

  // 只有 admin 才有權限看到動畫
  const visible = role === "admin";

  const [enabled, setEnabledState] = useState(false);

  // role 就緒後才真正設定 enabled（避免 auth 載入前 role=null 誤覆寫）
  useEffect(() => {
    if (role === "admin") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        setEnabledState(stored === null ? true : stored === "true");
      } catch {
        setEnabledState(true);
      }
    } else {
      setEnabledState(false);
    }
  }, [role]);

  const setEnabled = useCallback((value) => {
    const next = Boolean(value);
    setEnabledState(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {}
  }, []);

  const toggle = useCallback(() => {
    setEnabled(!enabled);
  }, [enabled, setEnabled]);

  return { visible, enabled, setEnabled, toggle };
}
