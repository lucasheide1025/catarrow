// src/hooks/useCheckinActive.js
import { useState, useEffect } from "react";
import { subscribeMyCheckin } from "../lib/db";

export function useCheckinActive(memberId) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!memberId) { setActive(false); return; }
    const unsub = subscribeMyCheckin(memberId, c => {
      // status "active"（任務型）或 type "simple" 且尚未下課，都算上課中
      const isActive = c?.status === "active" ||
        (c?.type === "simple" && c?.status === "done" && !c?.classEnded);
      setActive(isActive);
    });
    return () => unsub?.();
  }, [memberId]);
  return active;
}
